import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import { getPasswordStrengthHint, validatePassword } from "@/lib/password-policy";
import PasswordInput from "@/components/password-input";
import PasswordRulesChecklist from "@/components/password-rules-checklist";

type Status = "validating" | "valid" | "invalid" | "submitting" | "done";

function getTokenFromQuery(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
}

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { resetPasswordWithToken } = useAuth();
  const [token] = useState<string>(() => getTokenFromQuery());
  const [status, setStatus] = useState<Status>("validating");
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const [tokenError, setTokenError] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const strengthHint = useMemo(
    () => getPasswordStrengthHint(password),
    [password],
  );

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setTokenError("This password reset link is missing its token. Please request a new one.");
      setStatus("invalid");
      return;
    }
    (async () => {
      const result = await authApi.validateResetToken(token);
      if (cancelled) return;
      if (!result.valid) {
        setTokenError(
          result.error ||
            "This password reset link is invalid or has expired. Please request a new one.",
        );
        setStatus("invalid");
        return;
      }
      setMaskedEmail(result.email ?? "");
      setStatus("valid");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || !confirm) {
      setError("Please fill in both password fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const policy = validatePassword(password);
    if (!policy.ok) {
      setError(policy.error ?? "Please choose a stronger password.");
      return;
    }
    setStatus("submitting");
    try {
      await resetPasswordWithToken(token, password);
      setStatus("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password. Please try again.",
      );
      setStatus("valid");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center mb-10">
          <img src="/treasury-vault-logo.jpg" alt="Treasury Vault" className="h-12 w-auto rounded-xl bg-white object-contain" />
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-8">
          {status === "validating" && (
            <div className="text-center py-6" data-testid="reset-validating">
              <svg className="animate-spin w-8 h-8 mx-auto text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-muted-foreground">Checking your reset link...</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="text-center" data-testid="reset-invalid">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Link not valid</h2>
              <p className="text-muted-foreground mb-6 text-sm" data-testid="reset-invalid-error">
                {tokenError}
              </p>
              <button
                onClick={() => navigate("/sign-in")}
                data-testid="reset-back-to-signin"
                className="text-primary hover:underline text-sm font-medium"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {status === "done" && (
            <div className="text-center" data-testid="reset-done">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Password updated</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                You're now signed in with your new password.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                data-testid="reset-go-dashboard"
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {(status === "valid" || status === "submitting") && (
            <>
              <h2 className="text-2xl font-bold text-foreground mb-2">Set a new password</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                {maskedEmail ? (
                  <>
                    Resetting password for{" "}
                    <strong className="text-foreground" data-testid="reset-masked-email">
                      {maskedEmail}
                    </strong>
                    .
                  </>
                ) : (
                  "Choose a new password for your account."
                )}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    New password
                  </label>
                  <PasswordInput
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 chars, mix letters & numbers"
                    aria-describedby="reset-password-rules reset-strength-hint"
                    data-testid="reset-new-password"
                    className="px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  <PasswordRulesChecklist
                    id="reset-password-rules"
                    password={password}
                  />
                  {strengthHint && (
                    <p
                      id="reset-strength-hint"
                      data-testid="reset-strength-hint"
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
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    data-testid="reset-confirm-password"
                    className="px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                {error && (
                  <div
                    data-testid="reset-error"
                    className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  data-testid="reset-submit"
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {status === "submitting" ? "Updating..." : "Reset password"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/sign-in")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to Sign In
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
