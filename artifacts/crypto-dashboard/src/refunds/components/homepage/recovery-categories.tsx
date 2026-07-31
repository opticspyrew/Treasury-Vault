import {
  Building2,
  Bug,
  HeartCrack,
  KeyRound,
  Mailbox,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import { useRecoveryCategories } from "../../data/api";
import Reveal from "./reveal";

const ICONS: Record<string, LucideIcon> = {
  ScanLine,
  KeyRound,
  HeartCrack,
  Bug,
  Building2,
  Mailbox,
};

export default function RecoveryCategories() {
  const CATEGORIES = useRecoveryCategories();
  return (
    <section
      id="categories"
      className="px-6 lg:px-10 py-16 max-w-7xl mx-auto scroll-mt-24"
    >
      <Reveal>
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-wider text-primary font-semibold">
            Recovery categories
          </span>
          <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
            Incident types we investigate
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Each category has its own forensic playbook, on-chain signatures, and
            counterparty engagement model.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CATEGORIES.map((cat, i) => {
          const Icon = ICONS[cat.icon] ?? ScanLine;
          return (
            <Reveal key={cat.id} delay={(i % 3) * 0.08}>
              <article className="group refunds-glass rounded-2xl p-5 h-full transition-transform duration-300 hover:-translate-y-1">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-4 transition-colors group-hover:bg-primary/20">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {cat.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {cat.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {cat.signals.map((s) => (
                    <span
                      key={s}
                      className="font-mono text-[10px] px-2 py-1 rounded-md border border-card-border bg-card/50 text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
