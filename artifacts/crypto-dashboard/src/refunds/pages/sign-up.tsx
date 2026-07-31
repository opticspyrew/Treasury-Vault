import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeftRight, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { validatePassword } from "@/lib/password-policy";
import PasswordInput from "@/components/password-input";
import PasswordRulesChecklist from "@/components/password-rules-checklist";
import RefundsLogo from "../components/refunds-logo";

export default function RefundsSignUp() {
  const [, navigate] = useLocation();
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("Please complete every field.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    const check = validatePassword(form.password);
    if (!check.ok) {
      setError(check.error ?? "Please choose a stronger password.");
      return;
    }
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, 0, "Netspy-World Forensics intake");
      navigate("/refunds/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open account.");
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
          <RefundsLogo size={44} />
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] font-semibold text-primary">
            Secure account onboarding
          </p>
        </div>

        <div className="refunds-glass rounded-2xl p-7">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Open a recovery vault</h1>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            We collect the minimum information needed to assign your case. Identity
            verification happens later, only when required by counsel or counterparties.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Full name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jordan Allen"
                autoComplete="name"
                className="w-full px-3 py-2.5 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Work email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@firm.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                className="w-full px-3 py-2.5 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Password</label>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="At least 8 characters, mix of letters & numbers"
                autoComplete="new-password"
                className="px-3 py-2.5 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <PasswordRulesChecklist password={form.password} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Confirm password</label>
              <PasswordInput
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
                className="px-3 py-2.5 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="refunds-signup-submit"
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" /> {loading ? "Provisioning vault…" : "Create secure account"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/refunds/sign-in")}
              className="text-primary hover:underline font-semibold"
            >
              Sign in
            </button>
          </p>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Netspy-World Forensics does not custody assets and cannot reverse on-chain transactions.
          Recovery outcomes are not guaranteed.
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
