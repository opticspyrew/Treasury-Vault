import { Router, type Request, type Response } from "express";
import {
  db,
  users,
  userSessions,
  passwordResetTokens,
  adminClients,
  adminServiceRequests,
  adminActivityLog,
} from "@workspace/db";
import { and, eq, isNull, gt, desc, ne, sql } from "drizzle-orm";
import {
  generateResetToken,
  hashPassword,
  hashResetToken,
  verifyPassword,
} from "../lib/passwords";
import {
  createSession,
  deleteAllUserSessions,
  deleteSessionByToken,
  extractBearerToken,
  findSessionWithUser,
  findUserByEmail,
  findUserBySessionToken,
  hasSeenSessionMetadata,
  normalizeEmail,
  publicUser,
  type SessionMetadata,
} from "../lib/auth";
import { logger } from "../lib/logger";
import { lookupLocation } from "../lib/geoip";
import {
  accountLockedAdminEmail,
  accountLockedUserEmail,
  newSignInEmail,
  passwordChangedEmail,
  passwordResetEmail,
  sendAdminEmail,
  sendUserEmail,
} from "../lib/email";
import {
  checkForgotPasswordThrottle,
  getClientIp,
} from "../lib/forgot-password-throttle";
import {
  checkLoginThrottle,
  clearLoginFailures,
  getAccountThrottleStatus,
  recordLoginFailure,
} from "../lib/login-throttle";
import {
  resolveNotificationPreferences,
} from "../lib/notification-preferences";
import { SUPPORT_EMAIL } from "../lib/support-email";

const MAX_USER_AGENT_LENGTH = 500;

function captureSessionMetadata(req: Request): SessionMetadata {
  const ip = getClientIp(req);
  const rawUa = req.headers["user-agent"];
  const userAgent =
    typeof rawUa === "string" && rawUa.trim().length > 0
      ? rawUa.slice(0, MAX_USER_AGENT_LENGTH)
      : null;
  return {
    ipAddress: ip && ip !== "unknown" ? ip : null,
    userAgent,
  };
}

function buildAppUrl(path: string, req?: Request): string | null {
  const origin = getTrustedAppOrigin(req);
  if (!origin) return null;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function deviceLabelFromUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Chrome\//i.test(ua)
          ? "Chrome"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

async function notifyNewSignIn(
  user: { name: string; email: string },
  metadata: SessionMetadata,
): Promise<void> {
  try {
    const { subject, html } = newSignInEmail({
      name: user.name,
      email: user.email,
      signedInAt: new Date(),
      deviceLabel: deviceLabelFromUserAgent(metadata.userAgent),
      ipAddress: metadata.ipAddress ?? null,
      activityUrl: buildAppUrl("/dashboard"),
      changePasswordUrl: buildAppUrl("/change-password"),
      supportEmail: SUPPORT_EMAIL,
    });
    const sent = await sendUserEmail(user.email, subject, html);
    logger.info(
      { email: user.email, sent },
      sent
        ? "New sign-in notification email sent"
        : "New sign-in notification email could not be sent",
    );
  } catch (err) {
    // Never let a failed notification break the underlying sign-in.
    logger.error(
      { err, email: user.email },
      "Failed to send new sign-in notification email",
    );
  }
}

async function notifyAdminAccountLocked(
  user: { id: number; name: string; email: string },
  failureCount: number,
  maxFailures: number,
  req: Request,
): Promise<void> {
  try {
    const { subject, html } = accountLockedAdminEmail({
      user,
      failureCount,
      maxFailures,
      lockedAt: new Date(),
      // The Users page lives at /users inside the admin dashboard, which is
      // mounted at /admin on the public origin.
      usersPageUrl: buildAppUrl("/admin/users", req),
    });
    const sent = await sendAdminEmail(subject, html);
    logger.info(
      { userId: user.id, email: user.email, failureCount, sent },
      sent
        ? "Admin account-locked notification email sent"
        : "Admin account-locked notification email could not be sent",
    );
  } catch (err) {
    // Never let a failed notification break the underlying login flow.
    logger.error(
      { err, userId: user.id, email: user.email },
      "Failed to send admin account-locked notification email",
    );
  }
}

async function notifyUserAccountLocked(
  user: { id: number; name: string; email: string },
  retryAfterMs: number,
  req: Request,
): Promise<void> {
  try {
    // Round up to the nearest whole minute, with a minimum of 1, so the
    // copy never says "auto-unlocks in 0 minutes".
    const unlocksInMinutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
    const { subject, html } = accountLockedUserEmail({
      name: user.name,
      email: user.email,
      lockedAt: new Date(),
      unlocksInMinutes,
      resetPasswordUrl: buildAppUrl("/forgot-password", req),
      supportEmail: SUPPORT_EMAIL,
    });
    const sent = await sendUserEmail(user.email, subject, html);
    logger.info(
      { userId: user.id, email: user.email, unlocksInMinutes, sent },
      sent
        ? "User account-locked notification email sent"
        : "User account-locked notification email could not be sent",
    );
  } catch (err) {
    // Never let a failed notification break the underlying login flow.
    logger.error(
      { err, userId: user.id, email: user.email },
      "Failed to send user account-locked notification email",
    );
  }
}

async function notifyPasswordChanged(
  user: { name: string; email: string },
  method: "reset" | "change",
): Promise<void> {
  try {
    const { subject, html } = passwordChangedEmail({
      name: user.name,
      email: user.email,
      changedAt: new Date(),
      method,
      supportEmail: SUPPORT_EMAIL,
    });
    const sent = await sendUserEmail(user.email, subject, html);
    logger.info(
      { email: user.email, method, sent },
      sent
        ? "Password-changed notification email sent"
        : "Password-changed notification email could not be sent",
    );
  } catch (err) {
    // Never let a failed notification break the underlying password
    // operation — it has already succeeded.
    logger.error(
      { err, email: user.email, method },
      "Failed to send password-changed notification email",
    );
  }
}

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes
const RESET_TOKEN_TTL_MINUTES = 30;

function getTrustedAppOrigin(req?: Request): string | null {
  // 1. Explicit override always wins.
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  // 2. Derive from the live request's forwarded headers.
  //    Replit's production proxy sets X-Forwarded-Host and X-Forwarded-Proto.
  if (req) {
    const fwdHost = req.headers["x-forwarded-host"];
    const fwdProto = req.headers["x-forwarded-proto"];
    const host = (Array.isArray(fwdHost) ? fwdHost[0] : fwdHost)?.split(",")[0].trim();
    const proto = (Array.isArray(fwdProto) ? fwdProto[0] : fwdProto)?.split(",")[0].trim() || "https";
    if (host) return `${proto}://${host}`;
  }

  // 3. Static env fallbacks (dev / CI).
  const replitApp = process.env.REPLIT_APP_DOMAIN?.trim();
  if (replitApp) return `https://${replitApp.replace(/\/$/, "")}`;

  const replitDev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDev) return `https://${replitDev.replace(/\/$/, "")}`;

  return null;
}

