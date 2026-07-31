/**
 * Component tests for the Refunds.site recovery-process section.
 *
 * The build introduced accessible list semantics: the five-stage process is an
 * ordered list (<ol>) whose stages are list items (<li>). These tests assert
 * that contract holds and that every step from the data layer is rendered.
 *
 * framer-motion's whileInView relies on IntersectionObserver, which jsdom does
 * not implement; we stub it so the motion elements render their children.
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import RecoveryProcess from "../recovery-process";
import { getProcessSteps } from "../../../data/mocks";

beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error - jsdom has no IntersectionObserver; framer-motion needs one.
  globalThis.IntersectionObserver = MockIntersectionObserver;
});

afterEach(() => {
  cleanup();
});

describe("RecoveryProcess", () => {
  it("renders the steps as an ordered list with direct <li> children", () => {
    const { container } = render(<RecoveryProcess />);
    const list = container.querySelector("ol");
    expect(list).not.toBeNull();

    const items = list!.querySelectorAll(":scope > li");
    expect(items.length).toBe(getProcessSteps().length);
  });

  it("renders one list item per process step, in order, with its title", () => {
    const { container } = render(<RecoveryProcess />);
    const steps = getProcessSteps();
    const items = Array.from(
      container.querySelectorAll("ol > li"),
    ) as HTMLElement[];

    expect(items).toHaveLength(steps.length);
    steps.forEach((step, i) => {
      expect(items[i].textContent).toContain(step.title);
      expect(items[i].textContent).toContain(String(step.index));
    });
  });

  it("does not render bare list items outside of the ordered list", () => {
    const { container } = render(<RecoveryProcess />);
    const allItems = container.querySelectorAll("li");
    const listItems = container.querySelectorAll("ol > li");
    expect(allItems.length).toBe(listItems.length);
  });
});
