import { useLocation } from "wouter";
import { ArrowLeft, Eye, Fingerprint, Hash, KeyRound, Lock, Radar, ScanLine, ShieldCheck } from "lucide-react";
import RefundsLogo from "../components/refunds-logo";

const PALETTE = [
  { token: "background", value: "220 60% 5%", role: "Vault — page base", swatch: "bg-background" },
  { token: "card", value: "222 45% 8%", role: "Surface — panels", swatch: "bg-card" },
  { token: "primary", value: "180 95% 50%", role: "Cyber teal — primary action", swatch: "bg-primary" },
  { token: "accent", value: "217 91% 60%", role: "Signal blue — secondary action / link", swatch: "bg-accent" },
  { token: "refunds-success", value: "152 70% 45%", role: "Recovered / verified", swatch: "bg-[hsl(var(--refunds-success))]" },
  { token: "refunds-alert", value: "38 95% 55%", role: "Investigation / attention", swatch: "bg-[hsl(var(--refunds-alert))]" },
  { token: "destructive", value: "0 84% 60%", role: "Compromised / blocked", swatch: "bg-destructive" },
  { token: "muted-foreground", value: "215 15% 62%", role: "Secondary text", swatch: "bg-[hsl(var(--muted-foreground))]" },
];

const TYPE_SCALE = [
  { label: "Display L — 36/700", className: "text-4xl font-semibold tracking-tight", sample: "Netspy-World Forensics console" },
  { label: "Heading — 24/600", className: "text-2xl font-semibold", sample: "Recovery Vault overview" },
  { label: "Subheading — 18/600", className: "text-lg font-semibold", sample: "Live intelligence feed" },
  { label: "Body — 14/400", className: "text-sm", sample: "Outcomes depend on jurisdiction and counterparty cooperation." },
  { label: "Caption — 12/500", className: "text-xs font-medium uppercase tracking-wider text-muted-foreground", sample: "Last updated 2 minutes ago" },
  { label: "Forensic — 12/500 mono", className: "text-xs font-mono", sample: "0x7f3c9d2a4b8e1c5f6a9d2e3b4c5d6e7f8a9b0c1d" },
];

const ICONS = [
  { icon: <ShieldCheck className="w-5 h-5" />, name: "ShieldCheck" },
  { icon: <Lock className="w-5 h-5" />, name: "Lock" },
  { icon: <KeyRound className="w-5 h-5" />, name: "KeyRound" },
  { icon: <Fingerprint className="w-5 h-5" />, name: "Fingerprint" },
  { icon: <Eye className="w-5 h-5" />, name: "Eye" },
  { icon: <ScanLine className="w-5 h-5" />, name: "ScanLine" },
  { icon: <Radar className="w-5 h-5" />, name: "Radar" },
  { icon: <Hash className="w-5 h-5" />, name: "Hash" },
];

