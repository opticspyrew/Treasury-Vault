import { useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock,
  FileText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import RefundsPublicLayout from "../components/refunds-public-layout";
import Reveal from "../components/homepage/reveal";
import { refundsGo } from "../data/nav";

interface Briefing {
  id: string;
  category: string;
  title: string;
  readMinutes: number;
  summary: string;
  body: string[];
}

const BRIEFINGS: Briefing[] = [
  {
    id: "approval-drains",
    category: "Threat intel",
    title: "How approval drainers empty a wallet in a single signature",
    readMinutes: 7,
    summary:
      "The token-approval pattern behind the year's most common self-custody losses — and the on-chain signals that expose it.",
    body: [
      "Approval drainers rely on a victim signing an ERC-20 approval (or Permit2 signature) that grants a malicious contract unlimited spending rights over a token. No funds move at signing time, so the wallet looks fine — until the attacker calls transferFrom and sweeps the balance later.",
      "The exposed signals are consistent: an approval to an unverified contract, an unusually high or unlimited allowance, and an outbound transfer to a freshly funded address minutes or hours later. Tracing the recipient usually reveals a consolidation wallet that batches victims together.",
      "If you have signed something suspicious, revoke outstanding approvals immediately and move remaining assets to a new wallet. Preserve the transaction hashes — they are the starting point for any trace.",
    ],
  },
  {
    id: "chain-of-custody",
    category: "Compliance",
    title: "Building evidence that holds up: chain-of-custody for digital assets",
    readMinutes: 9,
    summary:
      "What separates a screenshot from admissible forensic evidence, and how hashing and sealing preserve integrity.",
    body: [
      "A screenshot proves almost nothing on its own — it can be edited, and it carries no proof of when or how it was collected. Evidence-grade artifacts are captured, hashed with SHA-256, sealed, and logged so that any later tampering is detectable.",
      "A defensible chain of custody records who collected each item, when, and every subsequent access. That log is what lets counsel and counterparties rely on the underlying data.",
      "When you open a case, uploads are hashed and sealed automatically, and access is scoped to your assigned analysts — the same controls that make findings usable in formal proceedings.",
    ],
  },
  {
    id: "bridge-tracing",
    category: "Investigations",
    title: "Following funds across bridges without losing the trail",
    readMinutes: 8,
    summary:
      "Cross-chain laundering is designed to break attribution. Here is how analysts re-stitch the path of funds.",
    body: [
      "Bridges move value between chains by locking or burning on one side and minting or releasing on the other. Attackers exploit this to break a naive trace: the funds appear to vanish on the source chain.",
      "Analysts re-stitch the path by matching amounts, timing, and bridge event logs across both chains, then continuing the trace on the destination network. Mixers add noise but rarely defeat amount-and-timing correlation entirely.",
      "Speed matters — the longer funds sit on the far side, the more hops and conversions accumulate. Early tracing keeps the trail intact while assets are still attributable.",
    ],
  },
  {
    id: "fake-recovery",
    category: "Fraud",
    title: "Spotting the fake 'recovery service' that targets victims twice",
    readMinutes: 6,
    summary:
      "After a loss, a second wave of scammers promises guaranteed recovery for a large upfront fee. Here is the pattern.",
    body: [
      "Recovery scams find victims where they post about losses. They promise guaranteed results, ask for a large upfront payment, and often impersonate law firms, government agencies, or analytics vendors.",
      "The tells are reliable: a guarantee (no legitimate firm offers one), pressure to pay quickly, requests for your seed phrase or remote access, and payment in crypto to a personal wallet.",
      "A legitimate firm assesses recoverability first, scopes work in writing, and weights fees to outcomes. If someone guarantees your money back for a fee paid today, treat it as a second attack.",
    ],
  },
];

interface CaseStudy {
  icon: LucideIcon;
  title: string;
  lossBand: string;
  chains: string;
  approach: string[];
  outcome: string;
  caveat: string;
}

const CASE_STUDIES: CaseStudy[] = [
  {
    icon: FileText,
    title: "OTC desk impersonation drain",
    lossBand: "Six-figure USD",
    chains: "Ethereum · USDC / ETH",
    approach: [
      "Mapped two outflows to a sanctioned mixer relay and an unhosted cluster",
      "Identified a downstream deposit at a regulated exchange",
      "Filed a documented freeze and information request via counsel",
    ],
    outcome:
      "A portion of funds was frozen at the regulated venue and an evidence package was handed to counsel for recovery proceedings.",
    caveat:
      "Funds routed through the sanctioned mixer were not recoverable. Outcomes depend on which path each tranche took.",
  },
  {
    icon: FileText,
    title: "Romance-scam deposit funnel",
    lossBand: "Mid five-figure USD",
    chains: "Bitcoin",
    approach: [
      "Traced layered deposit wallets back to a consolidation address",
      "Correlated timing across victims to attribute the cluster",
      "Engaged the receiving exchange with a structured request",
    ],
    outcome:
      "The majority of the traced balance was returned after the exchange confirmed and actioned the freeze request.",
    caveat:
      "Rapid intake was decisive — the recovery window was closing as funds were being cashed out.",
  },
  {
    icon: FileText,
    title: "Approval-exploit phishing drain",
    lossBand: "Low five-figure USD",
    chains: "Polygon · USDC",
    approach: [
      "Confirmed an unlimited approval to a known drainer contract",
      "Traced the sweep to a single attacker-controlled wallet",
      "Requested an expedited freeze at the cash-out venue",
    ],
    outcome:
      "Funds were fully recovered after a fast freeze at the regulated cash-out point before the assets could be moved off-platform.",
    caveat:
      "Full recovery is the exception, not the rule — it was possible here only because the attacker cashed out at a cooperative venue.",
  },
];

const FIRST_STEPS = [
  "Stop interacting with the compromised wallet — do not send 'unlock' or 'gas' fees to anyone.",
  "Move any remaining assets to a brand-new wallet with a fresh seed phrase.",
  "Save every transaction hash, address, and message — these are your evidence.",
  "Do not pay an upfront fee to anyone guaranteeing recovery.",
  "Open a case as early as possible; recovery windows narrow quickly.",
];

export default function RefundsKnowledgeBase() {
  const [location, navigate] = useLocation();
  const go = (href: string) => refundsGo(href, location, navigate);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <RefundsPublicLayout>
      <div data-testid="refunds-knowledge-base-page">
        {/* Hero */}
        <section className="px-6 lg:px-10 pt-16 pb-10 max-w-7xl mx-auto">
          <Reveal>
            <span className="text-xs uppercase tracking-wider text-primary font-semibold">
              Knowledge base
            </span>
            <h1 className="mt-3 text-4xl sm:text-5xl font-semibold text-foreground tracking-tight max-w-3xl">
              Field-tested guidance for crypto loss and recovery
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
              Briefings from our analysts and anonymized case studies from real
              investigation patterns. Use them to understand what happened, what
              to preserve, and what an honest recovery process looks like.
            </p>
          </Reveal>
        </section>

        {/* Briefings */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-xs uppercase tracking-wider text-primary font-semibold">
                Latest briefings
              </span>
              <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
                Understand the threat before you act
              </h2>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {BRIEFINGS.map((b, i) => {
              const open = openId === b.id;
              return (
                <Reveal
                  as="article"
                  key={b.id}
                  delay={i * 0.06}
                  className="refunds-glass rounded-2xl p-6 h-full"
                >
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider font-semibold">
                    <span className="text-primary">{b.category}</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground normal-case font-normal">
                      <Clock className="w-3 h-3" /> {b.readMinutes} min read
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-foreground leading-snug">
                    {b.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {b.summary}
                  </p>

                  {open && (
                    <div className="mt-4 space-y-3 border-t border-card-border/60 pt-4">
                      {b.body.map((p, idx) => (
                        <p
                          key={idx}
                          className="text-sm text-muted-foreground leading-relaxed"
                        >
                          {p}
                        </p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setOpenId(open ? null : b.id)}
                    aria-expanded={open}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
                  >
                    {open ? "Show less" : "Read briefing"}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Case studies */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-xs uppercase tracking-wider text-primary font-semibold">
                Case studies
              </span>
              <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
                Anonymized outcomes from real patterns
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Illustrative summaries based on investigation patterns we see.
                Figures are shown as ranges and contain no client-identifying
                detail.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {CASE_STUDIES.map((c, i) => {
              const Icon = c.icon;
              return (
                <Reveal
                  as="article"
                  key={c.title}
                  delay={i * 0.06}
                  className="refunds-glass rounded-2xl p-6 h-full flex flex-col"
                >
                  <span className="inline-flex w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground leading-snug">
                    {c.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-card/60 border border-card-border px-2.5 py-1 text-muted-foreground">
                      {c.lossBand}
                    </span>
                    <span className="rounded-full bg-card/60 border border-card-border px-2.5 py-1 text-muted-foreground font-mono">
                      {c.chains}
                    </span>
                  </div>

                  <p className="mt-4 text-[11px] uppercase tracking-wider text-foreground font-semibold">
                    Approach
                  </p>
                  <ul className="mt-2 space-y-1.5 flex-1">
                    {c.approach.map((a) => (
                      <li
                        key={a}
                        className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed"
                      >
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 rounded-xl bg-primary/10 border border-primary/25 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-primary font-semibold">
                      Outcome
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {c.outcome}
                    </p>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed italic">
                    {c.caveat}
                  </p>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* First steps */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal className="refunds-glass rounded-2xl p-8">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                If you have just been hit — first five steps
              </h2>
            </div>
            <ol className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIRST_STEPS.map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="w-7 h-7 shrink-0 rounded-lg bg-primary/15 border border-primary/30 text-primary font-mono text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-muted-foreground leading-relaxed">
                    {s}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        {/* CTA */}
        <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto">
          <Reveal className="refunds-glass rounded-2xl p-8 text-center">
            <BookOpen className="w-7 h-7 text-primary mx-auto" />
            <h2 className="mt-3 text-2xl font-semibold text-foreground tracking-tight">
              Have a live incident?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Open a secure case and an analyst will review your transaction
              hashes and give you an honest recoverability assessment.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => go("/refunds/sign-up")}
                className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Open a case <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => go("/refunds#faq")}
                className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-medium rounded-lg border border-card-border bg-card/40 text-foreground hover:bg-card/70 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-primary" />
                Read the FAQ
              </button>
            </div>
          </Reveal>
        </section>
      </div>
    </RefundsPublicLayout>
  );
}
