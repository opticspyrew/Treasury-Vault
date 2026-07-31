// Turns the documented "scammed via" label (e.g. "Crypto: Bitcoin (BTC)",
// "Giftcard: Steam", "Payment Firm: CashApp", "Bank Transfer/ACH") into a
// small visual thumbnail so the selected asset / currency / payment method
// shows up consistently on the dashboard overview and the credited page.
//
// Where a real brand mark is available we render the actual logo SVG
// (bundled via simple-icons, plus a couple of hand-embedded paths); the
// colored glyph badge remains as a fallback for anything unmapped.

import {
  siBitcoin,
  siEthereum,
  siTether,
  siXrp,
  siSolana,
  siDogecoin,
  siLitecoin,
  siCardano,
  siPolygon,
  siBinance,
  siCashapp,
  siZelle,
  siVenmo,
  siPaypal,
  siApplepay,
  siGooglepay,
  siWise,
  siRevolut,
  siApple,
  siGoogleplay,
  siSteam,
  siEbay,
  siTarget,
  siVisa,
  siMastercard,
  siNike,
  siRazer,
} from "simple-icons";

interface ScamLogo {
  /** SVG path data */
  path: string;
  /** viewBox of the path (simple-icons uses 24, embedded ones use 32) */
  viewBox: string;
}

const icon = (si: { path: string }): ScamLogo => ({ path: si.path, viewBox: "0 0 24 24" });

// Tron (TRX) and USD Coin (USDC) marks are not in simple-icons, so their
// paths are embedded here (sourced from the cryptocurrency-icons set).
const TRX_LOGO: ScamLogo = {
  viewBox: "0 0 32 32",
  path: "M16 0c8.837 0 16 7.163 16 16s-7.163 16-16 16S0 24.837 0 16 7.163 0 16 0zM7.5 7.257l7.595 19.112 10.583-12.894-3.746-3.562L7.5 7.257zm16.252 6.977l-7.67 9.344.983-8.133 6.687-1.21zM9.472 9.488l6.633 5.502-1.038 8.58L9.472 9.487zM21.7 11.083l2.208 2.099-6.038 1.093 3.83-3.192zM10.194 8.778l10.402 1.914-4.038 3.364-6.364-5.278z",
};

const USDC_LOGO: ScamLogo = {
  viewBox: "0 0 32 32",
  path: "M16 0c8.837 0 16 7.163 16 16s-7.163 16-16 16S0 24.837 0 16 7.163 0 16 0zm3.352 5.56c-.244-.12-.488 0-.548.243-.061.061-.061.122-.061.243v.85l.01.104a.86.86 0 00.355.503c4.754 1.7 7.192 6.98 5.424 11.653-.914 2.55-2.925 4.491-5.424 5.402-.244.121-.365.303-.365.607v.85l.005.088a.45.45 0 00.36.397c.061 0 .183 0 .244-.06a10.895 10.895 0 007.13-13.717c-1.096-3.46-3.778-6.07-7.13-7.162zm-6.46-.06c-.061 0-.183 0-.244.06a10.895 10.895 0 00-7.13 13.717c1.096 3.4 3.717 6.01 7.13 7.102.244.121.488 0 .548-.243.061-.06.061-.122.061-.243v-.85l-.01-.08c-.042-.169-.199-.362-.355-.466-4.754-1.7-7.192-6.98-5.424-11.653.914-2.55 2.925-4.491 5.424-5.402.244-.121.365-.303.365-.607v-.85l-.005-.088a.45.45 0 00-.36-.397zm3.535 3.156h-.915l-.088.008c-.2.04-.346.212-.4.478v1.396l-.207.032c-1.708.304-2.778 1.483-2.778 2.942 0 2.002 1.218 2.791 3.778 3.095 1.707.303 2.255.668 2.255 1.639 0 .97-.853 1.638-2.011 1.638-1.585 0-2.133-.667-2.316-1.578-.06-.242-.244-.364-.427-.364h-1.036l-.079.007a.413.413 0 00-.347.418v.06l.033.18c.29 1.424 1.266 2.443 3.197 2.734v1.457l.008.088c.04.198.213.344.48.397h.914l.088-.008c.2-.04.346-.212.4-.477V21.34l.207-.04c1.713-.362 2.84-1.601 2.84-3.177 0-2.124-1.28-2.852-3.84-3.156-1.829-.243-2.194-.728-2.194-1.578 0-.85.61-1.396 1.828-1.396 1.097 0 1.707.364 2.011 1.275a.458.458 0 00.427.303h.975l.079-.006a.413.413 0 00.348-.419v-.06l-.037-.173a3.04 3.04 0 00-2.706-2.316V9.142l-.008-.088c-.04-.199-.213-.345-.48-.398z",
};

export interface ScamViaInfo {
  /** Category, e.g. "Crypto", "Giftcard", "Payment Firm", "Bank Transfer/ACH" */
  kind: string;
  /** Specific selection, e.g. "Bitcoin (BTC)", "Steam", "CashApp" */
  detail: string;
  /** Short glyph shown inside the thumbnail circle (fallback when no logo) */
  glyph: string;
  /** Tailwind classes for the thumbnail circle background/text */
  tone: string;
  /** Real brand/asset logo, when one is bundled */
  logo: ScamLogo | null;
}

