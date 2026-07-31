import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  buildScammedViaLabel,
  CRYPTOS,
  GIFTCARDS,
  MAX_ASSETS_TOTAL_USD,
  PAYMENT_FIRMS,
  SCAM_OPTIONS,
  type ScamOption,
} from "@/lib/scam-options";

/**
 * Post-social-signup intake popup. Google sign-ups skip the signup form, so
 * this modal collects the same details (Assets in total, Scammed via) so the
 * user's reported loss / at-risk figures can be documented. Shown whenever the
 * signed-in user still has `needsIntake` set.
 */
export default function IntakeModal() {
  const { completeIntake } = useAuth();
  const [assets, setAssets] = useState("");
  const [scammedVia, setScammedVia] = useState<"" | ScamOption>("");
  const [paymentFirm, setPaymentFirm] = useState("");
  const [cryptoKind, setCryptoKind] = useState("");
  const [giftcardKind, setGiftcardKind] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    let assetsUsd: number | undefined;
    if (assets.trim() !== "") {
      const parsed = parseFloat(assets.replace(/,/g, ""));
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Assets total must be a non-negative number.");
        return;
      }
      if (parsed > MAX_ASSETS_TOTAL_USD) {
        setError(`Assets total cannot exceed $${MAX_ASSETS_TOTAL_USD.toLocaleString("en-US")}.`);
        return;
      }
      assetsUsd = parsed;
    } else {
      setError("Please enter your total asset value.");
      return;
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
    const detail =
      scammedVia === "Payment Firm" ? paymentFirm
      : scammedVia === "Crypto" ? cryptoKind
      : scammedVia === "Giftcard" ? giftcardKind
      : "";
    setLoading(true);
    try {
      await completeIntake(assetsUsd, buildScammedViaLabel(scammedVia, detail));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save your details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div
        className="w-full max-w-md bg-card border border-card-border rounded-2xl p-6 sm:p-8 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-modal-title"
        data-testid="intake-modal"
      >
        <h2 id="intake-modal-title" className="text-xl font-bold text-foreground mb-1">
          Complete your case details
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          You signed up with Google, so we still need a few details to document
          your case and set up your recovery dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5 uppercase tracking-wider">
              Assets in Total ($)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={assets}
                onChange={(e) => {
                  let raw = e.target.value.replace(/[^0-9.]/g, "");
                  const firstDot = raw.indexOf(".");
                  if (firstDot !== -1) {
                    raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
                  }
                  setAssets(raw);
                }}
                placeholder="0.00"
                data-testid="intake-assets-input"
                className="w-full pl-8 pr-4 py-2.5 bg-muted border border-primary/40 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all font-semibold"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              This becomes your documented reported loss and available portfolio balance. Max ${MAX_ASSETS_TOTAL_USD.toLocaleString("en-US")}.
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
                    data-testid={`intake-scammed-via-${opt.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
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
                  data-testid="intake-payment-firm-select"
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
                  data-testid="intake-crypto-kind-select"
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
                  data-testid="intake-giftcard-kind-select"
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

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="intake-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="intake-submit"
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save details"}
          </button>
        </form>
      </div>
    </div>
  );
}
