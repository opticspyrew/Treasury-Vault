/**
 * Report Generation portal section.
 *
 * Verifies the section renders empty states with no cases, compiles a forensic
 * report once a case is selected, and triggers the print/export flow. The data
 * hooks (useMyCases, useCaseReport) and the auth context are mocked so the
 * section renders without a backend, matching the existing test pattern.
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

import ReportGeneration from "../reports";

const SAMPLE_CASE = {
  id: 1,
  reference: "RF-2026-0001",
  incident: "Phishing & approval drains",
  asset: "USDT",
  chain: "Ethereum",
  amount: "1000.00",
  currency: "USD",
  status: "pending",
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
  client: { name: "Tester", email: "t@example.com" },
  case: { ...SAMPLE_CASE, txHashes: ["0xabc123"] },
  activity: [
    {
      at: "2026-01-01T00:00:00.000Z",
      eventType: "service_request_submitted",
      description: "Case filed",
    },
  ],
};

afterEach(() => {
  cleanup();
  document.body.classList.remove("refunds-printing");
  vi.clearAllMocks();
});

describe("Report generation portal section", () => {
  it("shows empty states when the client has no cases", () => {
    useMyCasesMock.mockReturnValue({ cases: [], loading: false, error: null, reload: vi.fn() });
    useCaseReportMock.mockReturnValue({ report: null, loading: false, error: null });

    render(<ReportGeneration />);

    expect(screen.getByText(/No cases yet/i)).toBeTruthy();
    expect(screen.getByText(/No case selected/i)).toBeTruthy();
    expect(screen.queryByTestId("reports-document")).toBeNull();
  });

  it("renders the forensic report after selecting a case and prints it", () => {
    useMyCasesMock.mockReturnValue({
      cases: [SAMPLE_CASE],
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    useCaseReportMock.mockReturnValue({ report: SAMPLE_REPORT, loading: false, error: null });
    const printSpy = vi.fn();
    window.print = printSpy;

    render(<ReportGeneration />);

    // The report only renders once a case is selected.
    expect(screen.queryByTestId("reports-document")).toBeNull();

    fireEvent.click(screen.getByTestId("reports-case-RF-2026-0001"));

    expect(screen.getByTestId("reports-document")).toBeTruthy();
    expect(screen.getByText("Digital Asset Forensic Report")).toBeTruthy();
    expect(screen.getByText("0xabc123")).toBeTruthy();
    expect(screen.getByText("Case filed")).toBeTruthy();

    fireEvent.click(screen.getByTestId("reports-print"));
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains("refunds-printing")).toBe(true);
  });
});
