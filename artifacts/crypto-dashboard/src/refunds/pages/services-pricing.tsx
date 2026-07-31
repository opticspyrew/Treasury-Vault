import { useLocation } from "wouter";
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  Fingerprint,
  Lock,
  Radar,
  Scale,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import RefundsPublicLayout from "../components/refunds-public-layout";
import Reveal from "../components/homepage/reveal";
import { refundsGo } from "../data/nav";

interface Service {
  icon: LucideIcon;
  name: string;
  summary: string;
  deliverables: string[];
}

const SERVICES: Service[] = [
  {
    icon: Activity,
    name: "Forensic triage & recoverability assessment",
    summary:
      "Before any fee, we validate the loss and tell you honestly whether the assets are recoverable.",
    deliverables: [
      "Loss validation and asset scoping",
      "Recoverability score with written rationale",
      "Recommended next actions and timeline",
    ],
  },
  {
    icon: Fingerprint,
    name: "Blockchain tracing & attribution",
    summary:
      "We reconstruct the full path of funds across chains, mixers, and bridges to identify where assets came to rest.",
    deliverables: [
      "Cross-chain path-of-funds mapping",
      "Counterparty and wallet-cluster attribution",
      "Mixer and bridge-hop reconstruction",
    ],
  },
  {
    icon: ScrollText,
    name: "Evidence & chain-of-custody packaging",
    summary:
      "Findings are preserved as tamper-evident, court-ready exhibits — not screenshots.",
    deliverables: [
      "SHA-256 hashed and sealed exhibits",
      "Tamper-evident chain-of-custody log",
      "Evidence-grade investigation report",
    ],
  },
  {
    icon: Scale,
    name: "Legal & VASP coordination",
    summary:
      "With your written authorization we engage regulated venues, custodians, and counsel where funds can lawfully be frozen.",
    deliverables: [
      "Exchange freeze and information requests",
      "VASP and custodian engagement",
      "Counsel-ready documentation",
    ],
  },
  {
    icon: Building2,
    name: "Law-enforcement liaison",
    summary:
      "We prepare referral packages and act as a technical liaison to the authorities handling your matter.",
    deliverables: [
      "Referral packages for authorities",
      "Jurisdictional routing guidance",
      "Liaison support on active investigations",
    ],
  },
  {
    icon: Radar,
    name: "Continuous on-chain monitoring",
    summary:
      "Recovery windows close as funds move. We watch monitored clusters and re-trace the moment they do.",
    deliverables: [
      "Live alerts on monitored clusters",
      "Automatic re-tracing after fund movement",
      "Recovery-window notifications",
    ],
  },
];

interface Engagement {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
}

const ENGAGEMENTS: Engagement[] = [
  {
    name: "Initial consultation",
    price: "Complimentary",
    blurb: "An honest first look at whether your case is recoverable.",
    features: [
      "Intake review of your incident",
      "Preliminary path-of-funds check",
      "Recoverability assessment",
      "No obligation to proceed",
    ],
    cta: { label: "Start free", href: "/refunds/sign-up" },
  },
  {
    name: "Forensic investigation",
    price: "Tailored quote",
    blurb: "Full tracing, attribution, and an evidence-grade report.",
    features: [
      "End-to-end on-chain tracing",
      "Counterparty attribution",
      "Chain-of-custody evidence package",
      "Written investigation report",
    ],
    cta: { label: "Request a quote", href: "/refunds/sign-up" },
    featured: true,
  },
  {
    name: "Recovery coordination",
    price: "Success-based fee",
    blurb:
      "We engage venues, custodians, and counsel — you pay primarily on results.",
    features: [
      "VASP and exchange coordination",
      "Freeze and information requests",
      "Counsel and law-enforcement liaison",
      "Fee weighted to recovered assets",
    ],
    cta: { label: "Open a case", href: "/refunds/sign-up" },
  },
  {
    name: "Expert reporting & testimony",
    price: "Fixed scope",
    blurb: "Court-ready documentation and expert declarations.",
    features: [
      "Evidentiary report preparation",
      "Expert declarations and affidavits",
      "Exhibit and custody attestations",
      "Coordination with your legal team",
    ],
    cta: { label: "Discuss scope", href: "/refunds/sign-in" },
  },
];

const PRINCIPLES = [
  "No upfront tracing fee for qualifying cases",
  "Fees weighted to outcomes, never to promises",
  "Transparent, written scope before any work begins",
  "We will never ask for your seed phrase or private keys",
];

