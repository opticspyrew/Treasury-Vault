import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import FaqSection from "../faq-section";
import { getFaqEntries } from "../../../data/mocks";
import { installIntersectionObserverStub } from "./test-utils";

beforeAll(installIntersectionObserverStub);
afterEach(cleanup);

describe("FaqSection", () => {
  it("renders one toggle button per FAQ entry", () => {
    const { container } = render(<FaqSection />);
    const buttons = container.querySelectorAll("button[aria-expanded]");
    expect(buttons.length).toBe(getFaqEntries().length);
    const text = container.textContent ?? "";
    for (const faq of getFaqEntries()) {
      expect(text).toContain(faq.question);
    }
  });

  it("opens the first entry by default and reveals its answer", () => {
    const { container } = render(<FaqSection />);
    const buttons = Array.from(
      container.querySelectorAll("button[aria-expanded]"),
    );
    expect(buttons[0].getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain(getFaqEntries()[0].answer);
  });

  it("toggles entries open and closed via the accordion controls", () => {
    const { container } = render(<FaqSection />);
    const buttons = Array.from(
      container.querySelectorAll("button[aria-expanded]"),
    );

    // Opening the second entry collapses the first (single-open accordion).
    fireEvent.click(buttons[1]);
    expect(buttons[1].getAttribute("aria-expanded")).toBe("true");
    expect(buttons[0].getAttribute("aria-expanded")).toBe("false");

    // Clicking an open entry again closes it.
    fireEvent.click(buttons[1]);
    expect(buttons[1].getAttribute("aria-expanded")).toBe("false");
  });
});
