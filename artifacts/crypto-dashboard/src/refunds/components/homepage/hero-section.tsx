import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ScanLine, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function HeroSection() {
  const [, navigate] = useLocation();
  const { isAuthenticated, portalAccess } = useAuth();

  const handlePortalClick = () => {
    if (isAuthenticated && portalAccess) {
      navigate("/refunds/portal");
    } else if (isAuthenticated) {
      // Authenticated but pending approval — show the pending screen
      navigate("/refunds/portal");
    } else {
      navigate("/refunds/sign-in");
    }
  };

  return (
    <section className="px-6 lg:px-10 pt-10 pb-16 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-semibold bg-primary/10 border border-primary/25 text-primary">
            <ScanLine className="w-3.5 h-3.5" /> Digital investigation & asset
            recovery
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl xl:text-6xl font-semibold tracking-tight text-foreground leading-[1.04]">
            The unified console for
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              digital investigation & recovery.
            </span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground max-w-xl leading-relaxed">
            Netspy-World Forensics is an enterprise platform for digital
            investigation, blockchain intelligence, and the recovery of stolen or
            misdirected digital assets. Certified forensic analysts work cases under
            SOC 2 controls. Outcomes depend on jurisdiction, counterparty
            cooperation, and the underlying asset — we never guarantee recovery.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={handlePortalClick}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {isAuthenticated ? (
                <><LogIn className="w-4 h-4" /> Enter your portal</>
              ) : (
                <>Open secure portal <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
            <a
              href="#process"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg border border-card-border text-foreground hover:bg-card/60 transition-colors"
            >
              See how recovery works
            </a>
          </div>

          <dl className="mt-8 grid grid-cols-3 gap-4 max-w-md">
            {[
              { t: "Chains analyzed", v: "17" },
              { t: "Avg. triage", v: "< 6h" },
              { t: "Controls audit", v: "SOC 2" },
            ].map((s) => (
              <div key={s.t}>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {s.t}
                </dt>
                <dd className="text-xl font-semibold text-foreground tabular-nums mt-1">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="refunds-glass rounded-3xl p-6 refunds-scan-line">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary refunds-pulse-ring" />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-primary">
                  Live recovery vault
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                RF-2026-0184
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-card/60 border border-card-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Recovered
                </p>
                <p className="text-base font-semibold text-[hsl(var(--refunds-success))] tabular-nums">
                  $88.2K
                </p>
              </div>
              <div className="rounded-xl bg-card/60 border border-card-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  At-risk
                </p>
                <p className="text-base font-semibold text-[hsl(var(--refunds-alert))] tabular-nums">
                  $324.3K
                </p>
              </div>
              <div className="rounded-xl bg-card/60 border border-card-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Risk score
                </p>
                <p className="text-base font-semibold text-primary tabular-nums">
                  78/100
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-card/60 border border-card-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Path of funds
              </p>
              <svg viewBox="0 0 320 80" className="w-full h-16" aria-hidden="true">
                <defs>
                  <linearGradient id="hero-lp-edge" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(180 95% 55%)" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity="0.7" />
                  </linearGradient>
                </defs>
                <g stroke="url(#hero-lp-edge)" strokeWidth="1.2" fill="none">
                  <motion.path
                    d="M20 40 C 80 10, 160 10, 200 40"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.4, delay: 0.4 }}
                  />
                  <motion.path
                    d="M20 40 C 80 70, 160 70, 200 40"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.4, delay: 0.6 }}
                  />
                  <motion.path
                    d="M200 40 C 240 20, 280 10, 300 5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, delay: 0.9 }}
                  />
                  <motion.path
                    d="M200 40 C 240 60, 280 70, 300 75"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, delay: 1.0 }}
                  />
                </g>
                {[
                  { cx: 20, cy: 40, fill: "hsl(195 25% 96%)" },
                  { cx: 200, cy: 40, fill: "hsl(38 95% 55%)" },
                  { cx: 300, cy: 5, fill: "hsl(0 84% 60%)" },
                  { cx: 300, cy: 75, fill: "hsl(152 70% 45%)" },
                ].map((n, i) => (
                  <circle
                    key={i}
                    cx={n.cx}
                    cy={n.cy}
                    r="5"
                    fill={n.fill}
                    stroke="hsl(222 60% 5%)"
                    strokeWidth="2"
                  />
                ))}
              </svg>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Read-only
                on-chain analysis
              </span>
              <span className="text-[11px] text-muted-foreground">
                Illustrative — no real client data.
              </span>
            </div>
          </div>
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/10 via-transparent to-accent/10 blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
}
