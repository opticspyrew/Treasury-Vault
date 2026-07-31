import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import InvestigationOps from "../investigation-ops";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("InvestigationOps", () => {
  it("shows each operations metric with its value", () => {
    const { container } = render(<InvestigationOps />);
    const text = container.textContent ?? "";
    const metrics: [string, string][] = [
      ["Active analysts", "24"],
      ["Addresses monitored", "1,902"],
      ["Open alerts", "37"],
      ["Median triage", "5.8h"],
    ];
    for (const [label, value] of metrics) {
      expect(text).toContain(label);
      expect(text).toContain(value);
    }
  });

  it("renders one row per live operations feed entry", () => {
    const { container } = render(<InvestigationOps />);
    const rows = container.querySelectorAll("ul li");
    expect(rows.length).toBe(4);
    const text = container.textContent ?? "";
    expect(text).toContain("Address 0x4a91…b7f1 flagged — outflow to mixer");
    expect(text).toContain("Venue engagement authorized by client");
  });
});
