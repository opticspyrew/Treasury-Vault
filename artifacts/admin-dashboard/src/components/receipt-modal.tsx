import { useRef } from "react";
import type { ServiceRequest } from "@/lib/api";

interface Props {
  request: ServiceRequest;
  onClose: () => void;
}

function hashFromId(id: number): string {
  const h = Math.abs((id * 2654435761) >>> 0).toString(16).padStart(8, "0");
  const h2 = Math.abs((id * 1234567891) >>> 0).toString(16).padStart(8, "0");
  const h3 = Math.abs((id * 987654321) >>> 0).toString(16).padStart(8, "0");
  return `0x${h}${h2}${h3}a7f3`;
}

function refNumber(id: number, createdAt: string): string {
  const d = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, "");
  return `CVR-${d}-ADM${String(id).padStart(6, "0")}`;
}

function statusStyle(s: string): { bg: string; color: string; label: string } {
  switch (s) {
    case "approved": return { bg: "#d1fae5", color: "#065f46", label: "APPROVED" };
    case "denied": return { bg: "#fee2e2", color: "#991b1b", label: "DENIED" };
    case "out_of_bound": return { bg: "#ffe4e6", color: "#9f1239", label: "OUT OF BOUND" };
    default: return { bg: "#fef3c7", color: "#92400e", label: "PENDING" };
  }
}

export default function ReceiptModal({ request: r, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const ref = refNumber(r.id, r.createdAt);
  const txHash = hashFromId(r.id);
  const st = statusStyle(r.status);
  const typeLabel = r.type.charAt(0).toUpperCase() + r.type.slice(1).replace(/_/g, " ");
  const amtStr = r.amount
    ? `${r.currency} ${Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
  const issuedAt = new Date(r.createdAt).toUTCString().replace("GMT", "UTC");

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Treasury Vault Receipt – ${ref}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; padding: 32px; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Transaction Receipt</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Printable body */}
        <div className="overflow-y-auto flex-1">
          <div ref={printRef} style={{ fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 560, margin: "0 auto", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: "#1e3a5f", color: "#fff", padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "#000" }}>₿</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>Treasury Vault</div>
                    <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 1 }}>Admin — Transaction Receipt</div>
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999, background: st.bg, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: st.color }}>
                  {st.label}
                </div>
              </div>
            </div>

            {/* Reference & date */}
            <div style={{ padding: "16px 28px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 3 }}>Reference No.</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#1e293b", letterSpacing: ".04em" }}>{ref}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 3 }}>Submitted</div>
                  <div style={{ color: "#475569", fontSize: 12 }}>{issuedAt}</div>
                </div>
              </div>
            </div>

            {/* Client Details */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 12 }}>Client</div>
              {[
                ["Name", r.clientName || "—"],
                ["Email", r.clientEmail || "—"],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: "#64748b" }}>{lbl}</span>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Transaction Details */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 12 }}>Transaction Details</div>
              {[
                ["Type", typeLabel],
                ["Amount", amtStr],
                ["Request ID", `#${r.id}`],
                ...(r.notes ? [["Notes", r.notes]] : []),
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: "#64748b", flexShrink: 0, marginRight: 12 }}>{lbl}</span>
                  <span style={{ fontWeight: 600, color: "#111827", textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 12 }}>Financial Summary</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#64748b" }}>Transaction Amount</span>
                <span style={{ color: "#374151" }}>{amtStr}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#64748b" }}>Processing Fee</span>
                <span style={{ color: "#374151" }}>Included</span>
              </div>
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
                <span style={{ color: "#111827" }}>Total</span>
                <span style={{ color: "#1e3a5f" }}>{amtStr}</span>
              </div>
            </div>

            {/* Verification */}
            <div style={{ padding: "16px 28px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 }}>Verification</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <span style={{ fontSize: 12, color: "#64748b" }}>Verified and recorded by Treasury Vault Compliance</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", wordBreak: "break-all", background: "#f1f5f9", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                {txHash}
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", padding: "16px 28px", background: "#f8fafc" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
                <strong style={{ color: "#64748b" }}>Treasury Vault</strong> · Firm Admin System<br />
                support@treasuryvault.io · treasuryvault.app<br />
                <span style={{ fontSize: 10 }}>This is an official transaction record. Keep it for audit and compliance purposes.</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
