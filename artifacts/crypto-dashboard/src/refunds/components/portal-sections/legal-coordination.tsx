import { useMemo, useState } from "react";
import { Check, Copy, Download, FolderOpen, Inbox, Printer, RefreshCw, Scale } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCaseReport, useMyCases } from "../../data/api";
import { LEGAL_DOC_TYPES, buildLegalDoc, type LegalDocType } from "../../data/legal-templates";

function downloadText(filename: string, text: string): void {
  if (typeof window === "undefined" || typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function printDocument(): void {
  if (typeof window === "undefined") return;
  document.body.classList.add("refunds-printing");
  const cleanup = () => {
    document.body.classList.remove("refunds-printing");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export default function LegalCoordination() {
  const { token } = useAuth();
  const { cases, loading: casesLoading, error: casesError, reload } = useMyCases(token);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [docType, setDocType] = useState<LegalDocType>("exchange_freeze");
  const [copied, setCopied] = useState(false);
  const { report, loading: reportLoading, error: reportError } = useCaseReport(token, selectedRef);

  const doc = useMemo(
    () => (report ? buildLegalDoc(docType, report) : null),
    [report, docType],
  );

  async function handleCopy(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        /* clipboard unavailable — no-op */
      }
    }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="refunds-glass rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Legal coordination</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Generate ready-to-send legal correspondence from a case — freeze requests, law-enforcement
          referrals, VASP information requests, and preservation notices. Each document is populated
          from the live, ownership-verified case record. These are drafting aids; have counsel review
          before sending.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="refunds-glass rounded-2xl p-4 self-start">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Select a case</h3>
            </div>
            <button
              type="button"
              onClick={reload}
              disabled={casesLoading}
              data-testid="legal-refresh"
              aria-label="Refresh cases"
              className="p-1.5 rounded-md border border-card-border text-muted-foreground hover:text-foreground hover:bg-card/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${casesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {casesLoading && (
            <div className="mt-3 space-y-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {!casesLoading && casesError && (
            <p className="mt-3 text-xs text-destructive" role="alert">
              {casesError}
            </p>
          )}

          {!casesLoading && !casesError && cases.length === 0 && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/15 border border-primary/30 mb-2">
                <Inbox className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                No cases yet. File a case in{" "}
                <strong className="text-foreground">Case Intake</strong> to draft legal documents.
              </p>
            </div>
          )}

          {!casesLoading && !casesError && cases.length > 0 && (
            <ul className="mt-3 space-y-1.5" data-testid="legal-case-list">
              {cases.map((c) => {
                const isActive = c.reference === selectedRef;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRef(c.reference)}
                      data-testid={`legal-case-${c.reference}`}
                      aria-current={isActive ? "true" : undefined}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        isActive
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "border-card-border text-foreground hover:bg-card/60"
                      }`}
                    >
                      <span className="font-mono text-xs block">{c.reference}</span>
                      <span className="text-xs text-muted-foreground truncate block">
                        {c.incident ?? "Recovery case"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          {!selectedRef && (
            <div className="refunds-glass rounded-2xl p-10 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 border border-primary/30 mb-4">
                <Scale className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No case selected</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Choose a case to draft freeze requests, referrals, and preservation notices.
              </p>
            </div>
          )}

          {selectedRef && reportLoading && (
            <div
              className="refunds-glass rounded-2xl p-6 animate-pulse space-y-3"
              aria-hidden="true"
            >
              <div className="h-5 w-48 bg-muted rounded" />
              <div className="h-3 w-2/3 bg-muted rounded" />
              <div className="h-40 w-full bg-muted rounded" />
            </div>
          )}

          {selectedRef && !reportLoading && reportError && (
            <div className="refunds-glass rounded-2xl p-6 text-center" role="alert">
              <p className="text-sm text-destructive">{reportError}</p>
            </div>
          )}

          {selectedRef && !reportLoading && !reportError && doc && (
            <div className="space-y-4">
              <div
                className="refunds-glass rounded-2xl p-3 flex flex-wrap gap-2"
                data-testid="legal-doctype-picker"
              >
                {LEGAL_DOC_TYPES.map((d) => {
                  const isActive = d.type === docType;
                  return (
                    <button
                      key={d.type}
                      type="button"
                      onClick={() => setDocType(d.type)}
                      data-testid={`legal-doctype-${d.type}`}
                      aria-current={isActive ? "true" : undefined}
                      title={d.description}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        isActive
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "border-card-border text-muted-foreground hover:text-foreground hover:bg-card/60"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(doc.body)}
                  data-testid="legal-copy"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-card-border text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadText(`${report?.reference}-${doc.type}.txt`, doc.body)}
                  data-testid="legal-download"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-card-border text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download .txt
                </button>
                <button
                  type="button"
                  onClick={printDocument}
                  data-testid="legal-print"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
                </button>
              </div>

              <article
                className="refunds-glass refunds-print-report rounded-2xl p-6 sm:p-8"
                data-testid="legal-document"
              >
                <header className="border-b border-card-border pb-4 mb-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
                    {doc.label}
                  </p>
                  <h2 className="text-lg font-bold text-foreground mt-1" data-testid="legal-document-title">
                    {doc.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recipient: {doc.recipient} · Case {report?.reference}
                  </p>
                </header>
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                  {doc.body}
                </pre>
              </article>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