function buildResetUrl(token: string, req?: Request): string | null {
  const origin = getTrustedAppOrigin(req);
  if (!origin) return null;
  return `${origin}/reset-password?token=${encodeURIComponent(token)}`;
}

const router = Router();

const MIN_PASSWORD_LENGTH = 8;

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssword", "p@ssw0rd",
  "qwerty", "qwerty123", "qwertyuiop", "12345678", "123456789", "1234567890",
  "11111111", "00000000", "abc12345", "abcd1234", "letmein", "letmein1",
  "welcome", "welcome1", "iloveyou", "admin123", "administrator",
  "monkey123", "football", "baseball", "starwars", "trustno1",
  "sunshine", "princess", "dragon123", "master123", "superman", "batman123",
]);

function validatePassword(password: string): { ok: boolean; error?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: "That password is too common. Please choose a less guessable one." };
  }
  const classes = new Set<string>();
  for (const ch of password) {
    if (/[A-Za-z]/.test(ch)) classes.add("letter");
    else if (/[0-9]/.test(ch)) classes.add("digit");
    else classes.add("symbol");
  }
  if (classes.size < 2) {
    return { ok: false, error: "Password must mix at least two of: letters, numbers, and symbols." };
  }
  return { ok: true };
}

const MAX_INITIAL_BALANCE_USD = 1_000_000;

