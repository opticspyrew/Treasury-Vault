import { Bot, Sparkles, User } from "lucide-react";
import Reveal from "./reveal";

const THREAD = [
  {
    role: "user" as const,
    text: "What's the current status of my ETH recovery case?",
  },
  {
    role: "assistant" as const,
    text: "Case RF-2026-0184 is in active investigation. 12.4 ETH was traced through two hops into a mixer cluster; a portion has since settled at a regulated venue, which makes counterparty engagement eligible.",
  },
  {
    role: "user" as const,
    text: "What should I do next?",
  },
  {
    role: "assistant" as const,
    text: "Your analyst has drafted an authorization request to engage the venue. Review and approve it in the portal — I can't take that action on your behalf.",
  },
];

const CAPS = [
  "Summarizes case status in plain language",
  "Surfaces the next recommended action",
  "Cites the on-chain evidence behind each answer",
];

export default function AiAssistantSection() {
  return (
    <section id="assistant" className="px-6 lg:px-10 py-16 max-w-7xl mx-auto scroll-mt-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <Reveal>
          <div>
            <span className="text-xs uppercase tracking-wider text-primary font-semibold">
              AI recovery assistant
            </span>
            <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
              An analyst-aware copilot, not a black box
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              The assistant explains your case, drafts next steps, and points to
              the evidence behind every statement. It never moves funds or acts
              without your explicit authorization.
            </p>
            <ul className="mt-6 space-y-3">
              {CAPS.map((c) => (
                <li key={c} className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="refunds-glass rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border/60">
              <span className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Recovery assistant
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Read-only · grounded in your case
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {THREAD.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      m.role === "user"
                        ? "bg-card/60 border-card-border"
                        : "bg-primary/15 border-primary/30"
                    }`}
                  >
                    {m.role === "user" ? (
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    )}
                  </span>
                  <p
                    className={`text-xs leading-relaxed rounded-2xl px-3.5 py-2.5 max-w-[80%] ${
                      m.role === "user"
                        ? "bg-primary/15 text-foreground rounded-tr-sm"
                        : "bg-card/60 border border-card-border text-muted-foreground rounded-tl-sm"
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground text-center">
              Illustrative conversation — synthetic data.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
