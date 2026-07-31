/**
 * Legal coordination templates — pure document builders from a CaseReport.
 */

import { describe, expect, it } from "vitest";
import { LEGAL_DOC_TYPES, buildLegalDoc, type LegalDocType } from "../legal-templates";
import type { CaseReport } from "../types";

const REPORT: CaseReport = {
  reference: "RF-2026-0001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  firm: {
    legalName: "NETSPYWORLD FORENSICS LTD",
    brand: "Netspy-World Forensics",
    jurisdictionNote: "Recovery is never guaranteed.",
  },
  client: { name: "Ada Client", email: "ada@example.com" },
  case: {
    id: 1,
    reference: "RF-2026-0001",
    incident: "Phishing & approval drains",
    asset: "USDT",
    chain: "Ethereum",
    amount: "12500.00",
    currency: "USD",
    status: "investigating",
    submittedAt: "2026-01-15T00:00:00.000Z",
    txHashes: ["0xdeadbeef", "0xfeedface"],
  },
  activity: [],
};

describe("buildLegalDoc", () => {
  it("exposes four document types", () => {
    expect(LEGAL_DOC_TYPES).toHaveLength(4);
  });

  it("builds every document type without throwing and cites the case facts", () => {
    for (const { type } of LEGAL_DOC_TYPES) {
      const doc = buildLegalDoc(type, REPORT);
      expect(doc.title).toBeTruthy();
      expect(doc.recipient).toBeTruthy();
      expect(doc.body).toContain("RF-2026-0001");
      expect(doc.body).toContain("Ada Client");
      expect(doc.body).toContain("NETSPYWORLD FORENSICS LTD");
      // transaction hashes are embedded
      expect(doc.body).toContain("0xdeadbeef");
    }
  });

  it("produces distinct titles per type", () => {
    const titles = LEGAL_DOC_TYPES.map(({ type }) => buildLegalDoc(type, REPORT).title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("formats a USD amount in the body", () => {
    const doc = buildLegalDoc("exchange_freeze" as LegalDocType, REPORT);
    expect(doc.body).toContain("$12,500.00 USD");
  });
});
