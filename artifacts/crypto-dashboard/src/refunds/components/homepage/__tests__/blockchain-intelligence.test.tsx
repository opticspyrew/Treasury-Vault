/**
 * Component tests for the Refunds.site blockchain-intelligence section.
 *
 * The path-of-funds graph is an SVG. For accessibility, each node is a
 * keyboard-focusable, labelled button (tabIndex 0, role="button", aria-label),
 * and focusing a node reveals its label text (the same behavior as hover).
 * These tests guard that keyboard affordance.
 *
 * framer-motion's whileInView relies on IntersectionObserver, which jsdom does
 * not implement; we stub it so the motion elements render their children.
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import BlockchainIntelligence from "../blockchain-intelligence";

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

describe("BlockchainIntelligence — path-of-funds graph accessibility", () => {
  it("exposes the graph as a labelled image", () => {
    const { container } = render(<BlockchainIntelligence />);
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-label")).toMatch(/path of funds/i);
  });

  it("renders graph nodes as keyboard-focusable buttons with accessible labels", () => {
    const { container } = render(<BlockchainIntelligence />);
    const svg = container.querySelector('svg[role="img"]')!;
    const nodes = Array.from(
      svg.querySelectorAll('g[role="button"]'),
    ) as SVGGElement[];

    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node.getAttribute("tabindex")).toBe("0");
      expect(node.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("reveals a node's label on focus (keyboard parity with hover)", () => {
    const { container } = render(<BlockchainIntelligence />);
    const svg = container.querySelector('svg[role="img"]')!;
    const firstNode = svg.querySelector('g[role="button"]') as SVGGElement;
    const label = firstNode.getAttribute("aria-label") ?? "";
    // aria-label is "<label> (<kind>)"; the visible <text> shows just <label>.
    const visibleLabel = label.replace(/\s*\([^)]*\)\s*$/, "");

    expect(svg.querySelector("text")).toBeNull();
    fireEvent.focus(firstNode);

    const text = svg.querySelector("text");
    expect(text).not.toBeNull();
    expect(text!.textContent).toBe(visibleLabel);
  });
});
