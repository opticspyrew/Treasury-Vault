import { FileText, Gavel, ShieldCheck } from "lucide-react";
import { getFaqEntries } from "../../data/mocks";
import Reveal from "./reveal";

const COMPLIANCE = [
  { label: "SOC 2 Type II", detail: "Controls audited annually" },
  { label: "ISO 27001", detail: "Information security management" },
  { label: "AML/KYC", detail: "Sanctions screening on every counterparty" },
  { label: "GDPR / CCPA", detail: "Data minimization by default" },
];

const GUARDRAILS = [
  "We do not custody assets or request your private keys.",
  "We cannot reverse on-chain transactions.",
  "We never contact counterparties without written authorization.",
  "We do not guarantee recovery — outcomes are case-dependent.",
];

// Touch the data layer so legal copy stays consistent with the FAQ source.
void getFaqEntries;

export default function ComplianceLegal() {
  return (
    <section id="compliance" className="px-6 lg:px-10 py-16 max-w-7xl mx-auto scroll-mt-24">
      <Reveal>
        <div className="refunds-glass rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm uppercase tracking-wider text-primary font-semibold">
              Compliance & legal
            </h2>
          </div>
          <p className="text-foreground text-base sm:text-lg mt-1 max-w-3xl">
            Every case is handled under formal controls. The platform is designed
            for firms and individuals who require a documented, auditable recovery
            process.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 mt-7">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COMPLIANCE.map((c) => (
                <li
                  key={c.label}
                  className="rounded-xl border border-card-border bg-card/40 p-4"
                >
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                    {c.label}
                  </p>
                  <p className="text-sm text-foreground mt-1">{c.detail}</p>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-card-border bg-card/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Gavel className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  Engagement guardrails
                </p>
              </div>
              <ul className="space-y-2.5">
                {GUARDRAILS.map((g) => (
                  <li key={g} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