export default function BrandGuide() {
  const [, navigate] = useLocation();

  return (
    <div className="refunds-scope min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 -z-10 refunds-radial" />
      <div className="absolute inset-0 -z-10 refunds-grid-bg opacity-40" />

      <header className="max-w-6xl mx-auto px-6 lg:px-8 pt-6 pb-4 flex items-center justify-between">
        <RefundsLogo size={32} />
        <button
          onClick={() => navigate("/refunds")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6 space-y-10">
        <section>
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">Brand system</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight mt-2">
            Netspy-World Forensics visual identity
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-3 leading-relaxed">
            A live reference of the namespaced design system. Every token, surface, and
            motion below is consumed by the portal. The full written reference lives in
            <code className="px-1 py-0.5 rounded bg-card border border-card-border text-foreground/90 ml-1">
              src/refunds/BRAND.md
            </code>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Logo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="refunds-glass rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
              <RefundsLogo size={56} />
              <p className="text-[11px] text-muted-foreground">Default lock-up</p>
            </div>
            <div className="refunds-glass rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
              <RefundsLogo size={48} showWordmark={false} />
              <p className="text-[11px] text-muted-foreground">Glyph only — below 24px height</p>
            </div>
            <div className="refunds-glass rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
              <RefundsLogo size={56} animateUnlock />
              <p className="text-[11px] text-muted-foreground">Unlock motion — auth success only</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Trust palette</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {PALETTE.map((p) => (
              <div key={p.token} className="refunds-glass rounded-xl overflow-hidden">
                <div className={`h-16 ${p.swatch}`} />
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground">{p.token}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">hsl({p.value})</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Typography</h2>
          <div className="refunds-glass rounded-2xl p-5 space-y-4">
            {TYPE_SCALE.map((t) => (
              <div key={t.label} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 items-baseline border-b border-card-border/60 last:border-0 pb-3 last:pb-0">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{t.label}</p>
                <p className={`${t.className} text-foreground`}>{t.sample}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Glassmorphism surfaces</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5 refunds-glass">
              <p className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-1">refunds-glass</p>
              <p className="text-sm text-foreground">Primary panels — cards, modals, hero overlays.</p>
              <p className="text-xs text-muted-foreground mt-2">blur(14px) saturate(140%), 60–75% surface opacity.</p>
            </div>
            <div className="rounded-2xl p-5 refunds-glass-soft">
              <p className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-1">refunds-glass-soft</p>
              <p className="text-sm text-foreground">Inline widgets layered over other panels.</p>
              <p className="text-xs text-muted-foreground mt-2">blur(10px) saturate(130%), 25–55% surface opacity.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Component variants</h2>
          <div className="refunds-glass rounded-2xl p-5 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Buttons</p>
              <div className="flex flex-wrap gap-2">
                <button className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90">Primary</button>
                <button className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-card-border text-foreground hover:bg-card/60">Secondary</button>
                <button className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-card/60 border border-primary/30 text-primary hover:bg-primary/10">Tertiary</button>
                <button className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20">Destructive</button>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Inputs</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="Standard input"
                  className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  placeholder="0x… (forensic / mono)"
                  className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Status pills</p>
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider font-semibold">
                <span className="px-2 py-1 rounded-md border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">Recovered</span>
                <span className="px-2 py-1 rounded-md border bg-sky-500/10 text-sky-300 border-sky-500/30">Triage</span>
                <span className="px-2 py-1 rounded-md border bg-primary/10 text-primary border-primary/30">Investigation</span>
                <span className="px-2 py-1 rounded-md border bg-amber-500/10 text-amber-300 border-amber-500/30">Attention</span>
                <span className="px-2 py-1 rounded-md border bg-red-500/10 text-red-300 border-red-500/30">Compromised</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Iconography</h2>
          <div className="refunds-glass rounded-2xl p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-primary">
              {ICONS.map((i) => (
                <div key={i.name} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-card-border bg-card/40">
                  {i.icon}
                  <span className="text-[10px] text-muted-foreground font-mono">{i.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Motion principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="refunds-glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-primary refunds-pulse-ring" />
                <p className="text-sm font-medium text-foreground">refunds-pulse-ring</p>
              </div>
              <p className="text-xs text-muted-foreground">For the single most important live indicator on a screen.</p>
            </div>
            <div className="refunds-glass rounded-2xl p-5 refunds-scan-line">
              <p className="text-sm font-medium text-foreground mb-1">refunds-scan-line</p>
              <p className="text-xs text-muted-foreground">A slow sweep on panels under live analysis. Never on idle content.</p>
            </div>
            <div className="refunds-glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--refunds-alert))] refunds-pulse-alert" />
                <p className="text-sm font-medium text-foreground">refunds-pulse-alert</p>
              </div>
              <p className="text-xs text-muted-foreground">Reserved for items requiring human action.</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            All animations respect <code className="font-mono">prefers-reduced-motion: reduce</code>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Voice guardrails</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="refunds-glass rounded-2xl p-5">
              <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold mb-2">Approved</p>
              <ul className="text-sm text-foreground space-y-2 list-disc pl-5">
                <li>"We analyze on-chain activity to identify the path of stolen funds."</li>
                <li>"We coordinate with regulated exchanges and your counsel during authorized recovery actions."</li>
                <li>"Recovery outcomes depend on jurisdiction, counterparty cooperation, and the underlying asset."</li>
              </ul>
            </div>
            <div className="refunds-glass rounded-2xl p-5">
              <p className="text-[11px] uppercase tracking-wider text-red-300 font-semibold mb-2">Prohibited</p>
              <ul className="text-sm text-foreground space-y-2 list-disc pl-5">
                <li>"Guaranteed recovery", "100% success rate", "instantly"</li>
                <li>Countdown timers urging the user to act</li>
                <li>Fake star ratings, fabricated logos, made-up press mentions</li>
                <li>Implying we contact law enforcement without explicit consent</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