router.post("/signup", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, initialBalanceUsd, scammedVia } = req.body as {
      name?: string; email?: string; password?: string; initialBalanceUsd?: unknown; scammedVia?: unknown;
    };
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email and password are required." });
      return;
    }
    const trimmedName = name.trim();
    const normalizedEmail = normalizeEmail(email);
    if (!trimmedName) {
      res.status(400).json({ error: "Name is required." });
      return;
    }
    if (!normalizedEmail.includes("@")) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      res.status(400).json({ error: passwordCheck.error ?? "Please choose a stronger password." });
      return;
    }

    // Optional client-supplied starting balance. Validate strictly: must be a
    // finite, non-negative number no larger than MAX_INITIAL_BALANCE_USD. Any
    // other value (including the field being absent) falls back to the default.
    let requestedInitialUsd: number | null = null;
    if (initialBalanceUsd !== undefined && initialBalanceUsd !== null && initialBalanceUsd !== "") {
      const n = typeof initialBalanceUsd === "number"
        ? initialBalanceUsd
        : typeof initialBalanceUsd === "string"
          ? Number(initialBalanceUsd)
          : NaN;
      if (!Number.isFinite(n) || n < 0) {
        res.status(400).json({ error: "Starting balance must be a non-negative number." });
        return;
      }
      if (n > MAX_INITIAL_BALANCE_USD) {
        res.status(400).json({
          error: `Starting balance cannot exceed $${MAX_INITIAL_BALANCE_USD.toLocaleString("en-US")}.`,
        });
        return;
      }
      requestedInitialUsd = n;
    }

    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
      return;
    }

    const hashed = await hashPassword(password);
    const BTC_PRICE = 27000;
    // If the user left "Assets in total" blank on signup, start their balance
    // at 0 instead of the legacy demo default — they explicitly asked for an
    // empty balance.
    const balanceBtc = requestedInitialUsd !== null
      ? requestedInitialUsd / BTC_PRICE
      : 0;

    // Optional "scammed via" intake label collected on the signup form.
    // Trim and cap length so we never store unbounded user input.
    const scammedViaClean =
      typeof scammedVia === "string" && scammedVia.trim().length > 0
        ? scammedVia.trim().slice(0, 120)
        : null;

    const [user] = await db.insert(users).values({
      email: normalizedEmail,
      name: trimmedName,
      passwordHash: hashed.passwordHash,
      passwordSalt: hashed.passwordSalt,
      passwordIterations: hashed.passwordIterations,
      balanceBtc,
      scammedVia: scammedViaClean,
      // Document the signup "Assets in total" figure as the user's reported
      // loss for the Recovery Portal. Null when left blank.
      reportedLossUsd: requestedInitialUsd,
    }).returning();

    const session = await createSession(user.id, captureSessionMetadata(req));

    logger.info({ userId: user.id, email: user.email }, "User signed up");
    res.status(201).json({
      user: publicUser(user),
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to sign up user");
    res.status(500).json({ error: "Failed to create account." });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  // Root-cause analysis (task #38): server-side auth was investigated via curl
  // and confirmed working. The user-facing "wrong password" symptom for newly
  // registered accounts was caused by mobile keyboard autocapitalize / autocorrect
  // silently modifying the password while typing (masked field). Fix: PasswordInput
  // component now sets autoCapitalize="off" autoCorrect="off" spellCheck={false}
  // on all password fields. Diagnostic logging below surfaces any future regressions.
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    // Normalize explicitly at the call site so the login path is self-contained
    // and immune to future changes in how findUserByEmail handles its argument.
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(req);

    // Server-side rate limiting: check before any DB work to stop brute-force
    // attempts that bypass the client-side throttle entirely.
    const throttle = await checkLoginThrottle(normalizedEmail, ip);
    if (!throttle.allowed) {
      logger.warn(
        { email: normalizedEmail, ip, reason: throttle.reason, retryAfterMs: throttle.retryAfterMs },
        "Login attempt rate-limited",
      );
      res.status(429).json({
        error: "Too many login attempts. Please try again later.",
        retryAfterMs: throttle.retryAfterMs,
      });
      return;
    }

    // --- Diagnostic: user lookup ---
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      // No user means there's nobody to name in an admin alert, so we
      // intentionally don't fire one here even if the unknown-email bucket
      // happens to cross the threshold.
      await recordLoginFailure(normalizedEmail);
      logger.warn({ email: normalizedEmail }, "Login failed: no account found for email");
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    // --- Diagnostic: password verification ---
    const ok = await verifyPassword(password, {
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      passwordIterations: user.passwordIterations,
    });
    if (!ok) {
      const failure = await recordLoginFailure(normalizedEmail);
      logger.warn(
        {
          userId: user.id,
          email: normalizedEmail,
          passwordIterations: user.passwordIterations,
          failureCount: failure.failureCount,
          justLocked: failure.justLocked,
        },
        "Login failed: password verification rejected",
      );
      // Alert admins exactly once per lockout window: justLocked is true only
      // on the attempt that crosses the threshold, and subsequent attempts
      // within the same window are short-circuited by checkLoginThrottle
      // before ever reaching recordLoginFailure.
      if (failure.justLocked) {
        void notifyAdminAccountLocked(
          { id: user.id, name: user.name, email: user.email },
          failure.failureCount,
          failure.maxFailures,
          req,
        );
        // Also let the customer know — same justLocked guard means we send
        // at most one user-facing email per lockout window, mirroring the
        // admin-alert dedup behaviour.
        const status = await getAccountThrottleStatus(normalizedEmail);
        void notifyUserAccountLocked(
          { id: user.id, name: user.name, email: user.email },
          status.retryAfterMs,
          req,
        );
      }
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    // Successful login: clear the failure counter so a legitimate user who
    // previously had some failures is not penalized further.
    await clearLoginFailures(normalizedEmail);

    const metadata = captureSessionMetadata(req);

    // Check the historical sessions table BEFORE we insert the new row, so
    // we don't have to exclude the just-created session from the lookup. If
    // we've never seen this (ipAddress, userAgent) pair for this user, fire
    // the "new sign-in" email. This intentionally also fires on the very
    // first login after signup — the user's first device is itself a "new
    // device" by definition, and a confirmation email at account creation
    // is a security signal worth keeping.
    const historicallySeen = await hasSeenSessionMetadata({
      userId: user.id,
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
    });

    // --- Diagnostic: session creation ---
    const session = await createSession(user.id, metadata);
    logger.info(
      { userId: user.id, email: normalizedEmail, sessionExpiresAt: session.expiresAt },
      "User signed in",
    );

    if (!historicallySeen && resolveNotificationPreferences(user.notificationPreferences).newSignIn) {
      // Fire-and-forget: a failed email must not break sign-in.
      void notifyNewSignIn({ name: user.name, email: user.email }, metadata);
    }

    res.json({
      user: publicUser(user),
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to sign in user");
    res.status(500).json({ error: "Failed to sign in." });
  }
});

router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (token) {
      await deleteSessionByToken(token);
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to log out");
    res.status(500).json({ error: "Failed to log out." });
  }
});

