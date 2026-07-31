import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getPasswordStrengthHint, validatePassword } from "@/lib/password-policy";
import PasswordRulesChecklist from "@/components/password-rules-checklist";
import { ForgotPasswordPanel } from "@/components/forgot-password-panel";
import PasswordInput from "@/components/password-input";
import SocialAuthButtons from "@/components/social-auth-buttons";
import TotalAssetsBanner from "@/components/total-assets-banner";

export default function SignUp() {
  const [, navigate] = useLocation();
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", assets: "" });
  const [scammedVia, setScammedVia] = useState<"" | "Crypto" | "Giftcard" | "Bank Transfer/ACH" | "Payment Firm">("");
  const [paymentFirm, setPaymentFirm] = useState("");
  const [cryptoKind, setCryptoKind] = useState("");
  const [giftcardKind, setGiftcardKind] = useState("");

  const PAYMENT_FIRMS = ["CashApp", "Zelle", "GCash", "Venmo", "PayPal", "Apple Pay", "Google Pay", "Wise", "Revolut", "Other"];
  const CRYPTOS = ["Bitcoin (BTC)", "Ethereum (ETH)", "Tether (USDT)", "USD Coin (USDC)", "Binance Coin (BNB)", "XRP", "Solana (SOL)", "Dogecoin (DOGE)", "Litecoin (LTC)", "Tron (TRX)", "Cardano (ADA)", "Polygon (MATIC)", "Other"];
  const GIFTCARDS = ["Amazon", "Apple / iTunes", "Google Play", "Steam", "eBay", "Walmart", "Target", "Visa Gift Card", "Mastercard Gift Card", "Sephora", "Best Buy", "Nordstrom", "Razer Gold", "Nike", "Other"];
  const SCAM_OPTIONS = ["Crypto", "Giftcard", "Bank Transfer/ACH", "Payment Firm"] as const;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailTakenAddress, setEmailTakenAddress] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [socialError] = useState<string | null>(() => {
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

  const MAX_INITIAL_BALANCE_USD = 1_000_000;

  const strengthHint = useMemo(
    () => getPasswordStrengthHint(form.password),
    [form.password],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailTakenAddress("");
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    const passwordCheck = validatePassword(form.password);
    if (!passwordCheck.ok) {
      setError(passwordCheck.error ?? "Please choose a stronger password.");
      return;
    }
    let initialUsd: number | undefined;
    if (form.assets.trim() !== "") {
      const parsed = parseFloat(form.assets.replace(/,/g, ""));
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Starting balance must be a non-negative number.");
        return;
      }
      if (parsed > MAX_INITIAL_BALANCE_USD) {
        setError(`Starting balance cannot exceed $${MAX_INITIAL_BALANCE_USD.toLocaleString("en-US")}.`);
        return;
      }
      initialUsd = parsed;
    }
    if (!scammedVia) {
      setError("Please tell us how you were scammed.");
      return;
    }
    if (scammedVia === "Payment Firm" && !paymentFirm) {
      setError("Please select which payment firm was used.");
      return;
    }
    if (scammedVia === "Crypto" && !cryptoKind) {
      setError("Please select which cryptocurrency was used.");
      return;
    }
    if (scammedVia === "Giftcard" && !giftcardKind) {
      setError("Please select which gift card was used.");
      return;
    }
    const scammedViaLabel =
      scammedVia === "Payment Firm" ? `Payment Firm: ${paymentFirm}`
      : scammedVia === "Crypto" ? `Crypto: ${cryptoKind}`
      : scammedVia === "Giftcard" ? `Giftcard: ${giftcardKind}`
      : scammedVia;
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, initialUsd, scammedViaLabel);
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account. Please try again.";
      if (/already exists/i.test(message)) {
        setEmailTakenAddress(form.email.trim());
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToSignIn = () => {
    if (emailTakenAddress) {
      try {
        sessionStorage.setItem("prefill-signin-email", emailTakenAddress);
      } catch {
        // ignore storage errors
      }
    }
    navigate("/sign-in");
  };

  if (showForgot) {
    return <ForgotPasswordPanel onClose={() => setShowForgot(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-10">
          <img src="/treasury-vault-logo.jpg" alt="Treasury Vault" className="h-14 w-auto rounded-xl bg-white object-contain" />
        </div>

        <TotalAssetsBanner />

        <div className="bg-card border border-card-border rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Create account</h1>
          <p className="text-muted-foreground text-sm mb-6">Start trading crypto in minutes</p>

          <div className="mb-5">
            <SocialAuthButtons mode="signup" errorCode={socialError} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Full name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="John Doe"
                autoComplete="name"
                autoCapitalize="words"
                className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
              />
            </div>
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <PasswordInput
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 chars, mix letters & numbers"
                autoComplete="new-password"
                className="px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
                aria-describedby="password-rules password-strength-hint"
              />
              <PasswordRulesChecklist
                id="password-rules"
                password={form.password}
              />
              {strengthHint && (
                <p
                  id="password-strength-hint"
                  data-testid="password-strength-hint"
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm password</label>
              <PasswordInput
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
                className="px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5 uppercase tracking-wider">
                Assets in Total ($)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.assets}
                  onChange={e => {
                    let raw = e.target.value.replace(/[^0-9.]/g, "");
                    const firstDot = raw.indexOf(".");
                    if (firstDot !== -1) {
                      raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
                    }
                    setForm(f => ({ ...f, assets: raw }));
                  }}
                  placeholder="0.00"
                  data-testid="signup-assets-input"
                  className="w-full pl-8 pr-4 py-2.5 bg-muted border border-primary/40 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all font-semibold"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Enter your total asset value — this becomes your available portfolio balance. Max ${MAX_INITIAL_BALANCE_USD.toLocaleString("en-US")}. Leave blank to use the default.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 uppercase tracking-wider">
                Scammed via
              </label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Scammed via">
                {SCAM_OPTIONS.map((opt) => {
                  const selected = scammedVia === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setScammedVia(opt);
                        if (opt !== "Payment Firm") setPaymentFirm("");
                        if (opt !== "Crypto") setCryptoKind("");
                        if (opt !== "Giftcard") setGiftcardKind("");
                      }}
                      data-testid={`signup-scammed-via-${opt.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      className={
                        "px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left " +
                        (selected
                          ? "bg-primary/15 border-primary text-foreground"
                          : "bg-muted border-input text-muted-foreground hover:text-foreground hover:border-primary/40")
                      }
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {scammedVia === "Payment Firm" && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Which payment firm?
                  </label>
                  <select
                    value={paymentFirm}
                    onChange={(e) => setPaymentFirm(e.target.value)}
                    data-testid="signup-payment-firm-select"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
                  >
                    <option value="">Select a payment firm…</option>
                    {PAYMENT_FIRMS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
              {scammedVia === "Crypto" && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Which cryptocurrency?
                  </label>
                  <select
                    value={cryptoKind}
                    onChange={(e) => setCryptoKind(e.target.value)}
                    data-testid="signup-crypto-kind-select"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
                  >
                    <option value="">Select a cryptocurrency…</option>
                    {CRYPTOS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              {scammedVia === "Giftcard" && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Which gift card?
                  </label>
                  <select
                    value={giftcardKind}
                    onChange={(e) => setGiftcardKind(e.target.value)}
                    data-testid="signup-giftcard-kind-select"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
                  >
                    <option value="">Select a gift card…</option>
                    {GIFTCARDS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Helps our recovery team route your case to the right specialists.
              </p>
            </div>

            {emailTakenAddress && (
              <div
                data-testid="signup-email-taken"
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              >
                An account with{" "}
                <strong className="font-semibold break-all">{emailTakenAddress}</strong>{" "}
                already exists.{" "}
                <button
                  type="button"
                  onClick={handleSwitchToSignIn}
                  data-testid="signup-switch-to-signin"
                  className="underline font-semibold hover:opacity-80"
                >
                  Sign in instead
                </button>
                .
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </>
              ) : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/sign-in")}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            <button
              onClick={() => setShowForgot(true)}
              data-testid="signup-forgot-password"
              className="text-primary hover:underline font-medium"
            >
              Forgot your password?
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
