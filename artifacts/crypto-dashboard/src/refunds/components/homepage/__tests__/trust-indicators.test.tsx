import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import TrustIndicators from "../trust-indicators";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("TrustIndicators", () => {
  it("shows every compliance badge", () => {
    const { container } = render(<TrustIndicators />);
    const text = container.textContent ?? "";
    for (const badge of [
      "SOC 2 Type II",
      "ISO 27001",
      "AML / KYC screening",
      "GDPR / CCPA aligned",
    ]) {
      expect(text).toContain(badge);
    }
  });

  it("lists every analyzed network plus the overflow indicator", () => {
    const { container } = render(<TrustIndicators />);
    const text = container.textContent ?? "";
    for (const chain of [
      "Bitcoin",
      "Ethereum",
      "Tron",
      "BNB Chain",
      "Polygon",
      "Arbitrum",
      "Solana",
      "Base",
    ]) {
      expect(text).toContain(chain);
    }
    expect(text).toContain("+9 more");
  });
});
