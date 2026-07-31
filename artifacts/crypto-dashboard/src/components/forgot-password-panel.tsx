import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

type ForgotStep = "email" | "sent";

interface ForgotPasswordPanelProps {
  onClose: () => void;
}

export function ForgotPasswordPanel({ onClose }: ForgotPasswordPanelProps) {
  const { forgotPassword } = useAuth();
  const [step, setStep] = useState<ForgotStep>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter the email address for your account.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(trimmed);
      setStep("sent");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send reset link. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">C</span>
          </div>
          <span className="text-xl font-bold text-foreground">CryptoVault</span>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-8">
          {step === "sent" ? (
            <div className="text-center" data-testid="forgot-sent">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Check your email</h2>
              <p className="text-muted-foreground mb-2 text-sm">
                If an account exists for{" "}
                <strong className="text-foreground">{email}</strong>, we've sent a password
                reset link to that address.
              </p>
              <p className="text-muted-foreground mb-6 text-xs">
                The link expires in 30 minutes. Be sure to check your spam folder.
              </p>
              <button
                onClick={onClose}
                data-testid="forgot-back-to-signin"
                className="text-primary hover:underline text-sm font-medium"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Sign In
              </button>

              <h2 className="text-2xl font-bold text-foreground mb-2">Reset password</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                Enter the email for your account and we'll send you a link to reset your
                password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    data-testid="forgot-email-input"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    required
                  />
                </div>

                {error && (
                  <div
                    data-testid="forgot-error"
                    className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  data-testid="forgot-continue"
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