export default function RefundsServices() {
  const [location, navigate] = useLocation();
  const go = (href: string) => refundsGo(href, location, navigate);

  return (
    <RefundsPublicLayout>
      <div data-testid="refunds-services-page">
        {/* Hero */}
        <section className="px-6 lg:px-10 pt-16 pb-10 max-w-7xl mx-auto">
          <Reveal>
            <span className="text-xs uppercase tracking-wider text-primary font-semibold">
              Services &amp; engagement
            </span>
            <h1 className="mt-3 text-4xl sm:text-5xl font-semibold text-foreground tracking-tight max-w-3xl">
              Investigation and recovery, scoped to your case
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
              Netspy-World Forensics combines blockchain intelligence, evidence
              discipline, and legal coordination into a single engagement. You
              only pay for work that is scoped and agreed in writing — and our
              recovery fees are weighted to the assets we actually return.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => go("/refunds/sign-up")}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Open a case <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => go("/refunds/sign-in")}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-lg border border-card-border bg-card/40 text-foreground hover:bg-card/70 transition-colors"
              >
                Talk to an analyst
              </button>
            </div>
          </Reveal>
        </section>

        {/* Services */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-xs uppercase tracking-wider text-primary font-semibold">
                What we do
              </span>
              <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
                Six disciplines, one accountable team
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Every engagement draws on the capabilities below. Each produces
                evidence you can review inside the secure portal.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal
                  as="article"
                  key={s.name}
                  delay={i * 0.06}
                  className="refunds-glass rounded-2xl p-6 h-full"
                >
                  <span className="inline-flex w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {s.name}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {s.summary}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {s.deliverables.map((d) => (
                      <li
                        key={d}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Engagement / pricing model */}
        <section
          id="pricing"
          className="px-6 lg:px-10 py-12 max-w-7xl mx-auto scroll-mt-24"
        >
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-xs uppercase tracking-wider text-primary font-semibold">
                Engagement models
              </span>
              <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
                Pricing aligned to outcomes
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                We publish how we charge, not a fixed price — every case differs
                in chain, complexity, and counterparty. You receive a written
                scope and quote before any billable work.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ENGAGEMENTS.map((e, i) => (
              <Reveal
                key={e.name}
                delay={i * 0.06}
                className={`refunds-glass rounded-2xl p-6 h-full flex flex-col ${
                  e.featured ? "ring-1 ring-primary/50" : ""
                }`}
              >
                {e.featured && (
                  <span className="self-start mb-3 text-[10px] uppercase tracking-wider font-semibold text-primary-foreground bg-primary rounded-full px-2.5 py-1">
                    Most requested
                  </span>
                )}
                <h3 className="text-sm font-semibold text-foreground">
                  {e.name}
                </h3>
                <p className="mt-2 text-2xl font-semibold text-primary tracking-tight">
                  {e.price}
                </p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {e.blurb}
                </p>
                <ul className="mt-4 space-y-2 flex-1">
                  {e.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => go(e.cta.href)}
                  className={`mt-5 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    e.featured
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-card-border bg-card/40 text-foreground hover:bg-card/70"
                  }`}
                >
                  {e.cta.label} <ArrowRight className="w-4 h-4" />
                </button>
              </Reveal>
            ))}
          </div>

          {/* Principles */}
          <Reveal className="mt-6 refunds-glass-soft rounded-2xl p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PRINCIPLES.map((p) => (
                <div key={p} className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {p}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Honesty disclaimer */}
        <section className="px-6 lg:px-10 pb-4 max-w-7xl mx-auto">
          <Reveal className="refunds-glass rounded-2xl p-6 border-l-2 border-l-primary/60">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 mt-0.5 text-primary shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  No one can guarantee recovery
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-3xl">
                  On-chain transactions are final and cannot be reversed. Outcomes
                  depend on jurisdiction, counterparty cooperation, and how quickly
                  funds are traced. Be cautious of any service that demands a large
                  upfront fee and promises a guaranteed return — that pattern is
                  itself one of the most common secondary scams targeting victims.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* CTA */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal className="refunds-glass rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">
              Start with a free recoverability assessment
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Open a secure case file and an analyst will review your incident.
              No obligation, no upfront tracing fee for qualifying cases.
            </p>
            <button
              onClick={() => go("/refunds/sign-up")}
              className="mt-6 inline-flex items-center gap-1.5 px-6 py-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Open a case <ArrowRight className="w-4 h-4" />
            </button>
          </Reveal>
        </section>
      </div>
    </RefundsPublicLayout>
  );
}
