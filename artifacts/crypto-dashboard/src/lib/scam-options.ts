// Shared option lists for the "scammed via" intake — used by the signup form
// and the post-social-signup intake modal so they always stay in sync.

export const PAYMENT_FIRMS = ["CashApp", "Zelle", "GCash", "Venmo", "PayPal", "Apple Pay", "Google Pay", "Wise", "Revolut", "Other"];
export const CRYPTOS = ["Bitcoin (BTC)", "Ethereum (ETH)", "Tether (USDT)", "USD Coin (USDC)", "Binance Coin (BNB)", "XRP", "Solana (SOL)", "Dogecoin (DOGE)", "Litecoin (LTC)", "Tron (TRX)", "Cardano (ADA)", "Polygon (MATIC)", "Other"];
export const GIFTCARDS = ["Amazon", "Apple / iTunes", "Google Play", "Steam", "eBay", "Walmart", "Target", "Visa Gift Card", "Mastercard Gift Card", "Sephora", "Best Buy", "Nordstrom", "Razer Gold", "Nike", "Other"];
export const SCAM_OPTIONS = ["Crypto", "Giftcard", "Bank Transfer/ACH", "Payment Firm"] as const;

export type ScamOption = (typeof SCAM_OPTIONS)[number];

export const MAX_ASSETS_TOTAL_USD = 1_000_000;

/** Builds the stored "scammed via" label, e.g. "Payment Firm: CashApp". */
export function buildScammedViaLabel(
  option: ScamOption,
  detail: string,
): string {
  if (option === "Payment Firm") return `Payment Firm: ${detail}`;
  if (option === "Crypto") return `Crypto: ${detail}`;
  if (option === "Giftcard") return `Giftcard: ${detail}`;
  return option;
}
