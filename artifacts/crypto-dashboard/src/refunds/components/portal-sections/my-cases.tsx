import { FolderOpen, Inbox, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useMyCases } from "../../data/api";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtAmount(amount: string | null, currency: string): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "USD" ? `$${formatted}` : `${formatted} ${currency}`;
}

const STATUS_TONES: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending review", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  processing: { label: "In progress", cls: "bg-primary/15 text-primary border-primary/30" },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  rejected: { label: "Declined", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  closed: { label: "Closed", cls: "bg-card text-muted-foreground border-card-border" },
};

function statusTone(status: string): { label: string; cls: string } {
  const key = (status ?? "").toLowerCase();
  if (STATUS_TONES[key]) return STATUS_TONES[key];
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  return { label, cls: "bg-card text-muted-foreground border-card-border" };
}

export default function MyCases() {
  const { token } = useAuth();
  const { cases, loading, error, reload } = useMyCases(token);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="refunds-glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">My cases</h2>
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            data-testid="my-cases-refresh"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-card-border text-muted-foreground hover:text-foreground hover:bg-card/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Recovery cases you have submitted, with their current status. Updates appear here as
          our analysts work each case.
        </p>
      </div>

      {loading && (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="refunds-glass rounded-2xl p-5 animate-pulse">
              <div className="h-4 w-32 bg-muted rounded mb-3" />
              <div className="h-3 w-2/3 bg-muted rounded mb-2" />
              <div className="h-3 w-1/3 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="refunds-glass rounded-2xl p-6 text-center" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      )}

      {!loading && !error && cases.length === 0 && (
        <div className="refunds-glass rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 border border-primary/30 mb-4">
            <Inbox className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No cases yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You haven't submitted any recovery cases. Open the{" "}
            <strong className="text-foreground">Case Intake</strong> tab to file your first case —
            it will appear here once submitted.
          </p>
        </div>
      )}

      {!loading && !error && cases.length > 0 && (
        <ul className="space-y-3" data-testid="my-cases-list">
          {cases.map((c) => {
            const tone = statusTone(c.status);
            return (
              <li key={c.id} className="refunds-glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-primary">{c.reference}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {c.incident ?? "Recovery case"}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded border ${tone.cls}`}
                  >
                    {tone.label}
                  </span>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-4">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Asset
                    </dt>
                    <dd className="text-sm text-foreground mt-0.5">{c.asset ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Chain
                    </dt>
                    <dd className="text-sm text-foreground mt-0.5">{c.chain ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Reported loss
                    </dt>
                    <dd className="text-sm text-foreground font-mono tabular-nums mt-0.5">
                      {fmtAmount(c.amount, c.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Submitted
                    </dt>
                    <dd className="text-sm text-foreground mt-0.5">{fmtDate(c.submittedAt)}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
