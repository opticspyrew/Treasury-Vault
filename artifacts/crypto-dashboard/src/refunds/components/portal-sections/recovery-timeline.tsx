import { useMemo, useState } from "react";
import { Activity, ShieldCheck } from "lucide-react";
import { getCases, getTimeline } from "../../data/mocks";

function fmtDate(iso: string) {
  if (!iso) return "Pending";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default function RecoveryTimeline() {
  const cases = useMemo(() => getCases().filter((c) => c.status !== "closed"), []);
  const [selected, setSelected] = useState(cases[0]?.reference ?? "");
  const timeline = useMemo(() => getTimeline(selected), [selected]);

  const total = timeline.length;
  const completed = timeline.filter((t) => t.status === "complete").length;
  const active = timeline.find((t) => t.status === "active");

  return (
    <div className="space-y-4">
      <div className="refunds-glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Recovery timeline</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Case</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="px-3 py-1.5 bg-muted border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            >
              {cases.map((c) => (
                <option key={c.reference} value={c.reference}>
                  {c.reference} — {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent"
              style={{ width: total === 0 ? "0%" : `${(completed / total) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {completed}/{total} stages complete
          </span>
        </div>
        {active && (
          <p className="text-xs text-primary mt-2">
            <ShieldCheck className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            Currently: {active.title}
          </p>
        )}
      </div>

      <div className="refunds-glass rounded-2xl p-5">
        <ol className="relative pl-7">
          <span className="absolute left-2 top-1 bottom-1 w-px bg-card-border" aria-hidden="true" />
          {timeline.length === 0 && (
            <p className="text-sm text-muted-foreground">No timeline events for this case.</p>
          )}
          {timeline.map((t) => {
            const tone =
              t.status === "complete"
                ? { ring: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "Complete" }
                : t.status === "active"
                  ? { ring: "bg-primary refunds-pulse-ring", pill: "bg-primary/15 text-primary border-primary/30", label: "Active" }
                  : { ring: "bg-card-border", pill: "bg-card text-muted-foreground border-card-border", label: "Pending" };
            return (
              <li key={t.id} className="relative pb-6 last:pb-0">
                <span
                  className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 border-card ${tone.ring}`}
                />
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-foreground">{t.title}</p>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${tone.pill}`}>
                    {tone.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t.detail}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-1 font-mono">
                  {fmtDate(t.at)}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
