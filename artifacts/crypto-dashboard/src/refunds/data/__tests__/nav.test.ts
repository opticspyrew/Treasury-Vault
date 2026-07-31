/**
 * Unit tests for the route-safe navigation helper used across the public
 * Refunds.site surface. It must:
 *   - navigate directly for a pure route,
 *   - scroll (no navigation) when already on a hash target's page,
 *   - normalize a bare "#anchor" to the landing page,
 *   - navigate first, then scroll, when the hash target is another page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refundsGo } from "../nav";

describe("refundsGo", () => {
  let navigate: ReturnType<typeof vi.fn>;
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let querySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    navigate = vi.fn();
    scrollIntoView = vi.fn();
    querySpy = vi
      .spyOn(document, "querySelector")
      .mockReturnValue({ scrollIntoView } as unknown as Element);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("navigates directly for a pure route", () => {
    refundsGo("/refunds/services", "/refunds", navigate);
    expect(navigate).toHaveBeenCalledWith("/refunds/services");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls without navigating when already on the hash target page", () => {
    refundsGo("/refunds#faq", "/refunds", navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(querySpy).toHaveBeenCalledWith("#faq");
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("normalizes a bare anchor to the landing page section", () => {
    refundsGo("#process", "/refunds", navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(querySpy).toHaveBeenCalledWith("#process");
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("navigates then defers the scroll when the hash target is another page", () => {
    refundsGo("#faq", "/refunds/services", navigate);
    expect(navigate).toHaveBeenCalledWith("/refunds");
    // Scroll is deferred until the destination page has mounted.
    expect(scrollIntoView).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(querySpy).toHaveBeenCalledWith("#faq");
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
