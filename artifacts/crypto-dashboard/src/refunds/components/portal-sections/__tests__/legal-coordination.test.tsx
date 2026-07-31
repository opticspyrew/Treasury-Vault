/**
 * Legal coordination portal section.
 *
 * Verifies the section compiles legal correspondence from a selected case and
 * switches between document types. Data hooks and auth are mocked so the
 * section renders without a backend; the template builders run for real.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CaseReport } from "../../../data/types";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ token: "test-token", user: { name: "Tester", email: "t@example.com" } }),
}));

const { useMyCasesMock, useCaseReportMock } = vi.hoisted(() => ({
  useMyCasesMock: vi.fn(),
  useCaseReportMock: vi.fn(),
}));

vi.mock("../../../data/api", () => ({
  useMyCases: useMyCasesMock,
  useCaseReport: useCaseReportMock,
}));

import LegalCoordination from "../legal-coordination";

const SAMPLE_CASE = {
  id: 1,
  reference: "RF-2026-0001",
  incident: "Phishing & approval drains",
  asset: "USDT",
  chain: "Ethereum",
  amount: "1000.00",
  currency: "USD",
  status: "investigating",
  submittedAt: "2026-01-01T00:00:00.000Z",
};

const SAMPLE_REPORT: CaseReport = {
  reference: "RF-2026-0001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  firm: {
    legalName: "NETSPYWORLD FORENSICS LTD",
    brand: "Netspy-World Forensics",
    jurisdictionNote: "Recovery is never guaranteed.",
  },
  client: { name: "Ada Client", email: "ada@example.com" },
  case: { ...SAMPLE_CASE, txHashes: ["0xdeadbeef"] },
  activity: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Legal coordination portal section", () => {
  it("shows the empty state with no case selected", () => {
    useMyCasesMock.mockReturnValue({ cases: [SAMPLE_CASE], loading: false, error: null, reload: vi.fn() });
    useCaseReportMock.mockReturnValue({ report: SAMPLE_REPORT, loading: false, error: null });

    render(<LegalCoordination />);
    expect(screen.getByText(/No case selected/i)).toBeTruthy();
    expect(screen.queryByTestId("legal-document")).toBeNull();
  });

  it("drafts a document and switches between document types", () => {
    useMyCasesMock.mockReturnValue({ cases: [SAMPLE_CASE], loading: false, error: null, reload: vi.fn() });
    useCaseReportMock.mockReturnValue({ report: SAMPLE_REPORT, loading: false, error: null });

    render(<LegalCoordination />);
    fireEvent.click(screen.getByTestId("legal-case-RF-2026-0001"));

    // Default document type is the exchange freeze request.
    const title = screen.getByTestId("legal-document-title");
    expect(title.textContent).toContain("Freeze");
    expect(screen.getByTestId("legal-document").textContent).toContain("Ada Client");

    // Switch to the law enforcement referral.
    fireEvent.click(screen.getByTestId("legal-doctype-law_enforcement"));
    expect(screen.getByTestId("legal-document-title").textContent).toContain("Law Enforcement");
  });
});
