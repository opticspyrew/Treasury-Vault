import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { authApi, publicApi, type AuthUser } from "./api";
import { validatePassword } from "./password-policy";
import {
  LoginLockoutError,
  getLockoutState,
  recordFailure,
  recordSuccess,
} from "./login-throttle";

interface User {
  email: string;
  name: string;
  avatar?: string;
  /** True when the server has confirmed the user's admin_clients status is approved/active. */
  portalAccess?: boolean;
}

interface StoredSession {
  token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True when this user is allowed to enter the Recovery Portal. */
  portalAccess: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, initialBalanceUsd?: number, scammedVia?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setPassword: (newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<void>;
  accountExists: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = "cryptovault.session";
const LEGACY_ACCOUNTS_KEY = "cryptovault.accounts";

function toUser(apiUser: AuthUser): User {
  return { email: apiUser.email, name: apiUser.name, portalAccess: apiUser.portalAccess ?? false };
}

function loadStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.token === "string" &&
      parsed.user &&
      typeof parsed.user.email === "string" &&
      typeof parsed.user.name === "string"
    ) {
      return {
        token: parsed.token,
        user: { email: parsed.user.email, name: parsed.user.name },
      };
    }
    // Legacy session shape (just user info, no token) — discard so the user
    // is forced to sign in against the server.
    return null;
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function clearLegacyAccounts() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_ACCOUNTS_KEY);
  } catch {
    // ignore storage errors
  }
}

function readOidcHandoffToken(): string | null {
  // Accepts either `#replit_token=...` (Replit OIDC) or `#social_token=...`
  // (Google/Apple). Both flows hand the SPA a brand-new session token via
  // the URL fragment so it never hits the server logs.
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  if (!hash.includes("replit_token=") && !hash.includes("social_token=")) return null;
  try {
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const token = params.get("social_token") ?? params.get("replit_token");
    if (token) {
      // Strip the token from the URL so it doesn't sit in browser history.
      const url = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", url);
      return token;
    }
  } catch {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const handoffToken = readOidcHandoffToken();
  const stored = loadStoredSession();
  // When the user just came back from the Replit OIDC callback we don't yet
  // know their email/name (those come from /auth/me below). Seed the session
  // with a placeholder so isAuthenticated flips to true immediately and the
  // ProtectedRoute lands them on the dashboard instead of bouncing to /sign-in.
  const initial: StoredSession | null = handoffToken
    ? { token: handoffToken, user: stored?.user ?? { email: "", name: "" } }
    : stored;
  const [session, setSessionState] = useState<StoredSession | null>(initial);
  const tokenRef = useRef<string | null>(initial?.token ?? null);

  const updateSession = (next: StoredSession | null) => {
    tokenRef.current = next?.token ?? null;
    saveStoredSession(next);
    setSessionState(next);
  };

  useEffect(() => {
    // Stop persisting locally-created accounts; the server is the source of truth now.
    clearLegacyAccounts();
  }, []);

  useEffect(() => {
    // Validate any restored session against the server. If the token is no
    // longer valid (e.g. expired or revoked), drop it so the UI redirects to
    // sign-in instead of pretending the user is authenticated.
    let cancelled = false;
    const current = tokenRef.current;
    if (!current) return;
    (async () => {
      try {
        const apiUser = await authApi.me(current);
        if (cancelled) return;
        if (!apiUser) {
          updateSession(null);
        } else {
          updateSession({ token: current, user: toUser(apiUser) });
        }
      } catch {
        // Network failure — keep the cached session so the user isn't kicked
        // out unnecessarily; the next protected request will surface the issue.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep multiple tabs in sync: the browser fires a "storage" event in every
    // OTHER tab of this origin when localStorage changes. When the session key
    // is written or removed elsewhere (login, signup, logout), adopt the new
    // value here so this tab reflects the change without a manual refresh.
    // We update state directly instead of via updateSession() to avoid
    // re-writing storage (which could loop) — the originating tab already did.
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      // A null key means the whole store was cleared; otherwise only react to
      // changes to our session key.
      if (event.key !== null && event.key !== SESSION_KEY) return;
      const next = loadStoredSession();
      tokenRef.current = next?.token ?? null;
      setSessionState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = async (email: string, password: string) => {
    const lock = getLockoutState(email);
    if (lock.locked) {
      throw new LoginLockoutError(lock.msRemaining, lock.failures);
    }

    try {
      const result = await authApi.login({ email, password });
      recordSuccess(email);
      updateSession({ token: result.token, user: toUser(result.user) });
    } catch (err) {
      recordFailure(email);
      const fresh = getLockoutState(email);
      if (fresh.locked) {
        throw new LoginLockoutError(fresh.msRemaining, fresh.failures);
      }
      if (err instanceof Error) throw err;
      throw new Error("Invalid email or password");
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    initialBalanceUsd?: number,
    scammedVia?: string,
  ) => {
    const result = await authApi.signup({ name, email, password, initialBalanceUsd, scammedVia });
    updateSession({ token: result.token, user: toUser(result.user) });

    try {
      await publicApi.registerClient({ name: result.user.name, email: result.user.email });
    } catch {
      // silent — don't block signup if the admin notification is unavailable
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const token = tokenRef.current;
    if (!token) {
      throw new Error("You must be signed in to change your password.");
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      throw new Error(passwordCheck.error ?? "Please choose a stronger password.");
    }

    if (currentPassword === newPassword) {
      throw new Error("New password must be different from your current password.");
    }

    await authApi.changePassword(token, { currentPassword, newPassword });
  };

  const setPassword = async (newPassword: string) => {
    const token = tokenRef.current;
    if (!token) {
      throw new Error("You must be signed in to set a password.");
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      throw new Error(passwordCheck.error ?? "Please choose a stronger password.");
    }

    await authApi.setPassword(token, { newPassword });
  };

  const accountExists = async (email: string): Promise<boolean> => {
    const trimmed = email.trim();
    if (!trimmed) return false;
    try {
      const { exists } = await authApi.exists(trimmed);
      return exists;
    } catch {
      return false;
    }
  };

  const forgotPassword = async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) {
      throw new Error("Please enter the email address for your account.");
    }
    await authApi.forgotPassword(trimmed);
  };

  const resetPasswordWithToken = async (token: string, newPassword: string) => {
    if (!token) {
      throw new Error("Reset link is missing or invalid.");
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      throw new Error(passwordCheck.error ?? "Please choose a stronger password.");
    }

    const result = await authApi.resetPassword({ token, newPassword });
    updateSession({ token: result.token, user: toUser(result.user) });

    // Clear any active lockout for this email so a previously locked-out user
    // can use the dashboard immediately after resetting.
    recordSuccess(result.user.email);
  };

  const logout = async () => {
    const token = tokenRef.current;
    updateSession(null);
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        // ignore — we've already dropped the local session
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        isAuthenticated: !!session,
        portalAccess: session?.user?.portalAccess === true,
        token: session?.token ?? null,
        login,
        signup,
        changePassword,
        setPassword,
        forgotPassword,
        resetPasswordWithToken,
        accountExists,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
