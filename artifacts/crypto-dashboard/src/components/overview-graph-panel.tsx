import { useRecoveryOverview } from "@/hooks/use-recovery-overview";
import { ScamThumb, parseScammedVia } from "@/lib/scam-thumbnail";
import { useCurrency } from "@/lib/currency-context";

/**
 * Small graph view showcasing the overview results (reported loss, recovered
 * to vault, at-risk balance, composite risk score). Replaces the old Recent
 * Activity section on the dashboard — recent activity now lives in the
 * sidebar next to the brand. The documented scam asset/currency/payment
 * method serves as the panel's thumbnail.
 */
export default function OverviewGraphPanel() {
  const { metrics, scammedVia, loading, error } = useRecoveryOverview();
  const { fmt } = useCurrency();
  const info = parseScammedVia(scammedVia);

  const reported = metrics?.reportedLossUsd ?? 0;
  const bars = [
    { label: "Reported loss", value: reported, color: "bg-sky-500", text: "text-sky-400" },
    { label: "Recovered to vault", value: metrics?.recoveredUsd ?? 0, color: "bg-emerald-500", text: "text-emerald-400" },
    { label: "At-risk balance", value: metrics?.atRiskUsd ?? 0, color: "bg-amber-500", text: "text-amber-400" },
  ];
  const max = Math.max(reported, 1);

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6" data-testid="overview-graph-panel">
      <div className="flex items-center gap-3 mb-5">
        {scammedVia ? (
          <ScamThumb label={scammedVia} size="md" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground">Overview</h3>
          <p className="text-xs text-muted-foreground truncate">
            {info ? `${info.kind}${info.detail && info.detail !== info.kind ? ` • ${info.detail}` : ""}` : "Your documented case at a glance"}
          </p>
        </div>
        {metrics && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk score</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{metrics.riskScore}<span className="text-xs text-muted-foreground font-medium"> / 100</span></p>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-3">Loading overview…</p>
      ) : error ? (
        <p className="text-sm text-destructive py-3">Couldn't load your overview right now.</p>
      ) : !metrics?.documented ? (
        <p className="text-sm text-muted-foreground py-3">
          No case details documented yet. Complete your scam report to see your overview here.
        </p>
      ) : (
        <div className="space-y-3">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{b.label}</span>
                <span className={`text-xs font-bold tabular-nums ${b.text}`}>{fmt(b.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${b.color} transition-all duration-700`}
                  style={{ width: `${Math.min(100, Math.max(1, (b.value / max) * 100))}%` }}
                />
              </div>
            </div>
          ))}
          {metrics.recoveryRatePct > 0 && (
            <p className="text-[11px] text-muted-foreground pt-1">
              {metrics.recoveryRatePct}% of your reported loss has been recovered to the vault.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
