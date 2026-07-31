import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  LoginLockoutError,
  formatRemaining,
  getLockoutState,
  subscribe,
} from "@/lib/login-throttle";
import { ForgotPasswordPanel } from "@/components/forgot-password-panel";
import PasswordInput from "@/components/password-input";
import SocialAuthButtons from "@/components/social-auth-buttons";
import TotalAssetsBanner from "@/components/total-assets-banner";

export default function SignIn() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState<{ email: string; password: string }>(() => {
    let prefilledEmail = "";
    try {
      prefilledEmail = sessionStorage.getItem("prefill-signin-email") ?? "";
      if (prefilledEmail) sessionStorage.removeItem("prefill-signin-email");
    } catch {
      // ignore storage errors
    }
    return { email: prefilledEmail, password: "" };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [lockMsRemaining, setLockMsRemaining] = useState(0);
  const [socialError, setSocialError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("social_error");
    if (code) {
      params.delete("social_error");
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      window.history.replaceState(null, "", url);
    }
    return code;
  });
  void setSocialError;

  useEffect(() => {
    const refresh = () => {
      const { msRemaining } = getLockoutState(form.email);
      setLockMsRemaining(msRemaining);
    };
    refresh();
    const tick = window.setInterval(refresh, 500);
    const unsubscribe = subscribe(refresh);
    return () => {
      window.clearInterval(tick);
      unsubscribe();
    };
  }, [form.email]);

  const isLocked = lockMsRemaining > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (isLocked) {
      return;
    }
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof LoginLockoutError) {
        setLockMsRemaining(err.msRemaining);
      } else {
        const fresh = getLockoutState(form.email);
        if (fresh.locked) {
          setLockMsRemaining(fresh.msRemaining);
        } else {
          setError("Incorrect email or password. Check that Caps Lock is off, or use the eye icon to verify what you typed.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (showForgot) {
    return <ForgotPasswordPanel onClose={() => setShowForgot(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center mb-10">
          <img src="/treasury-vault-logo.jpg" alt="Treasury Vault" className="h-12 w-auto rounded-xl bg-white object-contain" />
        </div>

        <TotalAssetsBanner />

        <div className="bg-card border border-card-border rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-6">Sign in to your account to continue</p>

          <div className="mb-5">
            <SocialAuthButtons mode="signin" errorCode={socialError} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="current-password"
                className="px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
              />
            </div>

            {isLocked && (
              <div
                data-testid="signin-lockout-banner"
                className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm"
              >
                Too many failed sign-in attempts. Please wait{" "}
                <strong className="text-amber-300">{formatRemaining(lockMsRemaining)}</strong>{" "}
                before trying again.
              </div>
            )}

            {error && !isLocked && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isLocked}
              data-testid="signin-submit"
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : isLocked ? (
                `Try again in ${formatRemaining(lockMsRemaining)}`
              ) : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/sign-up")}
              className="text-primary hover:underline font-medium"
            >
              Sign up
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
