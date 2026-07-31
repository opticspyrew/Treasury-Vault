import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, ShieldCheck, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { AiMessage } from "../../data/types";

type AiMode = "recovery" | "forensics";

const CHAT_ENDPOINT = "/api/public/refunds/ai/chat";

// Keep the request payload comfortably under the server-side caps (24 messages
// / 16k chars) by only replaying the most recent turns.
const MAX_HISTORY = 20;

const MODE_LABELS: Record<AiMode, { label: string; hint: string }> = {
  recovery: {
    label: "Recovery",
    hint: "Process, evidence, and what to expect — never a guaranteed outcome.",
  },
  forensics: {
    label: "Forensics",
    hint: "On-chain tracing concepts, laundering patterns, and risk signals.",
  },
};

const WELCOME: AiMessage = {
  id: "welcome",
  role: "assistant",
  body: "I'm the Netspy-World Forensics assistant. Ask me about the recovery process and what evidence to preserve, or switch to Forensics for help understanding on-chain tracing. I can't take actions, give legal advice, or guarantee any recovery — a licensed analyst authorizes every step.",
  at: new Date().toISOString(),
};

export default function AiAssistant() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<AiMessage[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<AiMode>("recovery");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  function appendToMessage(id: string, chunk: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, body: m.body + chunk } : m)),
    );
  }

  function setMessageBody(id: string, body: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body } : m)));
  }

  async function streamReply(history: AiMessage[], assistantId: string) {
    const payload = {
      mode,
      messages: history
        .filter((m) => m.body.trim().length > 0)
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.body })),
    };

    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      setMessageBody(
        assistantId,
        err.error || "The assistant is unavailable right now. Please try again shortly.",
      );
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let received = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const dataLine = event
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json) continue;
        let parsed: { content?: string; error?: string; done?: boolean };
        try {
          parsed = JSON.parse(json);
        } catch {
          continue;
        }
        if (parsed.content) {
          received = true;
          appendToMessage(assistantId, parsed.content);
        } else if (parsed.error) {
          setMessageBody(assistantId, parsed.error);
          return;
        }
      }
    }

    if (!received) {
      setMessageBody(
        assistantId,
        "The assistant didn't return a response. Please try again.",
      );
    }
  }

  const handleSend = async () => {
    const value = draft.trim();
    if (!value || streaming) return;

    if (!token) {
      setMessages((m) => [
        ...m,
        {
          id: `local-${Date.now()}`,
          role: "user",
          body: value,
          at: new Date().toISOString(),
        },
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          body: "Your session has expired. Please sign in again to use the assistant.",
          at: new Date().toISOString(),
        },
      ]);
      setDraft("");
      return;
    }

    const userMessage: AiMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      body: value,
      at: new Date().toISOString(),
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantPlaceholder: AiMessage = {
      id: assistantId,
      role: "assistant",
      body: "",
      at: new Date().toISOString(),
    };

    const history = [...messages, userMessage];
    setMessages([...history, assistantPlaceholder]);
    setDraft("");
    setStreaming(true);

    try {
      await streamReply(history, assistantId);
    } catch {
      setMessageBody(
        assistantId,
        "The assistant ran into a problem. Please try again.",
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="refunds-glass rounded-2xl flex flex-col h-[calc(100vh-12rem)] min-h-[500px] overflow-hidden">
      <header className="flex flex-col gap-3 p-5 border-b border-card-border sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Netspy-World Forensics AI</h2>
            <p className="text-[11px] text-muted-foreground max-w-md">{MODE_LABELS[mode].hint}</p>
          </div>
        </div>
        <div
          role="group"
          aria-label="Assistant mode"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted border border-input self-start"
        >
          {(Object.keys(MODE_LABELS) as AiMode[]).map((m) => {
            const active = mode === m;
            const Icon = m === "recovery" ? ShieldCheck : Search;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {MODE_LABELS[m].label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((m) => {
          const isAssistant = m.role === "assistant";
          const isPending = isAssistant && streaming && m.body.length === 0;
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isAssistant ? "" : "flex-row-reverse"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                  isAssistant
                    ? "bg-primary/15 border border-primary/30 text-primary"
                    : "bg-card border border-card-border text-foreground"
                }`}
              >
                {isAssistant ? "AI" : "You"}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isAssistant
                    ? "bg-card/70 border border-card-border text-foreground"
                    : "bg-primary/10 border border-primary/25 text-foreground"
                }`}
              >
                {isPending ? (
                  <span
                    className="inline-flex gap-1"
                    aria-label="Assistant is composing a response"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:300ms]" />
                  </span>
                ) : (
                  <p className="whitespace-pre-wrap">{m.body}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 border-t border-card-border flex items-center gap-2"
      >
        <label htmlFor="ai-input" className="sr-only">Ask the assistant</label>
        <input
          id="ai-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            mode === "recovery"
              ? "Ask about the recovery process, evidence to preserve, or next steps…"
              : "Ask about tracing funds, laundering patterns, or on-chain risk signals…"
          }
          className="flex-1 px-3 py-2 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!draft.trim() || streaming}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Send className="w-4 h-4" /> Send
        </button>
      </form>
    </div>
  );
}
