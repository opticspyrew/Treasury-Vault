import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { getPasswordStrengthHint, validatePassword } from "@/lib/password-policy";
import PasswordInput from "@/components/password-input";
import PasswordRulesChecklist from "@/components/password-rules-checklist";

export default function SetPassword() {
  const [, navigate] = useLocation();
  const { user, setPassword } = useAuth();
  const [form, setForm] = useState({ next: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const strengthHint = useMemo(
    () => getPasswordStrengthHint(form.next),
    [form.next],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.next || !form.confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.next !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }
    const policy = validatePassword(form.next);
    if (!policy.ok) {
      setError(policy.error ?? "Please choose a stronger password.");
      return;
    }

    setLoading(true);
    try {
      await setPassword(form.next);
      setSuccess(true);
      setForm({ next: "", confirm: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout activeTab="connected-accounts">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Set a password</h1>
          <p className="text-muted-foreground text-sm">
            Add a password to{" "}
            <span className="text-foreground font-medium">{user?.email ?? "your account"}</span>{" "}
            so you can sign in without Google.
          </p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                New password
              </label>
              <PasswordInput
                autoComplete="new-password"
                value={form.next}
                onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
                placeholder="Min. 8 chars, mix letters & numbers"
                className="px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
                aria-describedby="set-password-rules set-password-strength-hint"
                data-testid="set-password-new"
              />
              <PasswordRulesChecklist
                id="set-password-rules"
                password={form.next}
              />
              {strengthHint && (
                <p
                  id="set-password-strength-hint"
                  data-testid="set-password-strength-hint"
                  className={
                    "mt-1.5 text-xs " +
                    (strengthHint.level === "strong"
                      ? "text-emerald-500"
                      : strengthHint.level === "fair"
                        ? "text-amber-500"
                        : "text-muted-foreground")
                  }
                >
                  {strengthHint.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Confirm new password
              </label>
              <PasswordInput
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="••••••••"
                className="px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
                data-testid="set-password-confirm"
              />
            </div>

            {success && (
              <div
                data-testid="set-password-success"
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm"
              >
                Password set. You can now sign in with your email and password.
              </div>
            )}

            {error && (
              <div
                data-testid="set-password-error"
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              >
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                data-testid="set-password-submit"
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Setting…
                  </>
                ) : (
                  "Set password"
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate("/connected-accounts")}
                className="py-2.5 px-5 bg-muted text-foreground rounded-xl font-semibold text-sm hover:bg-muted/80 transition-colors"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
