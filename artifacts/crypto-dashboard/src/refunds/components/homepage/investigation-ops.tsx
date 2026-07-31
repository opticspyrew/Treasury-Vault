import { motion } from "framer-motion";
import { Clock, Cpu, Radar, ShieldAlert, Users } from "lucide-react";
import Reveal from "./reveal";

const METRICS = [
  { icon: Users, label: "Active analysts", value: "24" },
  { icon: Radar, label: "Addresses monitored", value: "1,902" },
  { icon: ShieldAlert, label: "Open alerts", value: "37" },
  { icon: Clock, label: "Median triage", value: "5.8h" },
];

const FEED = [
  { time: "09:42", text: "Address 0x4a91…b7f1 flagged — outflow to mixer", level: "alert" },
  { time: "09:18", text: "Case RF-2026-0184 escalated to senior analyst", level: "info" },
  { time: "08:55", text: "Venue engagement authorized by client", level: "ok" },
  { time: "08:31", text: "New on-chain settlement detected (Base)", level: "info" },
];

const LEVEL_DOT: Record<string, string> = {
  alert: "hsl(var(--refunds-alert))",
  ok: "hsl(var(--refunds-success))",
  info: "hsl(var(--primary))",
};

export default function InvestigationOps() {
  return (
    <section id="operations" className="px-6 lg:px-10 py-16 max-w-7xl mx-auto scroll-mt-24">
      <Reveal>
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-wider text-primary font-semibold">
            Investigation operations
          </span>
          <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
            A security operations center for recovery
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Analysts work cases inside a live operations console — continuous
            monitoring, escalation, and a real-time activity feed across every
            open investigation.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4">
        <Reveal>
          <div className="grid grid-cols-2 gap-4 h-full">
            {METRICS.map((m, i) => (
              <div
                key={m.label}
                className="refunds-glass rounded-2xl p-5 flex flex-col justify-between"
              >
                <m.icon className="w-5 h-5 text-primary" />
                <div className="mt-6">
                  <p className="text-2xl font-semibold text-foreground tabular-nums">
                    {m.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.label}
                  </p>
                </div>
                <motion.div
                  className="mt-3 h-1 rounded-full bg-primary/30"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  style={{ transformOrigin: "left" }}
                />
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="refunds-glass rounded-2xl p-5 h-full refunds-scan-line">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Cpu className="w-4 h-4 text-primary" /> Live operations feed
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary refunds-pulse-ring" />
                Live
              </span>
            </div>
            <ul className="space-y-2.5">
              {FEED.map((f, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-center gap-3 rounded-xl border border-card-border bg-card/40 px-3 py-2.5"
                >
                  <span className="font-mono text-[10px] text-muted-foreground w-9 shrink-0">
                    {f.time}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: LEVEL_DOT[f.level] }}
                  />
                  <span className="text-xs text-foreground">{f.text}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
