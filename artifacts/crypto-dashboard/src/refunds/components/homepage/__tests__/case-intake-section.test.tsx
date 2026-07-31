import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import CaseIntakeSection from "../case-intake-section";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("CaseIntakeSection", () => {
  it("renders every step of the intake flow", () => {
    const { container } = render(<CaseIntakeSection />);
    const steps = container.querySelectorAll("ol li");
    expect(steps.length).toBe(5);
    const text = container.textContent ?? "";
    for (const label of [
      "Incident type",
      "Affected assets",
      "Transaction hashes",
      "Evidence upload",
      "Review & submit",
    ]) {
      expect(text).toContain(label);
    }
  });

  it("offers a call to action to start a case", () => {
    const { getByText } = render(<CaseIntakeSection />);
    expect(getByText(/Start a case/i)).not.toBeNull();
  });
});
