/**
 * OSINT validators — pure chain/format detection for addresses and tx hashes.
 */

import { describe, expect, it } from "vitest";
import { inspectAddress, inspectTxHash } from "../osint";

describe("inspectAddress", () => {
  it("detects an EVM address and links to Etherscan", () => {
    const r = inspectAddress("0x52908400098527886E0F7030069857D2E4169EE7");
    expect(r.valid).toBe(true);
    expect(r.chain).toBe("Ethereum / EVM");
    expect(r.explorers.some((e) => e.name === "Etherscan")).toBe(true);
    expect(r.explorers[0].url).toContain("0x52908400098527886E0F7030069857D2E4169EE7");
  });

  it("detects a TRON address", () => {
    const r = inspectAddress("TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC");
    expect(r.valid).toBe(true);
    expect(r.chain).toBe("TRON");
    expect(r.explorers[0].name).toBe("Tronscan");
  });

  it("detects a Bitcoin bech32 address", () => {
    const r = inspectAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
    expect(r.valid).toBe(true);
    expect(r.chain).toBe("Bitcoin");
    expect(r.format).toContain("Bech32");
  });

  it("detects a legacy Bitcoin address", () => {
    const r = inspectAddress("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2");
    expect(r.valid).toBe(true);
    expect(r.chain).toBe("Bitcoin");
  });

  it("rejects garbage input", () => {
    const r = inspectAddress("not-an-address");
    expect(r.valid).toBe(false);
    expect(r.explorers).toHaveLength(0);
    expect(r.note).toBeTruthy();
  });

  it("returns an empty inspection for blank input", () => {
    const r = inspectAddress("   ");
    expect(r.valid).toBe(false);
    expect(r.note).toBeNull();
  });
});

describe("inspectTxHash", () => {
  it("detects an EVM transaction hash", () => {
    const r = inspectTxHash("0x" + "a".repeat(64));
    expect(r.valid).toBe(true);
    expect(r.chain).toBe("Ethereum / EVM");
    expect(r.explorers.some((e) => e.name === "Etherscan")).toBe(true);
  });

  it("offers BTC and TRON explorers for a bare 64-hex hash", () => {
    const r = inspectTxHash("b".repeat(64));
    expect(r.valid).toBe(true);
    expect(r.explorers.map((e) => e.name)).toEqual(
      expect.arrayContaining(["Blockchair (BTC)", "Tronscan (TRX)"]),
    );
  });

  it("rejects a too-short hash", () => {
    const r = inspectTxHash("0xabc");
    expect(r.valid).toBe(false);
  });
});
