import { useLocation } from "wouter";
import {
  ArrowRight,
  FileSearch,
  LayoutDashboard,
  MessageSquareLock,
  Network,
  ShieldCheck,
} from "lucide-react";
import Reveal from "./reveal";

const NAV = [
  { icon: LayoutDashboard, label: "Vault overview", active: true },
  { icon: FileSearch, label: "Case intake" },
  { icon: Network, label: "Blockchain" },
  { icon: MessageSquareLock, label: "Secure messages" },
];

export default function DashboardPreview() {
  const [, navigate] = useLocation();

  return (
    <section className="px-6 lg:px-10 py-16 max-w-7xl mx-auto">
      <Reveal>
        <div className="max-w-2xl mb-8">
          <span className="text-xs uppercase tracking-wider text-primary font-semibold">
            Client dashboard preview
          </span>
          <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
            One console for the entire case
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Vault balances, investigation status, blockchain intelligence, and
            encrypted messaging — unified in a single secure portal.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="refunds-glass rounded-3xl p-3 sm:p-4">
          <div className="rounded-2xl border border-card-border bg-[hsl(var(--refunds-vault))] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border/60">
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--refunds-danger))]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--refunds-alert))]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--refunds-success))]" />
              <span className="ml-3 font-mono text-[10px] text-muted-foreground">
                netspyworld.com/portal
              </span>
            </div>

            <div className="grid grid-cols-[180px_1fr] min-h-[280px]">
              <aside className="hidden sm:flex flex-col gap-1 p-3 border-r border-card-border/60">
                {NAV.map((n) => (
                  <span
                    key={n.label}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                      n.active
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground"
                    }`}
                  >
                    <n.icon className="w-3.5 h-3.5" />
                    {n.label}
                  </span>
                ))}
              </aside>

              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {[
                    { l: "Recovered", v: "$88.2K", c: "text-[hsl(var(--refunds-success))]" },
                    { l: "At-risk", v: "$324.3K", c: "text-[hsl(var(--refunds-alert))]" },
                    { l: "Open cases", v: "3", c: "text-foreground" },
                    { l: "Risk score", v: "78", c: "text-primary" },
                  ].map((k) => (
                    <div
                      key={k.l}
                      className="rounded-xl bg-card/60 border border-card-border p-3"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {k.l}
                      </p>
                      <p className={`text-lg font-semibold tabular-nums ${k.c}`}>
                        {k.v}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-card/60 border border-card-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-foreground">
                      Recovery timeline
                    </span>
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="space-y-2">
                    {["Intake received", "Triage complete", "Investigation active"].map(
                      (t, i) => (
                        <div key={t} className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              i < 2 ? "bg-[hsl(var(--refunds-success))]" : "bg-primary"
                            }`}
                          />
                          <span className="text-xs text-muted-foreground">{t}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-3">
            <p className="text-[11px] text-muted-foreground">
              Illustrative interface — synthetic data.
            </p>
            <button
              onClick={() => navigate("/refunds/sign-up")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Explore the portal <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
