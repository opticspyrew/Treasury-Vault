import { BadgeCheck, Fingerprint, Lock, Scale } from "lucide-react";
import Reveal from "./reveal";

const BADGES = [
  { icon: BadgeCheck, label: "SOC 2 Type II" },
  { icon: Lock, label: "ISO 27001" },
  { icon: Scale, label: "AML / KYC screening" },
  { icon: Fingerprint, label: "GDPR / CCPA aligned" },
];

const CHAINS = [
  "Bitcoin",
  "Ethereum",
  "Tron",
  "BNB Chain",
  "Polygon",
  "Arbitrum",
  "Solana",
  "Base",
];

export default function TrustIndicators() {
  return (
    <section className="px-6 lg:px-10 py-10 max-w-7xl mx-auto">
      <Reveal>
        <div className="refunds-glass-soft rounded-2xl p-6 sm:p-7">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold text-center">
            Operated under formal controls — trusted by firms, counsel, and
            individuals
          </p>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {BADGES.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2.5 rounded-xl border border-card-border bg-card/40 px-4 py-3"
              >
                <b.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {b.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-card-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Networks under analysis
            </p>
            <div className="flex flex-wrap gap-2">
              {CHAINS.map((c) => (
                <span
                  key={c}
                  className="font-mono text-xs px-3 py-1.5 rounded-full border border-card-border bg-card/50 text-muted-foreground"
                >
                  {c}
                </span>
              ))}
              <span className="font-mono text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
                +9 more
              </span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
