// Turns the documented "scammed via" label (e.g. "Crypto: Bitcoin (BTC)",
// "Giftcard: Steam", "Payment Firm: CashApp", "Bank Transfer/ACH") into a
// small visual thumbnail so the selected asset / currency / payment method
// shows up consistently on the dashboard overview and the credited page.

export interface ScamViaInfo {
  /** Category, e.g. "Crypto", "Giftcard", "Payment Firm", "Bank Transfer/ACH" */
  kind: string;
  /** Specific selection, e.g. "Bitcoin (BTC)", "Steam", "CashApp" */
  detail: string;
  /** Short glyph shown inside the thumbnail circle */
  glyph: string;
  /** Tailwind classes for the thumbnail circle background/text */
  tone: string;
}

export function parseScammedVia(label: string | null | undefined): ScamViaInfo | null {
  if (!label || !label.trim()) return null;
  const [rawKind, ...rest] = label.split(":");
  const kind = rawKind.trim();
  const detail = rest.join(":").trim();

  const d = (detail || kind).toLowerCase();

  let glyph = "?";
  let tone = "bg-slate-500/20 text-slate-300 border-slate-400/30";

  if (d.includes("bitcoin") || d.includes("btc")) {
    glyph = "₿"; tone = "bg-amber-500/20 text-amber-400 border-amber-500/40";
  } else if (d.includes("tether") || d.includes("usdt")) {
    glyph = "₮"; tone = "bg-teal-500/20 text-teal-300 border-teal-500/40";
  } else if (d.includes("ethereum") || d.includes("eth")) {
    glyph = "Ξ"; tone = "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
  } else if (d.includes("usd coin") || d.includes("usdc")) {
    glyph = "$"; tone = "bg-sky-500/20 text-sky-300 border-sky-500/40";
  } else if (d.includes("tron") || d.includes("trx")) {
    glyph = "T"; tone = "bg-red-500/20 text-red-300 border-red-500/40";
  } else if (d.includes("solana") || d.includes("sol")) {
    glyph = "S"; tone = "bg-purple-500/20 text-purple-300 border-purple-500/40";
  } else if (d.includes("doge")) {
    glyph = "Ð"; tone = "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  } else if (d.includes("litecoin") || d.includes("ltc")) {
    glyph = "Ł"; tone = "bg-slate-400/20 text-slate-200 border-slate-400/40";
  } else if (d.includes("xrp")) {
    glyph = "X"; tone = "bg-sky-500/20 text-sky-300 border-sky-500/40";
  } else if (d.includes("bnb") || d.includes("binance")) {
    glyph = "B"; tone = "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  } else if (d.includes("cardano") || d.includes("ada")) {
    glyph = "A"; tone = "bg-blue-500/20 text-blue-300 border-blue-500/40";
  } else if (d.includes("polygon") || d.includes("matic")) {
    glyph = "P"; tone = "bg-violet-500/20 text-violet-300 border-violet-500/40";
  } else if (kind.toLowerCase().startsWith("giftcard")) {
    glyph = "🎁"; tone = "bg-pink-500/20 text-pink-300 border-pink-500/40";
  } else if (kind.toLowerCase().includes("bank")) {
    glyph = "🏦"; tone = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  } else if (kind.toLowerCase().includes("payment")) {
    glyph = detail ? detail.charAt(0).toUpperCase() : "💳";
    tone = "bg-green-500/20 text-green-300 border-green-500/40";
  } else if (kind.toLowerCase().startsWith("crypto")) {
    glyph = "◆"; tone = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
  }

  return { kind, detail: detail || kind, glyph, tone };
}

/** Small circular thumbnail for the documented scam asset / payment method. */
export function ScamThumb({
  label,
  size = "md",
  className = "",
}: {
  label: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const info = parseScammedVia(label);
  if (!info) return null;
  const dims = size === "sm" ? "w-6 h-6 text-[11px]" : size === "lg" ? "w-12 h-12 text-xl" : "w-9 h-9 text-base";
  return (
    <span
      title={`${info.kind}${info.detail && info.detail !== info.kind ? `: ${info.detail}` : ""}`}
      data-testid="scam-thumb"
      className={`inline-flex items-center justify-center rounded-full border font-bold flex-shrink-0 ${dims} ${info.tone} ${className}`}
    >
      {info.glyph}
    </span>
  );
}
