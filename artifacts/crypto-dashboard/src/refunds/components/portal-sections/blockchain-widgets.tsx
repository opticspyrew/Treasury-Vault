import { useMemo } from "react";
import { ArrowDown, ArrowUp, Network, Radar, ShieldAlert } from "lucide-react";
import { getAddressRisk, getAlerts, getTransactions } from "../../data/mocks";

function shortHash(h: string, head = 8, tail = 6) {
  if (h.length <= head + tail + 3) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

function riskTone(score: number) {
  if (score >= 80) return { bar: "bg-red-500", text: "text-red-300", label: "Critical" };
  if (score >= 60) return { bar: "bg-amber-500", text: "text-amber-300", label: "Elevated" };
  if (score >= 40) return { bar: "bg-sky-500", text: "text-sky-300", label: "Notable" };
  return { bar: "bg-emerald-500", text: "text-emerald-300", label: "Low" };
}

function fmtRelative(iso: string) {
  const now = new Date("2026-05-27T04:00:00Z").getTime();
  const then = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.round((now - then) / 60_000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.round(diffH / 24)}d`;
}

function TxGraph() {
  // Stylized SVG "tx graph" — not real layout, but reads as forensic.
  return (
    <svg viewBox="0 0 320 180" className="w-full h-44" role="img" aria-label="Transaction path graph (illustrative)">
      <defs>
        <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(180 95% 55%)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <g stroke="url(#edge)" strokeWidth="1.2" fill="none">
        <path d="M40 90 C 100 60, 160 60, 220 90" />
        <path d="M40 90 C 100 130, 160 130, 220 90" />
        <path d="M220 90 C 260 70, 290 60, 300 50" />
        <path d="M220 90 C 260 110, 290 130, 300 140" />
      </g>
      {[
        { cx: 40, cy: 90, fill: "hsl(195 25% 96%)", label: "Source" },
        { cx: 220, cy: 90, fill: "hsl(38 95% 55%)", label: "Mixer" },
        { cx: 300, cy: 50, fill: "hsl(0 84% 60%)", label: "Cluster A" },
        { cx: 300, cy: 140, fill: "hsl(152 70% 45%)", label: "Exchange" },
      ].map((n, i) => (
        <g key={i}>
          <circle cx={n.cx} cy={n.cy} r="6" fill={n.fill} stroke="hsl(222 60% 5%)" strokeWidth="2" />
          <text x={n.cx} y={n.cy + 20} textAnchor="middle" fontSize="9" fill="hsl(215 15% 70%)" fontFamily="JetBrains Mono, monospace">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function BlockchainWidgets() {
  const txs = useMemo(() => getTransactions(), []);
  const addresses = useMemo(() => getAddressRisk(), []);
  const alerts = useMemo(() => getAlerts(), []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <section className="xl:col-span-2 refunds-glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Path of funds</h2>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            RF-2026-0184 • Ethereum
          </span>
        </div>
        <div className="refunds-scan-line rounded-xl border border-card-border bg-card/40 p-3 mb-4">
          <TxGraph />
        </div>

        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Recent on-chain activity
        </h3>
        <ul className="divide-y divide-card-border/70">
          {txs.map((t) => {
            const tone = riskTone(t.riskScore);
            return (
              <li key={t.id} className="py-3 flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    t.direction === "in" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {t.direction === "in" ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {t.direction === "in" ? "Inflow" : "Outflow"} • {t.amount} {t.asset}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${tone.text}`}>
                      Risk {t.riskScore} — {tone.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {shortHash(t.hash)} • {shortHash(t.counterparty, 8, 4)}
                  </p>
                  {t.counterpartyLabel && (
                    <p className="text-[11px] text-muted-foreground/90">{t.counterpartyLabel}</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {fmtRelative(t.observedAt)} ago
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="space-y-4">
        <section className="refunds-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-[hsl(var(--refunds-alert))]" />
            <h2 className="text-base font-semibold text-foreground">Address risk</h2>
          </div>
          <ul className="space-y-3">
            {addresses.map((a) => {
              const tone = riskTone(a.riskScore);
              return (
                <li key={a.address} className="rounded-lg border border-card-border bg-card/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{a.label}</p>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${tone.text}`}>
                      {a.riskScore} — {tone.label}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">{shortHash(a.address, 12, 8)}</p>
                  <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${tone.bar}`}
                      style={{ width: `${a.riskScore}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.flags.map((f) => (
                      <span
                        key={f}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-card border border-card-border text-muted-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="refunds-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Radar className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">On-chain alerts</h2>
          </div>
          <ul className="space-y-2.5">
            {alerts.map((a) => (
              <li key={a.id} className="text-xs">
                <p className="text-foreground font-medium">{a.title}</p>
                <p className="text-muted-foreground mt-0.5">{a.detail}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1 font-mono">
                  {a.caseRef}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
