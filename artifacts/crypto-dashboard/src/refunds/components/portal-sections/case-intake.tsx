import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, FileUp, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { submitCaseIntake } from "../../data/api";

type IncidentType = "" | "phishing" | "compromise" | "social" | "smart-contract" | "exchange";

const STEPS = [
  { id: 1, label: "Incident" },
  { id: 2, label: "Asset & Path" },
  { id: 3, label: "Evidence" },
  { id: 4, label: "Authorization" },
  { id: 5, label: "Review" },
] as const;

const INCIDENTS: { value: IncidentType; label: string; desc: string }[] = [
  { value: "phishing", label: "Phishing or fake site", desc: "Stolen credentials or signed approvals through a fraudulent interface." },
  { value: "compromise", label: "Wallet compromise", desc: "Seed phrase or private key exposed, malware, or device intrusion." },
  { value: "social", label: "Social engineering / romance scam", desc: "Manipulated transfer to a counterparty under pretense." },
  { value: "smart-contract", label: "Smart-contract exploit", desc: "Funds drained via a contract vulnerability or malicious upgrade." },
  { value: "exchange", label: "Exchange or custodian incident", desc: "Loss tied to a centralized exchange, custodian, or OTC desk." },
];

export default function CaseIntake() {
  const { token } = useAuth();
  const [step, setStep] = useState(1);
  const [incident, setIncident] = useState<IncidentType>("");
  const [asset, setAsset] = useState("");
  const [chain, setChain] = useState("");
  const [amount, setAmount] = useState("");
  const [txHashes, setTxHashes] = useState("");
  const [evidence, setEvidence] = useState<File[]>([]);
  const [authorize, setAuthorize] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canAdvance = () => {
    switch (step) {
      case 1: return incident !== "";
      case 2: return asset.trim() !== "" && chain.trim() !== "" && amount.trim() !== "";
      case 3: return true;
      case 4: return authorize;
      default: return true;
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setEvidence((prev) => [...prev, ...Array.from(files)].slice(0, 10));
  };

  const handleSubmit = async () => {
    if (!token) {
      setError("Your session has expired. Please sign in again to submit a case.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await submitCaseIntake(token, {
        incident: INCIDENTS.find((i) => i.value === incident)?.label ?? incident,
        asset,
        chain,
        amount,
        txHashes,
        evidenceCount: evidence.length,
      });
      setReference(result.reference);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit your case. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="refunds-glass rounded-2xl p-8 max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 border border-primary/30 mb-4 refunds-vault-lock">
          <ShieldCheck className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Intake received</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          A triage analyst will review your submission and respond through the Secure
          Messaging channel. Outcomes depend on jurisdiction, counterparty cooperation,
          and the underlying asset — no recovery is guaranteed.
        </p>
        <p className="mt-6 font-mono text-xs text-primary">Reference: {reference}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <ol className="flex items-center justify-between gap-2" aria-label="Intake progress">
        {STEPS.map((s, i) => {
          const isDone = step > s.id;
          const isActive = step === s.id;
          return (
            <li key={s.id} className="flex-1 flex items-center gap-2 min-w-0">
              <div
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border ${
                  isDone
                    ? "bg-primary text-primary-foreground border-primary"
                    : isActive
                      ? "bg-primary/15 text-primary border-primary"
                      : "bg-card text-muted-foreground border-card-border"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : s.id}
              </div>
              <span
                className={`text-xs font-medium truncate ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="flex-1 h-px bg-card-border" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      <div className="refunds-glass rounded-2xl p-6">
        {step === 1 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground mb-2">
              What kind of incident are you reporting?
            </legend>
            {INCIDENTS.map((opt) => {
              const selected = incident === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selected
                      ? "bg-primary/10 border-primary/40"
                      : "bg-card/40 border-card-border hover:border-primary/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="incident"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setIncident(opt.value)}
                    className="mt-1 accent-[hsl(var(--primary))]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Asset</span>
              <input
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                placeholder="e.g. USDC"
                autoComplete="off"
                className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Chain</span>
              <input
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                placeholder="e.g. Ethereum"
                autoComplete="off"
                className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Estimated loss (USD)</span>
              <input
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm text-foreground font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Transaction hashes (one per line)</span>
              <textarea
                value={txHashes}
                onChange={(e) => setTxHashes(e.target.value)}
                rows={4}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <label
              htmlFor="intake-evidence"
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-card-border bg-card/40 cursor-pointer hover:border-primary/40 transition-colors text-center"
            >
              <FileUp className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Attach supporting evidence</span>
              <span className="text-xs text-muted-foreground">
                Screenshots, transaction exports, exchange correspondence. Up to 10 files.
              </span>
              <input
                id="intake-evidence"
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
            {evidence.length > 0 && (
              <ul className="space-y-2">
                {evidence.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card/60 border border-card-border text-sm"
                  >
                    <span className="truncate text-foreground">{f.name}</span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">
              Files are processed locally for this prototype and are not transmitted.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              By submitting this intake you confirm that:
            </p>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-5">
              <li>The information provided is truthful to your knowledge.</li>
              <li>
                You authorize Netspy-World Forensics analysts to perform read-only
                on-chain analysis of the addresses you control or have identified.
              </li>
              <li>
                You understand that recovery outcomes depend on jurisdiction,
                counterparty cooperation, and the underlying asset, and that
                <strong className="text-foreground"> no outcome is guaranteed</strong>.
              </li>
              <li>
                Netspy-World Forensics will never ask for your seed phrase, private
                keys, or full payment-card details.
              </li>
            </ul>
            <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={authorize}
                onChange={(e) => setAuthorize(e.target.checked)}
                className="mt-1 accent-[hsl(var(--primary))]"
              />
              <span>I have read and accept the terms above.</span>
            </label>
          </div>
        )}

        {step === 5 && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Incident</dt>
              <dd className="text-foreground capitalize">
                {INCIDENTS.find((i) => i.value === incident)?.label ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Asset / Chain</dt>
              <dd className="text-foreground">{asset || "—"} on {chain || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Estimated loss</dt>
              <dd className="text-foreground font-mono tabular-nums">{amount ? `$${amount}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Evidence files</dt>
              <dd className="text-foreground">{evidence.length}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Transaction hashes</dt>
              <dd className="text-foreground font-mono text-xs whitespace-pre-wrap break-all">
                {txHashes.trim() || "—"}
              </dd>
            </div>
          </dl>
        )}

        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-card-border">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-card-border text-muted-foreground hover:text-foreground hover:bg-card/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              disabled={!canAdvance()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !authorize}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? "Submitting…" : "Submit intake"}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-3 text-xs text-destructive text-right" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
