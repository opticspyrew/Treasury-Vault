import { useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Network, Radar } from "lucide-react";
import Reveal from "./reveal";

interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: "source" | "hop" | "mixer" | "exchange" | "recovered";
}

const NODES: GraphNode[] = [
  { id: "victim", x: 40, y: 100, label: "Victim wallet", kind: "source" },
  { id: "hop1", x: 150, y: 50, label: "Hop · 0x4a…f1", kind: "hop" },
  { id: "hop2", x: 150, y: 150, label: "Hop · 0x9c…2b", kind: "hop" },
  { id: "mixer", x: 270, y: 100, label: "Mixer cluster", kind: "mixer" },
  { id: "exchange", x: 390, y: 55, label: "Regulated venue", kind: "exchange" },
  { id: "settled", x: 390, y: 150, label: "Settled · flagged", kind: "recovered" },
];

const EDGES: [string, string][] = [
  ["victim", "hop1"],
  ["victim", "hop2"],
  ["hop1", "mixer"],
  ["hop2", "mixer"],
  ["mixer", "exchange"],
  ["mixer", "settled"],
];

const NODE_COLOR: Record<GraphNode["kind"], string> = {
  source: "hsl(195 25% 96%)",
  hop: "hsl(217 91% 60%)",
  mixer: "hsl(38 95% 55%)",
  exchange: "hsl(152 70% 45%)",
  recovered: "hsl(0 84% 60%)",
};

const RISK_ROWS = [
  { addr: "0x4a91…b7f1", score: 86, tag: "High" },
  { addr: "0x9c20…ad2b", score: 64, tag: "Elevated" },
  { addr: "0x1f88…6e0c", score: 31, tag: "Low" },
];

export default function BlockchainIntelligence() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const activeId = hovered ?? selected;
  const byId = (id: string) => NODES.find((n) => n.id === id)!;

  const toggleSelect = (id: string) =>
    setSelected((cur) => (cur === id ? null : id));

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      toggleSelect(id);
    }
  };

  return (
    <section
      id="intelligence"
      className="px-6 lg:px-10 py-16 max-w-7xl mx-auto scroll-mt-24"
    >
      <Reveal>
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-wider text-primary font-semibold">
            Blockchain intelligence
          </span>
          <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
            See exactly where the funds went
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Interactive path-of-funds graphs, address risk scoring, and live
            on-chain alerts turn raw transactions into an investigable story.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <Reveal>
          <div className="refunds-glass rounded-2xl p-5 refunds-scan-line h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Network className="w-4 h-4 text-primary" /> Path of funds
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Hover or focus a node
              </span>
            </div>
            <svg viewBox="0 0 430 200" className="w-full" role="img" aria-label="Path of funds graph">
              <g stroke="hsl(180 80% 55% / 0.45)" strokeWidth="1.4" fill="none">
                {EDGES.map(([a, b], i) => {
                  const na = byId(a);
                  const nb = byId(b);
                  return (
                    <motion.line
                      key={`${a}-${b}`}
                      x1={na.x}
                      y1={na.y}
                      x2={nb.x}
                      y2={nb.y}
                      initial={{ pathLength: 0, opacity: 0 }}
                      whileInView={{ pathLength: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: i * 0.12 }}
                    />
                  );
                })}
              </g>
              {NODES.map((n) => {
                const isActive = activeId === n.id;
                const isSelected = selected === n.id;
                return (
                  <g
                    key={n.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.label} (${n.kind})`}
                    aria-pressed={isSelected}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(n.id)}
                    onBlur={() => setHovered(null)}
                    onClick={() => toggleSelect(n.id)}
                    onKeyDown={(e) => handleKeyDown(e, n.id)}
                    className="cursor-pointer focus:outline-none [&:focus-visible_circle]:stroke-primary [&:focus-visible_circle]:stroke-[3]"
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={isActive ? 11 : 8}
                      fill={NODE_COLOR[n.kind]}
                      stroke={isSelected ? "hsl(var(--primary))" : "hsl(222 60% 5%)"}
                      strokeWidth={isSelected ? 3 : 2}
                      className="transition-all motion-reduce:transition-none"
                    />
                    {isActive && (
                      <text
                        x={n.x}
                        y={n.y - 16}
                        textAnchor="middle"
                        className="fill-foreground"
                        style={{ font: "600 10px var(--font-mono, monospace)" }}
                      >
                        {n.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              {(
                [
                  ["Source", "source"],
                  ["Hop", "hop"],
                  ["Mixer", "mixer"],
                  ["Venue", "exchange"],
                  ["Flagged", "recovered"],
                ] as [string, GraphNode["kind"]][]
              ).map(([label, kind]) => (
                <span key={kind} className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: NODE_COLOR[kind] }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid grid-rows-2 gap-4">
          <Reveal delay={0.1}>
            <div className="refunds-glass rounded-2xl p-5">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Radar className="w-4 h-4 text-primary" /> Address risk
              </span>
              <ul className="space-y-2.5">
                {RISK_ROWS.map((r) => (
                  <li key={r.addr} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">
                      {r.addr}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-card/80 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background:
                            r.score > 75
                              ? "hsl(0 84% 60%)"
                              : r.score > 50
                                ? "hsl(38 95% 55%)"
                                : "hsl(152 70% 45%)",
                        }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${r.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                    <span className="font-mono text-xs text-foreground w-7 text-right tabular-nums">
                      {r.score}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="refunds-glass rounded-2xl p-5">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Activity className="w-4 h-4 text-primary" /> On-chain alerts
              </span>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2 rounded-lg border border-[hsl(var(--refunds-alert)/0.3)] bg-[hsl(var(--refunds-alert)/0.08)] p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--refunds-alert))] mt-0.5 shrink-0" />
                  <span className="text-foreground">
                    Tracked address moved 12.4 ETH to a known mixer.
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-lg border border-card-border bg-card/40 p-2.5">
                  <Activity className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">
                    Funds settled into a regulated venue — engagement eligible.
                  </span>
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
