import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import RecoveryStats from "../recovery-stats";
import { getRecoveryStats } from "../../../data/mocks";
import {
  installIntersectionObserverStub,
  installResizeObserverStub,
} from "./test-utils";

beforeAll(() => {
  installIntersectionObserverStub();
  installResizeObserverStub();
});
afterEach(cleanup);

describe("RecoveryStats", () => {
  it("renders one animated counter per recovery stat", () => {
    const { container } = render(<RecoveryStats />);
    // Each stat card uses an AnimatedCounter, which renders a labelled span.
    const counters = container.querySelectorAll("span[aria-label]");
    expect(counters.length).toBe(getRecoveryStats().length);
  });

  it("labels each counter with the underlying value, prefix, and suffix", () => {
    const { container } = render(<RecoveryStats />);
    const labels = Array.from(
      container.querySelectorAll("span[aria-label]"),
    ).map((el) => el.getAttribute("aria-label"));
    for (const stat of getRecoveryStats()) {
      const expected = `${stat.prefix ?? ""}${stat.value}${stat.suffix ?? ""}`;
      expect(labels).toContain(expected);
    }
  });

  it("shows each stat's label and caption plus the trend chart heading", () => {
    const { container } = render(<RecoveryStats />);
    const text = container.textContent ?? "";
    for (const stat of getRecoveryStats()) {
      expect(text).toContain(stat.label);
      expect(text).toContain(stat.caption);
    }
    expect(text).toContain("Funds recovered (USD)");
  });
});