router.post("/exists", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "Email is required." });
      return;
    }
    const normalized = normalizeEmail(email);
    if (!normalized.includes("@")) {
      res.json({ exists: false });
      return;
    }
    const user = await findUserByEmail(normalized);
    res.json({ exists: !!user });
  } catch (err) {
    logger.error({ err }, "Failed to check account existence");
    res.status(500).json({ error: "Failed to look up account." });
  }
});

router.post("/change-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "You must be signed in to change your password." });
      return;
    }
    const sessionUser = await findUserBySessionToken(token);
    if (!sessionUser) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string; newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current and new password are required." });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ error: "New password must be different from your current password." });
      return;
    }
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      res.status(400).json({ error: passwordCheck.error ?? "Please choose a stronger password." });
      return;
    }
    const ok = await verifyPassword(currentPassword, {
      passwordHash: sessionUser.passwordHash,
      passwordSalt: sessionUser.passwordSalt,
      passwordIterations: sessionUser.passwordIterations,
    });
    if (!ok) {
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }
    const hashed = await hashPassword(newPassword);
    await db.update(users)
      .set({
        passwordHash: hashed.passwordHash,
        passwordSalt: hashed.passwordSalt,
        passwordIterations: hashed.passwordIterations,
      })
      .where(eq(users.id, sessionUser.id));

    // Revoke all other sessions for this user. The caller's own session
    // remains active so they don't get immediately signed out.
    const currentSession = await findSessionWithUser(token);
    if (currentSession) {
      await deleteAllUserSessions(sessionUser.id, currentSession.session.id);
    }

    logger.info({ userId: sessionUser.id }, "User changed password; other sessions revoked");
    void notifyPasswordChanged(
      { name: sessionUser.name, email: sessionUser.email },
      "change",
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to change password");
    res.status(500).json({ error: "Failed to change password." });
  }
});

router.post("/set-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "You must be signed in to set a password." });
      return;
    }
    const sessionUser = await findUserBySessionToken(token);
    if (!sessionUser) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }
    // This endpoint is only for accounts that don't yet have a password —
    // typically users who signed up via Google or Apple. Users who already
    // have a password must use /change-password and prove they know the
    // current one.
    if (sessionUser.passwordHash) {
      res.status(409).json({
        error: "Your account already has a password. Use change password instead.",
      });
      return;
    }
    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword) {
      res.status(400).json({ error: "New password is required." });
      return;
    }
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      res.status(400).json({ error: passwordCheck.error ?? "Please choose a stronger password." });
      return;
    }
    const hashed = await hashPassword(newPassword);
    await db.update(users)
      .set({
        passwordHash: hashed.passwordHash,
        passwordSalt: hashed.passwordSalt,
        passwordIterations: hashed.passwordIterations,
      })
      .where(eq(users.id, sessionUser.id));

    // Revoke all other sessions for this user, mirroring /change-password.
    // The caller's own session remains active so they don't get immediately
    // signed out.
    const currentSession = await findSessionWithUser(token);
    if (currentSession) {
      await deleteAllUserSessions(sessionUser.id, currentSession.session.id);
    }

    logger.info(
      { userId: sessionUser.id },
      "User set initial password; other sessions revoked",
    );
    void notifyPasswordChanged(
      { name: sessionUser.name, email: sessionUser.email },
      "change",
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to set initial password");
    res.status(500).json({ error: "Failed to set password." });
  }
});

