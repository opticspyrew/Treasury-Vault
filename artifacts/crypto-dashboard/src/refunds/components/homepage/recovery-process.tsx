import { getProcessSteps } from "../../data/mocks";
import Reveal from "./reveal";

const STEPS = getProcessSteps();

export default function RecoveryProcess() {
  return (
    <section id="process" className="px-6 lg:px-10 py-16 max-w-7xl mx-auto scroll-mt-24">
      <Reveal>
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-wider text-primary font-semibold">
            Recovery process
          </span>
          <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
            A documented path from incident to outcome
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Every case follows the same disciplined, auditable workflow. Each
            stage produces evidence you can review inside the secure portal.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 relative">
        <div
          className="hidden lg:block absolute left-0 right-0 top-7 h-px bg-gradient-to-r from-primary/40 via-card-border to-accent/40"
          aria-hidden="true"
        />
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {STEPS.map((step, i) => (
            <Reveal
              as="li"
              key={step.key}
              delay={i * 0.08}
              className="relative refunds-glass rounded-2xl p-5 h-full"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 text-primary font-mono font-semibold flex items-center justify-center">
                  {step.index}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {step.duration}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {step.detail}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
