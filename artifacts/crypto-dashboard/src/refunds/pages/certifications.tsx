import { useLocation } from "wouter";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Building2,
  Eye,
  FileCheck2,
  Globe,
  Lock,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import RefundsPublicLayout from "../components/refunds-public-layout";
import Reveal from "../components/homepage/reveal";
import { refundsGo } from "../data/nav";

interface Framework {
  icon: LucideIcon;
  name: string;
  status: string;
  detail: string;
}

const FRAMEWORKS: Framework[] = [
  {
    icon: ShieldCheck,
    name: "SOC 2 Type II",
    status: "Controls maintained",
    detail:
      "Security, availability, and confidentiality controls governing how case data is stored, accessed, and audited.",
  },
  {
    icon: Lock,
    name: "ISO/IEC 27001",
    status: "ISMS aligned",
    detail:
      "An information-security management system covering risk assessment, access control, and continuous improvement.",
  },
  {
    icon: Globe,
    name: "GDPR & UK DPA 2018",
    status: "Compliant by design",
    detail:
      "Data minimization, lawful processing, and subject-access support for EU and UK clients and counterparties.",
  },
  {
    icon: FileCheck2,
    name: "AML / KYC & sanctions",
    status: "Screening enforced",
    detail:
      "Client onboarding and counterparty screening against OFAC, EU, and UN consolidated sanctions lists.",
  },
  {
    icon: ScrollText,
    name: "Chain-of-custody standards",
    status: "Court-ready",
    detail:
      "Evidence is hashed (SHA-256), sealed, and logged to a tamper-evident custody record suitable for proceedings.",
  },
  {
    icon: Eye,
    name: "Read-only investigation policy",
    status: "Strictly enforced",
    detail:
      "We never custody assets or request private keys. On-chain work is read-only unless you authorize a specific action in writing.",
  },
];

interface Credential {
  abbr: string;
  name: string;
  detail: string;
}

const CREDENTIALS: Credential[] = [
  {
    abbr: "CFE",
    name: "Certified Fraud Examiner",
    detail: "Fraud examination, financial investigation, and evidence handling.",
  },
  {
    abbr: "CAMS",
    name: "Certified Anti-Money Laundering Specialist",
    detail: "AML typologies, sanctions, and regulated-entity engagement.",
  },
  {
    abbr: "GCFA",
    name: "GIAC Certified Forensic Analyst",
    detail: "Digital forensics, artifact analysis, and incident response.",
  },
  {
    abbr: "CCI",
    name: "Certified Cryptocurrency Investigator",
    detail: "Blockchain tracing, attribution, and on-chain intelligence.",
  },
];

const STANDARDS = [
  "FATF Travel Rule guidance for VASP information exchange",
  "Engagement only with regulated, licensed counterparties",
  "Independent annual control audits",
  "Written client authorization for every external action",
  "Encryption in transit and at rest (AES-256)",
  "Least-privilege, analyst-scoped case access",
];

export default function RefundsCertifications() {
  const [location, navigate] = useLocation();
  const go = (href: string) => refundsGo(href, location, navigate);

  return (
    <RefundsPublicLayout>
      <div data-testid="refunds-certifications-page">
        {/* Hero */}
        <section className="px-6 lg:px-10 pt-16 pb-10 max-w-7xl mx-auto">
          <Reveal>
            <span className="text-xs uppercase tracking-wider text-primary font-semibold">
              Certifications &amp; compliance
            </span>
            <h1 className="mt-3 text-4xl sm:text-5xl font-semibold text-foreground tracking-tight max-w-3xl">
              Operating under formal forensic controls
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
              Trust in asset recovery is earned through process, not promises.
              Netspy-World Forensics works under the security frameworks,
              compliance obligations, and evidentiary standards below — so the
              work we produce holds up to scrutiny.
            </p>
          </Reveal>
        </section>

        {/* Frameworks */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-xs uppercase tracking-wider text-primary font-semibold">
                Frameworks &amp; controls
              </span>
              <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
                The standards we hold ourselves to
              </h2>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FRAMEWORKS.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal
                  as="article"
                  key={f.name}
                  delay={i * 0.06}
                  className="refunds-glass rounded-2xl p-6 h-full"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 border border-primary/25 rounded-full px-2.5 py-1">
                      <BadgeCheck className="w-3 h-3" />
                      {f.status}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {f.name}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {f.detail}
                  </p>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Analyst credentials */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
            <Reveal>
              <span className="text-xs uppercase tracking-wider text-primary font-semibold">
                Professional credentials
              </span>
              <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
                Investigators who are certified, not anonymous
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Cases are led by analysts who hold recognized investigation,
                anti-money-laundering, and digital-forensics certifications, and
                who work under documented procedures and oversight.
              </p>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CREDENTIALS.map((c, i) => (
                <Reveal
                  key={c.abbr}
                  delay={i * 0.06}
                  className="refunds-glass rounded-2xl p-5 h-full"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 text-accent items-center justify-center font-mono text-sm font-semibold">
                      {c.abbr}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                      {c.name}
                    </h3>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    {c.detail}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Standards band */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal className="refunds-glass rounded-2xl p-8">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                How we operate, in practice
              </h2>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STANDARDS.map((s) => (
                <div key={s} className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground leading-relaxed">
                    {s}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[11px] text-muted-foreground">
              Certification and audit status is maintained through independent
              review. This site presents the firm&apos;s operating standards;
              specific attestations are shared with clients under engagement.
            </p>
          </Reveal>
        </section>

        {/* CTA */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal className="refunds-glass rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">
              Work with a team you can verify
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Open a secure case and review our process, credentials, and scope
              before you commit to anything.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => go("/refunds/sign-up")}
                className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Open a case <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => go("/refunds/services")}
                className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-medium rounded-lg border border-card-border bg-card/40 text-foreground hover:bg-card/70 transition-colors"
              >
                <Building2 className="w-4 h-4 text-primary" />
                View services
              </button>
            </div>
          </Reveal>
        </section>
      </div>
    </RefundsPublicLayout>
  );
}
