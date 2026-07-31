import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRecoveryStats, useRecoveryTrend } from "../../data/api";
import AnimatedCounter from "./animated-counter";
import Reveal from "./reveal";

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function RecoveryStats() {
  const STATS = useRecoveryStats();
  const TREND = useRecoveryTrend();
  return (
    <section
      id="statistics"
      className="px-6 lg:px-10 py-16 max-w-7xl mx-auto scroll-mt-24"
    >
      <Reveal>
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-wider text-primary font-semibold">
            Recovery statistics
          </span>
          <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
            Measured, transparent, ongoing
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Aggregate figures across active and closed investigations. These are
            illustrative platform metrics, not a promise of outcome.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        <div className="grid grid-cols-2 gap-4">
          {STATS.map((s, i) => (
            <Reveal key={s.id} delay={(i % 2) * 0.08}>
              <div className="refunds-glass rounded-2xl p-5 h-full">
                <p className="text-3xl font-semibold text-foreground tabular-nums">
                  <AnimatedCounter
                    value={s.value}
                    decimals={s.decimals ?? 0}
                    prefix={s.prefix ?? ""}
                    suffix={s.suffix ?? ""}
                  />
                </p>
                <p className="text-sm font-medium text-primary mt-1">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {s.caption}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="refunds-glass rounded-2xl p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-foreground">
                Funds recovered (USD)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                trailing 8 months
              </span>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={TREND} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(180 95% 50%)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(180 95% 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(215 30% 22% / 0.4)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(215 20% 60%)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(215 20% 60%)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => compactUsd.format(v)}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(180 95% 50% / 0.3)" }}
                    contentStyle={{
                      background: "hsl(220 60% 8%)",
                      border: "1px solid hsl(215 30% 22%)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "hsl(195 25% 96%)",
                    }}
                    formatter={(v: number) => [compactUsd.format(v), "Recovered"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="recoveredUsd"
                    stroke="hsl(180 95% 55%)"
                    strokeWidth={2}
                    fill="url(#trend-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
