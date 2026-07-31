/**
 * Smoke + interaction tests for the public Refunds.site marketing pages
 * (Services & Pricing, Certifications, Knowledge Base). Each page renders inside
 * the shared RefundsPublicLayout (HomeNav + FooterEcosystem). wouter's
 * useLocation is mocked to a sub-page path so navigation can be spied on, and
 * matchMedia is polyfilled for framer-motion's MotionConfig reducedMotion="user".
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { installIntersectionObserverStub } from "../components/homepage/__tests__/test-utils";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/refunds/services", navigateSpy],
}));

import RefundsServices from "../pages/services-pricing";
import RefundsCertifications from "../pages/certifications";
import RefundsKnowledgeBase from "../pages/knowledge-base";

beforeAll(() => {
  installIntersectionObserverStub();
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

afterEach(() => {
  navigateSpy.mockClear();
  cleanup();
});

describe("Refunds.site public marketing pages", () => {
  it("Services page renders with success-fee pricing and no guarantee", () => {
    render(<RefundsServices />);
    expect(screen.getByTestId("refunds-services-page")).toBeTruthy();
    // Success-aligned language, no hard dollar figures.
    expect(screen.getByText(/Success-based fee/i)).toBeTruthy();
    expect(screen.getByText(/Tailored quote/i)).toBeTruthy();
    expect(screen.getByText(/No one can guarantee recovery/i)).toBeTruthy();
  });

  it("Services hero CTA navigates to open a case", () => {
    render(<RefundsServices />);
    fireEvent.click(screen.getAllByText(/Open a case/i)[0]);
    expect(navigateSpy).toHaveBeenCalledWith("/refunds/sign-up");
  });

  it("Certifications page renders compliance frameworks", () => {
    render(<RefundsCertifications />);
    expect(screen.getByTestId("refunds-certifications-page")).toBeTruthy();
    expect(screen.getByText(/SOC 2 Type II/i)).toBeTruthy();
    expect(screen.getByText(/Chain-of-custody standards/i)).toBeTruthy();
  });

  it("Knowledge base page renders briefings and expands one", () => {
    render(<RefundsKnowledgeBase />);
    expect(screen.getByTestId("refunds-knowledge-base-page")).toBeTruthy();
    const readButtons = screen.getAllByText(/Read briefing/i);
    expect(readButtons.length).toBeGreaterThan(0);
    fireEvent.click(readButtons[0]);
    expect(screen.getByText(/Show less/i)).toBeTruthy();
  });

  it("shared layout exposes the cross-service dashboard link", () => {
    render(<RefundsKnowledgeBase />);
    expect(screen.getByTestId("refunds-to-dashboard")).toBeTruthy();
  });
});