export function parseScammedVia(label: string | null | undefined): ScamViaInfo | null {
  if (!label || !label.trim()) return null;
  const [rawKind, ...rest] = label.split(":");
  const kind = rawKind.trim();
  const detail = rest.join(":").trim();

  const d = (detail || kind).toLowerCase();
  const k = kind.toLowerCase();

  let glyph = "?";
  let tone = "bg-slate-500/20 text-slate-300 border-slate-400/30";
  let logo: ScamLogo | null = null;

  if (d.includes("bitcoin") || d.includes("btc")) {
    glyph = "₿"; tone = "bg-amber-500/20 text-amber-400 border-amber-500/40";
    logo = icon(siBitcoin);
  } else if (d.includes("tether") || d.includes("usdt")) {
    glyph = "₮"; tone = "bg-teal-500/20 text-teal-300 border-teal-500/40";
    logo = icon(siTether);
  } else if (d.includes("ethereum") || d.includes("eth")) {
    glyph = "Ξ"; tone = "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
    logo = icon(siEthereum);
  } else if (d.includes("usd coin") || d.includes("usdc")) {
    glyph = "$"; tone = "bg-sky-500/20 text-sky-300 border-sky-500/40";
    logo = USDC_LOGO;
  } else if (d.includes("tron") || d.includes("trx")) {
    glyph = "T"; tone = "bg-red-500/20 text-red-300 border-red-500/40";
    logo = TRX_LOGO;
  } else if (d.includes("solana") || d.includes("sol")) {
    glyph = "S"; tone = "bg-purple-500/20 text-purple-300 border-purple-500/40";
    logo = icon(siSolana);
  } else if (d.includes("doge")) {
    glyph = "Ð"; tone = "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
    logo = icon(siDogecoin);
  } else if (d.includes("litecoin") || d.includes("ltc")) {
    glyph = "Ł"; tone = "bg-slate-400/20 text-slate-200 border-slate-400/40";
    logo = icon(siLitecoin);
  } else if (d.includes("xrp")) {
    glyph = "X"; tone = "bg-sky-500/20 text-sky-300 border-sky-500/40";
    logo = icon(siXrp);
  } else if (d.includes("bnb") || d.includes("binance")) {
    glyph = "B"; tone = "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
    logo = icon(siBinance);
  } else if (d.includes("cardano") || d.includes("ada")) {
    glyph = "A"; tone = "bg-blue-500/20 text-blue-300 border-blue-500/40";
    logo = icon(siCardano);
  } else if (d.includes("polygon") || d.includes("matic")) {
    glyph = "P"; tone = "bg-violet-500/20 text-violet-300 border-violet-500/40";
    logo = icon(siPolygon);
  } else if (k.startsWith("giftcard")) {
    glyph = "🎁"; tone = "bg-pink-500/20 text-pink-300 border-pink-500/40";
    if (d.includes("apple") || d.includes("itunes")) logo = icon(siApple);
    else if (d.includes("google play")) logo = icon(siGoogleplay);
    else if (d.includes("steam")) logo = icon(siSteam);
    else if (d.includes("ebay")) logo = icon(siEbay);
    else if (d.includes("target")) logo = icon(siTarget);
    else if (d.includes("visa")) logo = icon(siVisa);
    else if (d.includes("mastercard")) logo = icon(siMastercard);
    else if (d.includes("nike")) logo = icon(siNike);
    else if (d.includes("razer")) logo = icon(siRazer);
  } else if (k.includes("bank")) {
    glyph = "🏦"; tone = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  } else if (k.includes("payment")) {
    glyph = detail ? detail.charAt(0).toUpperCase() : "💳";
    tone = "bg-green-500/20 text-green-300 border-green-500/40";
    if (d.includes("cashapp") || d.includes("cash app")) logo = icon(siCashapp);
    else if (d.includes("zelle")) logo = icon(siZelle);
    else if (d.includes("venmo")) logo = icon(siVenmo);
    else if (d.includes("paypal")) logo = icon(siPaypal);
    else if (d.includes("apple pay")) logo = icon(siApplepay);
    else if (d.includes("google pay")) logo = icon(siGooglepay);
    else if (d.includes("wise")) logo = icon(siWise);
    else if (d.includes("revolut")) logo = icon(siRevolut);
  } else if (k.startsWith("crypto")) {
    glyph = "◆"; tone = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
  }

  return { kind, detail: detail || kind, glyph, tone, logo };
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
  const logoDims = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-7 h-7" : "w-5 h-5";
  return (
    <span
      title={`${info.kind}${info.detail && info.detail !== info.kind ? `: ${info.detail}` : ""}`}
      data-testid="scam-thumb"
      className={`inline-flex items-center justify-center rounded-full border font-bold flex-shrink-0 ${dims} ${info.tone} ${className}`}
    >
      {info.logo ? (
        <svg
          viewBox={info.logo.viewBox}
          className={logoDims}
          fill="currentColor"
          aria-hidden="true"
          role="img"
          data-testid="scam-thumb-logo"
        >
          <path d={info.logo.path} />
        </svg>
      ) : (
        info.glyph
      )}
    </span>
  );
}
