import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import HeroSection from "../hero-section";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("HeroSection", () => {
  it("renders the headline and both primary calls to action", () => {
    const { container, getByText } = render(<HeroSection />);
    const heading = container.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(getByText(/Open secure portal/i)).not.toBeNull();
    const secondary = getByText(/See how recovery works/i);
    expect(secondary.getAttribute("href")).toBe("#process");
  });

  it("shows the three at-a-glance stats", () => {
    const { container } = render(<HeroSection />);
    const text = container.textContent ?? "";
    for (const label of ["Chains analyzed", "Avg. triage", "Controls audit"]) {
      expect(text).toContain(label);
    }
  });
});
