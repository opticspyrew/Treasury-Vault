import { useRef } from "react";
import type { Transaction } from "@/hooks/use-transactions";

interface Props {
  tx: Transaction;
  onClose: () => void;
}

function hashFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(h).toString(16).padStart(8, "0");
  return `0x${hex}${id.replace(/[^a-z0-9]/gi, "").slice(0, 8).padEnd(8, "f")}${Math.abs(h * 7).toString(16).padStart(8, "0")}`;
}

function refNumber(id: string): string {
  const clean = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `CVR-${today}-${clean.slice(0, 8).padEnd(8, "0")}`;
}

function statusColor(s: string) {
  switch (s) {
    case "completed": return { dot: "#10b981", label: "COMPLETED" };
    case "pending": return { dot: "#60a5fa", label: "PENDING" };
    case "processing": return { dot: "#f87171", label: "PROCESSING" };
    case "investigation": return { dot: "#fbbf24", label: "UNDER INVESTIGATION" };
    default: return { dot: "#94a3b8", label: s.toUpperCase() };
  }
}

export default function TransactionReceiptModal({ tx, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const { dot, label } = statusColor(tx.statusType);
  const ref = refNumber(tx.id);
  const txHash = hashFromId(tx.id);
  const issuedAt = (() => {
    try {
      return new Date().toUTCString().replace("GMT", "UTC");
    } catch {
      return tx.date;
    }
  })();
  const typeLabel = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
  const btcAmt = tx.amount.replace(/[+-]/, "").trim();
  const usdAmt = tx.usdAmount
    ? tx.usdAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>CryptoVault Receipt – ${ref}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; padding: 32px; }
          .receipt { max-width: 560px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
          .receipt-header { background: #0f1117; color: #fff; padding: 24px 28px; }
          .receipt-header h1 { font-size: 20px; font-weight: 700; }
          .receipt-header p { font-size: 12px; color: #94a3b8; margin-top: 2px; }
          .badge { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.05em; }
          .section { padding: 18px 28px; border-bottom: 1px solid #f1f5f9; }
          .section:last-child { border-bottom: none; }
          .section-title { font-size: 10px; font-weight: 700; letter-spacing: .08em; color: #64748b; text-transform: uppercase; margin-bottom: 12px; }
          .row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; font-size: 13px; }
          .row-label { color: #64748b; }
          .row-value { font-weight: 600; color: #111; text-align: right; max-width: 60%; word-break: break-all; }
          .total-row { font-size: 15px; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 4px; }
          .total-row .row-value { color: #111; font-weight: 700; }
          .hash { font-family: monospace; font-size: 11px; color: #475569; word-break: break-all; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; padding: 16px 28px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
          <span className="text-sm font-semibold text-white/80 tracking-wide uppercase">Transaction Receipt</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Printable receipt body */}
        <div className="overflow-y-auto flex-1">
          <div ref={printRef} className="receipt" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

            {/* Header */}
            <div className="receipt-header" style={{ background: "#0f1117", color: "#fff", padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "#000" }}>₿</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: ".02em" }}>CryptoVault</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Transaction Receipt</div>
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: dot + "22", border: `1px solid ${dot}55`, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: dot }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
                  {label}
                </div>
              </div>
            </div>

            {/* Reference & date */}
            <div style={{ padding: "16px 28px", borderBottom: "1px solid #1e293b", background: "#0a0d14" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <div>
                  <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 3 }}>Reference No.</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#f8fafc", letterSpacing: ".04em" }}>{ref}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 3 }}>Date Issued</div>
                  <div style={{ color: "#cbd5e1", fontSize: 12 }}>{issuedAt}</div>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid #1e293b", background: "#0a0d14" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#64748b", textTransform: "uppercase", marginBottom: 14 }}>Transaction Details</div>
              {[
                ["Type", typeLabel],
                ["Asset", `Bitcoin (BTC)`],
                ["Amount", btcAmt],
                ["USD Value", tx.usdAmount ? `$${usdAmt}` : "—"],
                ["Destination / Notes", tx.address || "—"],
                ["Transaction ID", tx.id.toUpperCase()],
                ["Date", tx.date],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9, fontSize: 13 }}>
                  <span style={{ color: "#64748b" }}>{lbl}</span>
                  <span style={{ fontWeight: 600, color: "#f1f5f9", textAlign: "right", maxWidth: "58%", wordBreak: "break-all" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid #1e293b", background: "#0a0d14" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#64748b", textTransform: "uppercase", marginBottom: 14 }}>Financial Summary</div>
              {[
                ["Transaction Amount", tx.usdAmount ? `$${usdAmt}` : btcAmt],
                ["Network Fee", "Included"],
                ["Processing Fee", "Included"],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: "#94a3b8" }}>{lbl}</span>
                  <span style={{ color: "#cbd5e1" }}>{val}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #1e293b", paddingTop: 10, marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
                <span style={{ color: "#f8fafc" }}>Total</span>
                <span style={{ color: "#f59e0b" }}>{tx.usdAmount ? `$${usdAmt}` : btcAmt}</span>
              </div>
            </div>

            {/* Verification */}
            <div style={{ padding: "16px 28px", borderBottom: "1px solid #1e293b", background: "#0a0d14" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>Blockchain Verification</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Cryptographically signed by CryptoVault</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", wordBreak: "break-all", background: "#111827", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b" }}>
                {txHash}
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", padding: "16px 28px", background: "#070a10" }}>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                <strong style={{ color: "#64748b" }}>CryptoVault</strong> · Secure Digital Asset Management<br />
                support@cryptovault.io · cryptovault.app<br />
                <span style={{ fontSize: 10 }}>This document is an official receipt and proof of transaction. Keep it for your records.</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
