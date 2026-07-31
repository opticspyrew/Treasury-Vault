import { useLocation } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import Reveal from "./reveal";

const STEPS = [
  { n: 1, label: "Incident type", done: true },
  { n: 2, label: "Affected assets", done: true },
  { n: 3, label: "Transaction hashes", done: true },
  { n: 4, label: "Evidence upload", done: false, active: true },
  { n: 5, label: "Review & submit", done: false },
];

export default function CaseIntakeSection() {
  const [, navigate] = useLocation();

  return (
    <section className="px-6 lg:px-10 py-16 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <Reveal delay={0.1}>
          <div className="refunds-glass rounded-3xl p-6 order-2 lg:order-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              New case intake
            </p>
            <p className="text-sm text-foreground mb-5">Step 4 of 5 · Evidence</p>
            <ol className="space-y-2.5">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                    s.active
                      ? "border-primary/40 bg-primary/10"
                      : "border-card-border bg-card/40"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-semibold shrink-0 ${
                      s.done
                        ? "bg-[hsl(var(--refunds-success)/0.2)] text-[hsl(var(--refunds-success))] border border-[hsl(var(--refunds-success)/0.4)]"
                        : s.active
                          ? "bg-primary/20 text-primary border border-primary/40"
                          : "bg-card/60 text-muted-foreground border border-card-border"
                    }`}
                  >
                    {s.done ? <Check className="w-3.5 h-3.5" /> : s.n}
                  </span>
                  <span
                    className={`text-sm ${s.active ? "text-foreground font-medium" : "text-muted-foreground"}`}
                  >
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        <Reveal>
          <div className="order-1 lg:order-2">
            <span className="text-xs uppercase tracking-wider text-primary font-semibold">
              Case intake flow
            </span>
            <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
              Open a case in minutes, securely
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              A guided, multi-step intake captures the incident, affected assets,
              transaction hashes, and evidence — each saved to an encrypted case
              file. You stay in control of what is shared and when.
            </p>
            <button
              onClick={() => navigate("/refunds/sign-up")}
              className="mt-7 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Start a case <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
