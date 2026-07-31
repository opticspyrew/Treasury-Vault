import { useState } from "react";
import { Download, FileText, FolderOpen, Inbox, Printer, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCaseReport, useMyCases } from "../../data/api";
import type { CaseReport } from "../../data/types";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  return (
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

function fmtAmount(amount: string | null, currency: string): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "USD" ? `$${formatted}` : `${formatted} ${currency}`;
}

function humanize(value: string): string {
  if (!value) return "—";
  return value
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function downloadReportJson(report: CaseReport): void {
  if (typeof window === "undefined" || typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.reference}-forensic-report.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function printReport(): void {
  if (typeof window === "undefined") return;
  document.body.classList.add("refunds-printing");
  const cleanup = () => {
    document.body.classList.remove("refunds-printing");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </dt>
      <dd className={`text-sm text-foreground mt-0.5 break-words ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

export default function ReportGeneration() {
  const { token } = useAuth();
  const { cases, loading: casesLoading, error: casesError, reload } = useMyCases(token);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const { report, loading: reportLoading, error: reportError } = useCaseReport(token, selectedRef);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="refunds-glass rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Report generation</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Compile a forensic report for any of your cases. Reports draw on the live case record and
          its investigation activity, and can be saved as a PDF or exported as structured JSON for
          your legal team.
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
              data-testid="reports-refresh"
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
                <strong className="text-foreground">Case Intake</strong> to generate a report.
              </p>
            </div>
          )}

          {!casesLoading && !casesError && cases.length > 0 && (
            <ul className="mt-3 space-y-1.5" data-testid="reports-case-list">
              {cases.map((c) => {
                const isActive = c.reference === selectedRef;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRef(c.reference)}
                      data-testid={`reports-case-${c.reference}`}
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
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No case selected</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Choose a case from the list to compile and preview its forensic report.
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
              <div className="h-3 w-1/2 bg-muted rounded" />
              <div className="h-24 w-full bg-muted rounded" />
            </div>
          )}

          {selectedRef && !reportLoading && reportError && (
            <div className="refunds-glass rounded-2xl p-6 text-center" role="alert">
              <p className="text-sm text-destructive">{reportError}</p>
            </div>
          )}

          {selectedRef && !reportLoading && !reportError && report && (
            <div className="space-y-4">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => downloadReportJson(report)}
                  data-testid="reports-download-json"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-card-border text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
                <button
                  type="button"
                  onClick={printReport}
                  data-testid="reports-print"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
                </button>
              </div>

              <article
                className="refunds-glass refunds-print-report rounded-2xl p-6 sm:p-8 space-y-6"
                data-testid="reports-document"
              >
                <header className="flex items-start justify-between gap-4 border-b border-card-border pb-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
                      {report.firm.brand}
                    </p>
                    <h2 className="text-xl font-bold text-foreground mt-1">
                      Digital Asset Forensic Report
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">{report.firm.legalName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm text-primary">{report.reference}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Generated {fmtDateTime(report.generatedAt)}
                    </p>
                  </div>
                </header>

                <section>
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
                    Case summary
                  </h3>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                    <Field label="Incident type" value={report.case.incident ?? "—"} />
                    <Field label="Status" value={humanize(report.case.status)} />
                    <Field label="Submitted" value={fmtDate(report.case.submittedAt)} />
                    <Field label="Asset" value={report.case.asset ?? "—"} />
                    <Field label="Chain" value={report.case.chain ?? "—"} />
                    <Field
                      label="Reported loss"
                      value={fmtAmount(report.case.amount, report.case.currency)}
                      mono
                    />
                  </dl>
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
                    Subject of record
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label="Client" value={report.client.name} />
                    <Field label="Contact" value={report.client.email} mono />
                  </dl>
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
                    On-chain references
                  </h3>
                  {report.case.txHashes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No transaction hashes were supplied with this case.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {report.case.txHashes.map((hash, i) => (
                        <li
                          key={`${hash}-${i}`}
                          className="font-mono text-xs text-foreground break-all bg-card/40 border border-card-border rounded-md px-3 py-2"
                        >
                          {hash}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
                    Investigation activity
                  </h3>
                  {report.activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recorded activity for this case yet.
                    </p>
                  ) : (
                    <ol className="space-y-3">
                      {report.activity.map((entry, i) => (
                        <li key={i} className="flex gap-3">
                          <div className="flex flex-col items-center pt-1">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {i < report.activity.length - 1 && (
                              <span className="w-px flex-1 bg-card-border mt-1" />
                            )}
                          </div>
                          <div className="pb-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {humanize(entry.eventType)}
                            </p>
                            <p className="text-xs text-muted-foreground break-words">
                              {entry.description}
                            </p>
                            <p className="text-[11px] text-muted-foreground/80 font-mono mt-0.5">
                              {fmtDateTime(entry.at)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                <footer className="border-t border-card-border pt-4">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Confidential.</strong>{" "}
                    {report.firm.jurisdictionNote} This document was generated by {report.firm.brand}{" "}
                    ({report.firm.legalName}) for the named subject of record and is intended solely
                    for their authorized use.
                  </p>
                </footer>
              </article>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
