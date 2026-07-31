import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import ComplianceLegal from "../compliance-legal";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("ComplianceLegal", () => {
  it("lists each compliance certification with its detail", () => {
    const { container } = render(<ComplianceLegal />);
    const text = container.textContent ?? "";
    const certs: [string, string][] = [
      ["SOC 2 Type II", "Controls audited annually"],
      ["ISO 27001", "Information security management"],
      ["AML/KYC", "Sanctions screening on every counterparty"],
      ["GDPR / CCPA", "Data minimization by default"],
    ];
    for (const [label, detail] of certs) {
      expect(text).toContain(label);
      expect(text).toContain(detail);
    }
  });

  it("renders every engagement guardrail", () => {
    const { container } = render(<ComplianceLegal />);
    const text = container.textContent ?? "";
    expect(text).toContain(
      "We do not custody assets or request your private keys.",
    );
    expect(text).toContain("We cannot reverse on-chain transactions.");
    expect(text).toContain(
      "We do not guarantee recovery — outcomes are case-dependent.",
    );
  });

  it("renders the certifications and guardrails as list items", () => {
    const { container } = render(<ComplianceLegal />);
    // 4 certifications + 4 guardrails.
    expect(container.querySelectorAll("li").length).toBe(8);
  });
});
