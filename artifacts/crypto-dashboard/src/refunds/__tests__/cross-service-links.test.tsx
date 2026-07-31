/**
 * Guards the cross-service navigation from Refunds.site into the CryptoVault
 * dashboard. Several surfaces expose a "Crypto Dashboard" link that must route
 * to /dashboard; a future refactor could silently change the target and break
 * the hand-off between the two products. These tests render each surface and
 * assert that activating the link navigates to /dashboard.
 *
 *   - HomeNav      desktop button  (data-testid="refunds-to-dashboard")
 *   - HomeNav      mobile menu     (data-testid="refunds-to-dashboard-mobile")
 *   - RefundsSignIn page link      (data-testid="refunds-to-dashboard")
 *   - RefundsSignUp page link      (data-testid="refunds-to-dashboard")
 *   - RefundsShell header link     (data-testid="refunds-to-dashboard")
 *
 * wouter's useLocation is mocked so we can spy on the navigate function, and
 * the auth context / login throttle are stubbed so the pages render without a
 * backend (matching the existing page-test pattern).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/", navigateSpy],
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { email: "t@example.com", name: "Tester" },
    isAuthenticated: true,
    token: "test-token",
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    setPassword: vi.fn(),
    forgotPassword: vi.fn(),
    resetPasswordWithToken: vi.fn(),
    accountExists: vi.fn(),
  }),
}));

vi.mock("@/lib/login-throttle", () => ({
  LoginLockoutError: class extends Error {
    msRemaining = 0;
  },
  formatRemaining: () => "",
  getLockoutState: () => ({ msRemaining: 0, locked: false, failures: 0 }),
  subscribe: () => () => {},
  recordFailure: vi.fn(),
  recordSuccess: vi.fn(),
}));

import HomeNav from "../components/homepage/home-nav";
import RefundsSignIn from "../pages/sign-in";
import RefundsSignUp from "../pages/sign-up";
import RefundsShell from "../components/refunds-shell";

beforeEach(() => {
  navigateSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("Refunds.site → Crypto Dashboard cross-service links", () => {
  it("HomeNav desktop button navigates to /dashboard", () => {
    render(<HomeNav />);
    fireEvent.click(screen.getByTestId("refunds-to-dashboard"));
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("HomeNav mobile menu button navigates to /dashboard", () => {
    render(<HomeNav />);
    // The mobile link lives inside the menu, which only mounts once opened.
    fireEvent.click(screen.getByLabelText("Open menu"));
    fireEvent.click(screen.getByTestId("refunds-to-dashboard-mobile"));
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("RefundsSignIn page link navigates to /dashboard", () => {
    render(<RefundsSignIn />);
    fireEvent.click(screen.getByTestId("refunds-to-dashboard"));
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("RefundsSignUp page link navigates to /dashboard", () => {
    render(<RefundsSignUp />);
    fireEvent.click(screen.getByTestId("refunds-to-dashboard"));
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("RefundsShell header link navigates to /dashboard", () => {
    render(
      <RefundsShell active="overview" onSectionChange={vi.fn()}>
        <div>content</div>
      </RefundsShell>,
    );
    fireEvent.click(screen.getByTestId("refunds-to-dashboard"));
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
  });
});
