import { useEffect, useMemo, useState } from "react";
import { Lock, MessageSquareLock, Send, ShieldCheck } from "lucide-react";
import { getMessages, getThreads } from "../../data/mocks";
import type { MessageThread, SecureMessage } from "../../data/types";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default function SecureMessaging() {
  const threads = useMemo<MessageThread[]>(() => getThreads(), []);
  const [selectedId, setSelectedId] = useState(threads[0]?.id ?? "");
  const [messages, setMessages] = useState<SecureMessage[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (selectedId) setMessages(getMessages(selectedId));
  }, [selectedId]);

  const selected = threads.find((t) => t.id === selectedId);

  const handleSend = () => {
    const value = draft.trim();
    if (!value || !selectedId) return;
    setMessages((m) => [
      ...m,
      {
        id: `local-${Date.now()}`,
        threadId: selectedId,
        author: "client",
        authorName: "You",
        body: value,
        sentAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
  };

  return (
    <div className="refunds-glass rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] h-[calc(100vh-12rem)] min-h-[500px]">
      <aside className="border-b md:border-b-0 md:border-r border-card-border bg-card/40">
        <div className="p-4 border-b border-card-border">
          <div className="flex items-center gap-2">
            <MessageSquareLock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Secure threads</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            End-to-end encrypted with your case analyst.
          </p>
        </div>
        <ul className="overflow-y-auto max-h-[300px] md:max-h-none">
          {threads.map((t) => {
            const active = t.id === selectedId;
            return (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  data-testid={`refunds-thread-${t.id}`}
                  aria-current={active ? "true" : undefined}
                  className={`w-full text-left px-4 py-3 border-b border-card-border/60 transition-colors ${
                    active ? "bg-primary/10" : "hover:bg-card/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-primary/90">{t.caseRef}</span>
                    {t.unread > 0 && (
                      <span className="text-[10px] font-semibold text-primary-foreground bg-primary rounded-full px-1.5 py-0.5">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">{t.subject}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{fmtTime(t.lastActivity)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex flex-col min-h-0">
        {selected ? (
          <>
            <header className="px-5 py-4 border-b border-card-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-primary/90">{selected.caseRef}</p>
                <h3 className="text-sm font-semibold text-foreground truncate">{selected.subject}</h3>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-primary/10 border border-primary/25 text-primary">
                <Lock className="w-3 h-3" /> {selected.encryption}
              </span>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map((m) => {
                if (m.author === "system") {
                  return (
                    <div key={m.id} className="text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-card/60 border border-card-border text-muted-foreground">
                        <ShieldCheck className="w-3 h-3" /> {m.body}
                      </span>
                    </div>
                  );
                }
                const isClient = m.author === "client";
                return (
                  <div key={m.id} className={`flex ${isClient ? "justify-end" : ""}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isClient
                          ? "bg-primary/15 border border-primary/25 text-foreground"
                          : "bg-card/70 border border-card-border text-foreground"
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                        {m.authorName} • {fmtTime(m.sentAt)}
                      </p>
                      <p>{m.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-4 border-t border-card-border flex items-center gap-2"
            >
              <label htmlFor="thread-reply" className="sr-only">Reply</label>
              <input
                id="thread-reply"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a secure reply…"
                className="flex-1 px-3 py-2 bg-muted border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <Send className="w-4 h-4" /> Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a thread to view messages.
          </div>
        )}
      </section>
    </div>
  );
}
