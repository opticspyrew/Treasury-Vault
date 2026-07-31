import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import RecoveryCategories from "../recovery-categories";
import { getRecoveryCategories } from "../../../data/mocks";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("RecoveryCategories", () => {
  it("renders one card per recovery category", () => {
    const { container } = render(<RecoveryCategories />);
    const cards = container.querySelectorAll("article");
    expect(cards.length).toBe(getRecoveryCategories().length);
  });

  it("shows each category's name, summary, and on-chain signals", () => {
    const { container } = render(<RecoveryCategories />);
    const text = container.textContent ?? "";
    for (const cat of getRecoveryCategories()) {
      expect(text).toContain(cat.name);
      expect(text).toContain(cat.summary);
      for (const signal of cat.signals) {
        expect(text).toContain(signal);
      }
    }
  });
});