router.post("/forgot-password", async (req: Request, res: Response): Promise<void> => {
  // Always return 200 OK regardless of whether the account exists, the
  // payload was malformed, or anything internal failed. This prevents
  // attackers from enumerating which emails are registered.
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== "string") {
      res.json({ ok: true });
      return;
    }

    const normalized = normalizeEmail(email);
    if (!normalized.includes("@")) {
      res.json({ ok: true });
      return;
    }

    const ip = getClientIp(req);
    const throttle = checkForgotPasswordThrottle(normalized, ip);
    if (!throttle.allowed) {
      logger.warn(
        {
          email: normalized,
          ip,
          reason: throttle.reason,
          emailCount: throttle.emailCount,
          ipCount: throttle.ipCount,
          retryAfterMs: throttle.retryAfterMs,
        },
        "Forgot-password request throttled",
      );
      // Still return 200 to avoid leaking that an account exists or that
      // we recognized the request as abusive.
      res.json({ ok: true });
      return;
    }
    logger.info(
      {
        email: normalized,
        ip,
        emailCount: throttle.emailCount,
        ipCount: throttle.ipCount,
      },
      "Forgot-password request accepted by throttle",
    );

    const user = await findUserByEmail(normalized);
    if (!user) {
      logger.info({ email: normalized }, "Password reset requested for unknown account");
      res.json({ ok: true });
      return;
    }

    // Invalidate any outstanding reset tokens for this user so old links can't
    // be used after a fresh request.
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = buildResetUrl(rawToken, req);
    if (!resetUrl) {
      logger.error(
        { userId: user.id },
        "Cannot send password reset email: no app origin could be determined.",
      );
    } else {
      const { subject, html } = passwordResetEmail({
        name: user.name,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      });
      const emailSent = await sendUserEmail(user.email, subject, html);
      logger.info(
        { userId: user.id, emailSent },
        emailSent
          ? "Password reset email sent"
          : "Password reset token issued but email could not be sent",
      );
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to process forgot-password request");
    // Even on internal errors, respond 200 to avoid leaking information.
    res.json({ ok: true });
  }
});

async function loadValidResetToken(token: string) {
  const tokenHash = hashResetToken(token);
  const [row] = await db
    .select({
      reset: passwordResetTokens,
      user: users,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    );
  return row;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}*@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

router.get("/reset-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res.status(400).json({ valid: false, error: "Missing reset token." });
      return;
    }
    const row = await loadValidResetToken(token);
    if (!row) {
      res.status(400).json({
        valid: false,
        error: "This password reset link is invalid or has expired. Please request a new one.",
      });
      return;
    }
    res.json({
      valid: true,
      email: maskEmail(row.user.email),
      expiresAt: row.reset.expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to validate reset token");
    res.status(500).json({ valid: false, error: "Failed to validate reset link." });
  }
});

router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword) {
      res.status(400).json({ error: "Reset token and new password are required." });
      return;
    }
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      res.status(400).json({ error: passwordCheck.error ?? "Please choose a stronger password." });
      return;
    }

    const row = await loadValidResetToken(token);
    if (!row) {
      res.status(400).json({
        error: "This password reset link is invalid or has expired. Please request a new one.",
      });
      return;
    }

    // Atomically claim the token: only proceed if exactly one row was
    // updated (i.e. the token is still unused and unexpired). This closes
    // the race window between validating and consuming the token if two
    // requests arrive concurrently with the same link.
    const claimed = await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.id, row.reset.id),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ id: passwordResetTokens.id });
    if (claimed.length !== 1) {
      res.status(400).json({
        error: "This password reset link is invalid or has expired. Please request a new one.",
      });
      return;
    }

    const hashed = await hashPassword(newPassword);
    await db.update(users)
      .set({
        passwordHash: hashed.passwordHash,
        passwordSalt: hashed.passwordSalt,
        passwordIterations: hashed.passwordIterations,
      })
      .where(eq(users.id, row.user.id));

    // Revoke ALL existing sessions before issuing a fresh one. If an
    // attacker had a stolen token, it stops working the moment the victim
    // resets their password.
    await deleteAllUserSessions(row.user.id);

    // Sign the user in immediately so they don't have to re-enter their new password.
    const session = await createSession(row.user.id, captureSessionMetadata(req));
    logger.info({ userId: row.user.id }, "User reset password via email link; all prior sessions revoked");
    void notifyPasswordChanged(
      { name: row.user.name, email: row.user.email },
      "reset",
    );
    res.json({
      user: publicUser(row.user),
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to reset password");
    res.status(500).json({ error: "Failed to reset password." });
  }
});

