import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Gauge,
  Radar,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { getAlerts, getCases, getVaultSummary } from "../../data/mocks";
import type { CaseSeverity, CaseStatus } from "../../data/types";

const SEVERITY_TONE: Record<CaseSeverity, string> = {
  low: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  medium: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  high: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  critical: "bg-red-500/10 text-red-300 border-red-500/30",
};

const STATUS_LABEL: Record<CaseStatus, string> = {
  intake: "Intake",
  triage: "Triage",
  investigation: "Investigation",
  recovery: "Recovery",
  closed: "Closed",
};

function fmtUsd(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtRelative(iso: string) {
  if (!iso) return "—";
  const now = new Date("2026-05-27T04:00:00Z").getTime();
  const then = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.round((now - then) / 60_000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}

export default function VaultOverview() {
  const summary = useMemo(() => getVaultSummary(), []);
  const cases = useMemo(() => getCases(), []);
  const alerts = useMemo(() => getAlerts(), []);

  const kpiCards = [
    {
      label: "Recovered to vault",
      value: fmtUsd(summary.recoveredUsd),
      sub: `${summary.recoveryRatePct}% of reported loss`,
      icon: <ShieldCheck className="w-5 h-5 text-[hsl(var(--refunds-success))]" />,
      accent: "from-emerald-500/15 to-transparent",
    },
    {
      label: "At-risk balance",
      value: fmtUsd(summary.atRiskUsd),
      sub: "Active investigations",
      icon: <ShieldAlert className="w-5 h-5 text-[hsl(var(--refunds-alert))]" />,
      accent: "from-amber-500/15 to-transparent",
    },
    {
      label: "Reported loss",
      value: fmtUsd(summary.reportedLossUsd),
      sub: `${summary.totalCases} cases on file`,
      icon: <CircleDollarSign className="w-5 h-5 text-accent" />,
      accent: "from-sky-500/15 to-transparent",
    },
    {
      label: "Composite risk score",
      value: `${Math.round(
        cases.reduce((s, c) => s + c.riskScore, 0) / Math.max(1, cases.length),
      )} / 100`,
      sub: `${summary.liveAlerts} live alerts • ${summary.averageResolutionDays}d avg. resolution`,
      icon: <Gauge className="w-5 h-5 text-primary" />,
      accent: "from-primary/15 to-transparent",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((c) => (
          <div
            key={c.label}
            className="relative refunds-glass rounded-2xl p-5 overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${c.accent} pointer-events-none`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {c.label}
                </p>
                {c.icon}
              </div>
              <p className="text-2xl font-semibold text-foreground tabular-nums">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 refunds-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Active cases</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Synthetic demonstration data — no client information shown.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-primary/10 border border-primary/25 text-primary">
              {summary.activeCases} active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-card-border">
                  <th className="text-left font-semibold py-2 pr-3">Reference</th>
                  <th className="text-left font-semibold py-2 pr-3">Case</th>
                  <th className="text-left font-semibold py-2 pr-3">Status</th>
                  <th className="text-right font-semibold py-2 pr-3">At-risk</th>
                  <th className="text-right font-semibold py-2 pr-3">Recovered</th>
                  <th className="text-right font-semibold py-2 pl-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b border-card-border/60 last:border-0">
                    <td className="py-3 pr-3 font-mono text-xs text-primary/90">{c.reference}</td>
                    <td className="py-3 pr-3">
                      <p className="text-foreground font-medium leading-tight">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {c.asset} • {c.chain} • {c.jurisdiction}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-md text-[11px] font-medium bg-card border border-card-border text-foreground/90">
                          {STATUS_LABEL[c.status]}
                        </span>
                        <span
                          className={`inline-flex items-center w-fit px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${SEVERITY_TONE[c.severity]}`}
                        >
                          {c.severity}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-[hsl(var(--refunds-alert))]">
                      {fmtUsd(c.atRiskUsd)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-[hsl(var(--refunds-success))]">
                      {fmtUsd(c.recoveredUsd)}
                    </td>
                    <td className="py-3 pl-3 text-right text-xs text-muted-foreground">
                      {fmtRelative(c.lastUpdate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="refunds-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Live intelligence feed</h2>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Auto-refreshed
            </span>
          </div>
          <ul className="space-y-3">
            {alerts.map((a) => {
              const tone =
                a.severity === "critical"
                  ? "border-red-500/30 bg-red-500/5"
                  : a.severity === "warning"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-sky-500/30 bg-sky-500/5";
              const icon =
                a.severity === "critical" ? (
                  <ArrowUpRight className="w-4 h-4 text-red-300" />
                ) : a.severity === "warning" ? (
                  <Radar className="w-4 h-4 text-amber-300" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-sky-300" />
                );
              return (
                <li key={a.id} className={`rounded-xl border ${tone} p-3`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-2 font-mono">
                        {a.caseRef} • {fmtRelative(a.observedAt)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
