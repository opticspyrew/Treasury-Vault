/**
 * Shared helpers for the Refunds.site homepage section tests.
 *
 * jsdom does not implement IntersectionObserver, which framer-motion relies on
 * for `whileInView` / `useInView` (used by the `Reveal` wrapper and several
 * sections). Without a stub, motion elements never enter view and their
 * children are not rendered, so install a no-op observer before each suite.
 */
export function installIntersectionObserverStub(): void {
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
}

/**
 * jsdom does not implement ResizeObserver, which recharts' ResponsiveContainer
 * uses to measure its parent. Install a no-op stub so chart-bearing sections
 * render without throwing.
 */
export function installResizeObserverStub(): void {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // jsdom has no ResizeObserver; recharts needs one.
  globalThis.ResizeObserver = MockResizeObserver;
}
