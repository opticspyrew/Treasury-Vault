import { useMemo } from "react";
import { CalendarClock, Layers, ShieldCheck, UserCog } from "lucide-react";
import { getCases, getInvestigatorAssignments, getTimeline } from "../../data/mocks";

function fmtDateTime(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export default function InvestigatorPanel() {
  const assignments = useMemo(() => getInvestigatorAssignments(), []);
  const cases = useMemo(() => getCases(), []);
  const leadCase = cases[0];
  const timeline = useMemo(() => (leadCase ? getTimeline(leadCase.reference) : []), [leadCase]);

  return (
    <div className="space-y-6">
      <div className="refunds-glass rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <UserCog className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Investigator workspace</h2>
            <p className="text-xs text-muted-foreground">
              Read-only preview of the analyst console for cases you have access to.
            </p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {assignments.map((a) => {
          const caseRow = cases.find((c) => c.reference === a.caseRef);
          return (
            <article key={a.caseRef} className="refunds-glass rounded-2xl p-5">
              <header className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-primary/90">{a.caseRef}</p>
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {caseRow?.title ?? "Case"}
                  </h3>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-card border border-card-border">
                  <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary">
                    {a.analyst.initials}
                  </div>
                  <div className="text-right leading-tight">
                    <p className="text-xs font-medium text-foreground">{a.analyst.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.analyst.role}</p>
                  </div>
                </div>
              </header>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-card/60 border border-card-border p-3">
                  <dt className="uppercase tracking-wider text-muted-foreground font-semibold">Next action</dt>
                  <dd className="mt-1 text-foreground">{a.nextAction}</dd>
                </div>
                <div className="rounded-lg bg-card/60 border border-card-border p-3">
                  <dt className="uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                    <CalendarClock className="w-3 h-3" /> Due
                  </dt>
                  <dd className="mt-1 text-foreground font-mono">{fmtDateTime(a.nextActionDue)}</dd>
                </div>
                <div className="rounded-lg bg-card/60 border border-card-border p-3">
                  <dt className="uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Layers className="w-3 h-3" /> Workload
                  </dt>
                  <dd className="mt-1 text-foreground">{a.workload} concurrent cases</dd>
                </div>
                <div className="rounded-lg bg-card/60 border border-card-border p-3">
                  <dt className="uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3" /> Status
                  </dt>
                  <dd className="mt-1 text-foreground capitalize">{caseRow?.status ?? "—"}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </section>

      {leadCase && timeline.length > 0 && (
        <section className="refunds-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Analyst activity — {leadCase.reference}</h3>
              <p className="text-xs text-muted-foreground">Most recent triage and investigation steps.</p>
            </div>
          </div>
          <ol className="space-y-3 text-sm">
            {timeline.slice(0, 4).map((t) => {
              const tone =
                t.status === "complete"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                  : t.status === "active"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-card-border bg-card/40 text-muted-foreground";
              return (
                <li key={t.id} className={`rounded-lg border ${tone} p-3`}>
                  <p className="font-medium text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.detail}</p>
                  <p className="text-[10px] uppercase tracking-wider mt-2 font-mono text-muted-foreground/80">
                    {t.at ? fmtDateTime(t.at) : "Pending"}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
