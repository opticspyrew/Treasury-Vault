import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeftRight, Lock, ScanLine, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  LoginLockoutError,
  formatRemaining,
  getLockoutState,
  subscribe,
} from "@/lib/login-throttle";
import PasswordInput from "@/components/password-input";
import RefundsLogo from "../components/refunds-logo";

export default function RefundsSignIn() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockMs, setLockMs] = useState(0);

  useEffect(() => {
    const refresh = () => setLockMs(getLockoutState(form.email).msRemaining);
    refresh();
    const tick = window.setInterval(refresh, 500);
    const unsub = subscribe(refresh);
    return () => {
      window.clearInterval(tick);
      unsub();
    };
  }, [form.email]);

  const locked = lockMs > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("Please enter your email and password.");
      return;
    }
    if (locked) return;
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/refunds/portal");
    } catch (err) {
      if (err instanceof LoginLockoutError) {
        setLockMs(err.msRemaining);
      } else {
        setError("Incorrect email or password. Check that Caps Lock is off, or use the eye icon to verify what you typed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="refunds-scope min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 -z-10 refunds-vault-bg" />
      <div className="absolute inset-0 -z-10 refunds-grid-bg opacity-40" />

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <RefundsLogo size={44} animateUnlock />
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] font-semibold text-primary">
            Secure recovery console
          </p>
        </div>

        <div className="refunds-glass rounded-2xl p-7">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Sign in to your vault</h1>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Sessions are end-to-end encrypted (E2EE-AES-256). We will never ask for your seed phrase.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@firm.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                data-testid="refunds-signin-email"
                className="w-full px-3 py-2.5 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Password</label>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="current-password"
                className="px-3 py-2.5 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {locked && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                Too many failed attempts. Please wait{" "}
                <strong>{formatRemaining(lockMs)}</strong> before trying again.
              </div>
            )}
            {error && !locked && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || locked}
              data-testid="refunds-signin-submit"
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <ScanLine className="w-4 h-4 animate-pulse" /> Verifying…
                </>
              ) : locked ? (
                `Try again in ${formatRemaining(lockMs)}`
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Enter vault
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            New to Netspy-World Forensics?{" "}
            <button
              onClick={() => navigate("/refunds/sign-up")}
              className="text-primary hover:underline font-semibold"
            >
              Open a secure account
            </button>
          </p>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          By signing in you accept the Netspy-World Forensics terms and acknowledge that
          recovery outcomes are not guaranteed.
        </p>

        <div className="mt-5 flex justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            data-testid="refunds-to-dashboard"
            aria-label="Open crypto dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-foreground rounded-lg border border-card-border bg-card/40 hover:bg-card/70 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
            Crypto Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