router.get("/me", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const user = await findUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    // Check whether this user has an approved/active record in admin_clients.
    // This gates access to the Recovery Portal: only approved clients may enter.
    const [clientRow] = await db
      .select({ status: adminClients.status })
      .from(adminClients)
      .where(eq(adminClients.email, user.email))
      .limit(1);
    const portalAccess =
      clientRow?.status === "approved" || clientRow?.status === "active";

    // Social (e.g. Google) signups skip the signup form, so they have no
    // documented loss details yet. The SPA uses this flag to pop up the
    // intake modal until the details are provided.
    const needsIntake = user.reportedLossUsd === null || !user.scammedVia;

    res.json({ user: { ...publicUser(user), portalAccess, needsIntake } });
  } catch (err) {
    logger.error({ err }, "Failed to load session user");
    res.status(500).json({ error: "Failed to load session." });
  }
});

// Recovery metrics ----------------------------------------------------------
//
// Personal figures for the Recovery Portal dashboard. Reported loss comes
// from the documented "Assets in total ($)" signup/intake figure; recovered
// is the cumulative amount credited to the vault by admins; at-risk is the
// derived remainder. The composite risk score is derived from how much of
// the reported loss is still at risk.

export function computeRecoveryMetrics(user: {
  reportedLossUsd: number | null;
  recoveredUsd: number;
}): {
  reportedLossUsd: number;
  recoveredUsd: number;
  atRiskUsd: number;
  recoveryRatePct: number;
  riskScore: number;
  documented: boolean;
} {
  const reported = user.reportedLossUsd ?? 0;
  const recovered = Math.min(Math.max(user.recoveredUsd ?? 0, 0), reported > 0 ? reported : user.recoveredUsd ?? 0);
  const atRisk = Math.max(0, reported - recovered);
  const recoveryRatePct = reported > 0 ? Math.round((recovered / reported) * 100) : 0;
  // Higher share of funds still at risk -> higher composite risk score.
  const riskScore = reported > 0
    ? Math.min(95, Math.max(5, Math.round((atRisk / reported) * 90) + 5))
    : 0;
  return {
    reportedLossUsd: reported,
    recoveredUsd: recovered,
    atRiskUsd: atRisk,
    recoveryRatePct,
    riskScore,
    documented: user.reportedLossUsd !== null,
  };
}

router.get("/recovery-metrics", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const user = await findUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }
    res.json({ metrics: computeRecoveryMetrics(user), scammedVia: user.scammedVia ?? null });
  } catch (err) {
    logger.error({ err }, "Failed to load recovery metrics");
    res.status(500).json({ error: "Failed to load recovery metrics." });
  }
});

