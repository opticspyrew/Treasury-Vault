// Verifies parseScammedVia maps documented "scammed via" labels to real
// bundled logo SVGs where available, and that ScamThumb renders the logo
// image with the glyph badge as fallback.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(cleanup);

import { parseScammedVia, ScamThumb } from "../scam-thumbnail";

const LOGO_LABELS = [
  "Crypto: Bitcoin (BTC)",
  "Crypto: Ethereum (ETH)",
  "Crypto: Tether (USDT)",
  "Crypto: USD Coin (USDC)",
  "Crypto: Binance Coin (BNB)",
  "Crypto: XRP",
  "Crypto: Solana (SOL)",
  "Crypto: Dogecoin (DOGE)",
  "Crypto: Litecoin (LTC)",
  "Crypto: Tron (TRX)",
  "Crypto: Cardano (ADA)",
  "Crypto: Polygon (MATIC)",
  "Giftcard: Apple / iTunes",
  "Giftcard: Google Play",
  "Giftcard: Steam",
  "Giftcard: eBay",
  "Giftcard: Target",
  "Giftcard: Visa Gift Card",
  "Giftcard: Mastercard Gift Card",
  "Giftcard: Nike",
  "Giftcard: Razer Gold",
  "Payment Firm: CashApp",
  "Payment Firm: Zelle",
  "Payment Firm: Venmo",
  "Payment Firm: PayPal",
  "Payment Firm: Apple Pay",
  "Payment Firm: Google Pay",
  "Payment Firm: Wise",
  "Payment Firm: Revolut",
];

const GLYPH_ONLY_LABELS = [
  "Bank Transfer/ACH",
  "Crypto: Other",
  "Giftcard: Amazon",
  "Giftcard: Walmart",
  "Payment Firm: GCash",
  "Payment Firm: Other",
];

describe("parseScammedVia logos", () => {
  it.each(LOGO_LABELS)("maps %s to a bundled logo", (label) => {
    const info = parseScammedVia(label);
    expect(info).not.toBeNull();
    expect(info!.logo).not.toBeNull();
    expect(info!.logo!.path.length).toBeGreaterThan(10);
    expect(info!.logo!.viewBox).toMatch(/^0 0 \d+ \d+$/);
  });

  it.each(GLYPH_ONLY_LABELS)("keeps a glyph fallback for %s", (label) => {
    const info = parseScammedVia(label);
    expect(info).not.toBeNull();
    expect(info!.logo).toBeNull();
    expect(info!.glyph).toBeTruthy();
  });

  it("returns null for empty labels", () => {
    expect(parseScammedVia(null)).toBeNull();
    expect(parseScammedVia("  ")).toBeNull();
  });
});

describe("ScamThumb", () => {
  it("renders a logo SVG when one is bundled", () => {
    render(<ScamThumb label="Crypto: Bitcoin (BTC)" />);
    const thumb = screen.getByTestId("scam-thumb");
    expect(thumb).toBeTruthy();
    expect(screen.getByTestId("scam-thumb-logo")).toBeTruthy();
    expect(thumb.textContent).not.toContain("₿");
  });

  it("falls back to the glyph when no logo exists", () => {
    render(<ScamThumb label="Bank Transfer/ACH" />);
    const thumb = screen.getByTestId("scam-thumb");
    expect(thumb.textContent).toContain("🏦");
    expect(screen.queryByTestId("scam-thumb-logo")).toBeNull();
  });
});
