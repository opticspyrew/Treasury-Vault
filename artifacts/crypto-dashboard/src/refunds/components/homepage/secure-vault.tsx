import { useLocation } from "wouter";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import Reveal from "./reveal";

const FEATURES = [
  "Per-case encrypted file with scoped analyst access",
  "Recovered, at-risk, and monitored balances at a glance",
  "Tamper-evident chain of custody on every artifact",
  "Read-only on-chain analysis until you authorize action",
];

export default function SecureVault() {
  const [, navigate] = useLocation();

  return (
    <section className="px-6 lg:px-10 py-16 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <Reveal>
          <div>
            <span className="text-xs uppercase tracking-wider text-primary font-semibold">
              Secure recovery vault
            </span>
            <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
              Your case, sealed and auditable
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              The vault is the single source of truth for a case — balances,
              evidence, and status — protected by enterprise-grade controls and
              visible only to you and your assigned analysts.
            </p>
            <ul className="mt-6 space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/refunds/sign-up")}
              className="mt-7 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Open your vault <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative">
            <div className="refunds-glass rounded-3xl p-6 refunds-vault-bg">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-primary" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Recovery vault
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      RF-2026-0184 · sealed
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--refunds-success))]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--refunds-success))]" />
                  AES-256
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-card/60 border border-card-border p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Recovered
                  </p>
                  <p className="text-xl font-semibold text-[hsl(var(--refunds-success))] tabular-nums mt-1">
                    $88,240
                  </p>
                </div>
                <div className="rounded-xl bg-card/60 border border-card-border p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    At-risk
                  </p>
                  <p className="text-xl font-semibold text-[hsl(var(--refunds-alert))] tabular-nums mt-1">
                    $324,300
                  </p>
                </div>
                <div className="rounded-xl bg-card/60 border border-card-border p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Monitored
                  </p>
                  <p className="text-xl font-semibold text-foreground tabular-nums mt-1">
                    7 addrs
                  </p>
                </div>
                <div className="rounded-xl bg-card/60 border border-card-border p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Risk score
                  </p>
                  <p className="text-xl font-semibold text-primary tabular-nums mt-1">
                    78/100
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-muted-foreground">
                Illustrative — synthetic demonstration data.
              </p>
            </div>
            <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