// Per-user ledger of recovery credits. Each admin "record recovery" action
// writes a `user_recovery_recorded` row to admin_activity_log with the target
// userId in metadata; this endpoint exposes only the caller's own entries so
// the Recovery Portal can render a credit-by-credit timeline.
router.get("/recovery-history", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const user = await findUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    // Cursor pagination (newest first): `before` is the id of the oldest entry
    // the client already has; we return the next page strictly older than it.
    // Fetch one extra row to know whether more pages remain.
    const PAGE_SIZE = 50;
    const rawBefore = req.query.before;
    const before = Number.parseInt(String(Array.isArray(rawBefore) ? rawBefore[0] : rawBefore ?? ""), 10);
    const cursorFilter =
      Number.isInteger(before) && before > 0
        ? sql` AND ${adminActivityLog.id} < ${before}`
        : sql``;

    const rows = await db
      .select({
        id: adminActivityLog.id,
        metadata: adminActivityLog.metadata,
        createdAt: adminActivityLog.createdAt,
      })
      .from(adminActivityLog)
      .where(
        sql`${adminActivityLog.eventType} = 'user_recovery_recorded' AND (${adminActivityLog.metadata}->>'userId')::int = ${user.id}${cursorFilter}`,
      )
      .orderBy(desc(adminActivityLog.id))
      .limit(PAGE_SIZE + 1);

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    // Project only the fields the client needs; never leak the admin-facing
    // description or unrelated metadata keys.
    const entries = page
      .map((r) => {
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        const amountUsd = typeof meta.amountUsd === "number" ? meta.amountUsd : Number(meta.amountUsd);
        const runningTotalUsd =
          typeof meta.recoveredUsd === "number" ? meta.recoveredUsd : null;
        if (!Number.isFinite(amountUsd)) return null;
        return {
          id: r.id,
          amountUsd,
          runningTotalUsd,
          creditedAt: r.createdAt.toISOString(),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    res.json({
      entries,
      hasMore,
      // Cursor for the next (older) page: the id of the last raw row in this
      // page, regardless of whether its metadata parsed cleanly.
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load recovery history");
    res.status(500).json({ error: "Failed to load recovery history." });
  }
});

// Post-social-signup intake: collect the same details the signup form asks
// for (Assets in total, scammed via). Only fills fields that are still
// undocumented — it never overwrites an existing reported loss.
router.post("/intake", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const user = await findUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    const { assetsTotalUsd, scammedVia } = req.body as {
      assetsTotalUsd?: unknown;
      scammedVia?: unknown;
    };

    let requestedUsd: number | null = null;
    if (assetsTotalUsd !== undefined && assetsTotalUsd !== null && assetsTotalUsd !== "") {
      const n = typeof assetsTotalUsd === "number"
        ? assetsTotalUsd
        : typeof assetsTotalUsd === "string"
          ? Number(assetsTotalUsd)
          : NaN;
      if (!Number.isFinite(n) || n < 0) {
        res.status(400).json({ error: "Assets total must be a non-negative number." });
        return;
      }
      if (n > MAX_INITIAL_BALANCE_USD) {
        res.status(400).json({
          error: `Assets total cannot exceed $${MAX_INITIAL_BALANCE_USD.toLocaleString("en-US")}.`,
        });
        return;
      }
      requestedUsd = n;
    }

    const scammedViaClean =
      typeof scammedVia === "string" && scammedVia.trim().length > 0
        ? scammedVia.trim().slice(0, 120)
        : null;

    // Both details are required for the case to count as documented — a
    // partial submission must not dismiss the intake popup for good.
    if ((user.reportedLossUsd === null && requestedUsd === null) || (!user.scammedVia && !scammedViaClean)) {
      res.status(400).json({ error: "Please provide your assets total and how you were scammed." });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (user.reportedLossUsd === null && requestedUsd !== null) {
      updates.reportedLossUsd = requestedUsd;
      // Mirror the signup flow: the documented assets total also becomes the
      // user's available portfolio balance (social signups otherwise keep the
      // schema default).
      const BTC_PRICE = 27000;
      updates.balanceBtc = requestedUsd / BTC_PRICE;
    }
    if (!user.scammedVia && scammedViaClean) {
      updates.scammedVia = scammedViaClean;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();

    logger.info(
      { userId: user.id, documentedLoss: updated.reportedLossUsd },
      "User completed post-signup intake",
    );
    res.json({
      ok: true,
      metrics: computeRecoveryMetrics(updated),
      needsIntake: updated.reportedLossUsd === null || !updated.scammedVia,
    });
  } catch (err) {
    logger.error({ err }, "Failed to save intake details");
    res.status(500).json({ error: "Failed to save your details." });
  }
});

// Notification preferences -------------------------------------------------
//
// Security-critical alerts (password changed) are mandatory and never appear in
// the togglable set. The client uses `mandatory` to render those categories as
// locked-on.
const MANDATORY_NOTIFICATIONS = ["passwordChanged"] as const;

router.get("/preferences", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const user = await findUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }
    res.json({
      preferences: resolveNotificationPreferences(user.notificationPreferences),
      mandatory: MANDATORY_NOTIFICATIONS,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load notification preferences");
    res.status(500).json({ error: "Failed to load notification preferences." });
  }
});

router.patch("/preferences", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const user = await findUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    // Start from the user's current resolved preferences so a partial update
    // (e.g. only toggling kycDecisions) leaves other categories untouched.
    const current = resolveNotificationPreferences(user.notificationPreferences);
    const next = {
      kycDecisions:
        typeof body.kycDecisions === "boolean" ? body.kycDecisions : current.kycDecisions,
      newSignIn:
        typeof body.newSignIn === "boolean" ? body.newSignIn : current.newSignIn,
      recoveryCredits:
        typeof body.recoveryCredits === "boolean" ? body.recoveryCredits : current.recoveryCredits,
    };

    await db
      .update(users)
      .set({ notificationPreferences: next, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({ preferences: next, mandatory: MANDATORY_NOTIFICATIONS });
  } catch (err) {
    logger.error({ err }, "Failed to update notification preferences");
    res.status(500).json({ error: "Failed to update notification preferences." });
  }
});

const SESSIONS_LIST_LIMIT = 10;

router.get("/sessions", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const current = await findSessionWithUser(token);
    if (!current) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    const rows = await db
      .select({
        id: userSessions.id,
        createdAt: userSessions.createdAt,
        expiresAt: userSessions.expiresAt,
        ipAddress: userSessions.ipAddress,
        userAgent: userSessions.userAgent,
      })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, current.user.id),
          gt(userSessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(userSessions.createdAt))
      .limit(SESSIONS_LIST_LIMIT);

    // Resolve coarse "City, CC" labels in parallel. Each lookup is
    // cached in-process and bounded by a short timeout, so a slow upstream
    // can't block the whole response.
    const locations = await Promise.all(
      rows.map((row) => lookupLocation(row.ipAddress)),
    );

    // Count this user's currently-open withdrawal requests so the client
     // can warn before "Sign out all other devices". Requests are linked to
     // the user by email (admin_clients.email == users.email). We treat
     // status='pending' withdrawal requests as "in flight". The count is
     // user-wide (per-session attribution isn't tracked), which is the
     // correct granularity for the dialog warning.
     const pendingRows = await db
       .select({ n: sql<number>`count(*)::int` })
       .from(adminServiceRequests)
       .innerJoin(adminClients, eq(adminServiceRequests.clientId, adminClients.id))
       .where(
         and(
           eq(adminClients.email, current.user.email),
           eq(adminServiceRequests.type, "withdrawal"),
           eq(adminServiceRequests.status, "pending"),
         ),
       );
     const pendingWithdrawalCount = pendingRows[0]?.n ?? 0;

    res.json({
      pendingWithdrawalCount,
      sessions: rows.map((row, i) => {
        const loc = locations[i] ?? null;
        return {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          location: loc?.label ?? null,
          countryCode: loc?.countryCode ?? null,
          current: row.id === current.session.id,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "Failed to load recent sessions");
    res.status(500).json({ error: "Failed to load recent activity." });
  }
});

router.post("/sessions/revoke-all-others", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const current = await findSessionWithUser(token);
    if (!current) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    const deleted = await db
      .delete(userSessions)
      .where(
        and(
          eq(userSessions.userId, current.user.id),
          ne(userSessions.id, current.session.id),
        ),
      )
      .returning({ id: userSessions.id });

    logger.info(
      { userId: current.user.id, revoked: deleted.length },
      "User revoked all other sessions",
    );
    res.json({ revoked: deleted.length });
  } catch (err) {
    logger.error({ err }, "Failed to revoke all other sessions");
    res.status(500).json({ error: "Failed to sign out other devices." });
  }
});

router.delete("/sessions/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const current = await findSessionWithUser(token);
    if (!current) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    const rawId = req.params.id;
    // Strict: reject anything that isn't a pure positive integer string
    // (e.g. "1abc" must NOT be silently accepted as 1).
    if (typeof rawId !== "string" || !/^[1-9]\d*$/.test(rawId)) {
      res.status(400).json({ error: "Invalid session id." });
      return;
    }
    const sessionId = Number.parseInt(rawId, 10);
    if (!Number.isSafeInteger(sessionId)) {
      res.status(400).json({ error: "Invalid session id." });
      return;
    }

    // Disallow revoking the current session via this endpoint — the user
    // should use POST /logout for that. Otherwise calling DELETE on the
    // current session would silently sign them out without clearing their
    // local token state.
    if (sessionId === current.session.id) {
      res.status(400).json({
        error: "Use sign out to end your current session.",
      });
      return;
    }

    // Delete ONLY a row that matches both the id and the current user.
    // Using `.returning()` lets us tell whether anything was actually
    // deleted, so a request for someone else's session id falls into the
    // 404 branch instead of silently succeeding.
    const deleted = await db
      .delete(userSessions)
      .where(
        and(
          eq(userSessions.id, sessionId),
          eq(userSessions.userId, current.user.id),
        ),
      )
      .returning({ id: userSessions.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    logger.info(
      { userId: current.user.id, sessionId },
      "User revoked a session from the activity panel",
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to revoke session");
    res.status(500).json({ error: "Failed to sign out that device." });
  }
});

router.get("/balance", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) { res.status(401).json({ error: "Unauthorized." }); return; }
    const sessionUser = await findUserBySessionToken(token);
    if (!sessionUser) { res.status(401).json({ error: "Session expired." }); return; }
    res.json({ balanceBtc: sessionUser.balanceBtc ?? 0 });
  } catch (err) {
    logger.error({ err }, "Failed to fetch balance");
    res.status(500).json({ error: "Failed to fetch balance." });
  }
});


router.get("/balance-directive", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const sessionUser = await findUserBySessionToken(token);
    if (!sessionUser) {
      res.status(401).json({ error: "Session expired." });
      return;
    }
    const debitAllAt = sessionUser.debitAllAt ?? null;
    res.json({
      debitAll: debitAllAt !== null,
      requestedAt: debitAllAt ? debitAllAt.toISOString() : null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch balance directive");
    res.status(500).json({ error: "Failed to fetch balance directive." });
  }
});

export default router;
