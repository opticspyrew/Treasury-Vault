/**
 * Page-level tests confirming the PasswordRulesChecklist actually renders on
 * every screen where a user picks a NEW password:
 *
 *   - SignUp          (account creation)
 *   - ChangePassword  (in-app, while signed in)
 *   - ResetPassword   (from an emailed reset link)
 *
 * Each test asserts the checklist (data-testid="password-rules-checklist")
 * appears next to that page's new-password input, and that typing into the
 * input flips a rule from "not met" to "met" — proving the live feedback is
 * wired through, not just statically present.
 *
 * Heavy page dependencies (auth context, dashboard layout, reset-token API,
 * social/forgot panels) are mocked so the tests stay focused on the
 * password-rules surface and don't require a running backend.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { email: "t@example.com", name: "T" },
    isAuthenticated: true,
    token: "test-token",
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    forgotPassword: vi.fn(),
    resetPasswordWithToken: vi.fn(),
    accountExists: vi.fn(),
  }),
}));

vi.mock("@/components/dashboard-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/forgot-password-panel", () => ({
  ForgotPasswordPanel: () => null,
}));

vi.mock("@/components/total-assets-banner", () => ({
  default: () => null,
}));

vi.mock("@/components/social-auth-buttons", () => ({
  default: () => null,
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    validateResetToken: vi.fn(async () => ({ valid: true, email: "t***@example.com" })),
  },
}));

import SignUp from "../sign-up";
import ChangePassword from "../change-password";
import ResetPassword from "../reset-password";

function ruleState(key: "minLength" | "mixedClasses" | "notCommon"): string | null {
  return screen.getByTestId(`password-rule-${key}`).getAttribute("data-passed");
}

beforeEach(() => {
  window.history.replaceState({}, "", "/?token=valid-token");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SignUp — password rules checklist", () => {
  it("renders the checklist under the new-password input", () => {
    render(<SignUp />);
    expect(screen.getByTestId("password-rules-checklist")).toBeTruthy();
    expect(ruleState("minLength")).toBe("false");
  });

  it("flips minLength + mixedClasses to met as the user types a valid password", () => {
    render(<SignUp />);
    const input = screen.getByPlaceholderText(/Min\. 8 chars/i);
    fireEvent.change(input, { target: { value: "Str0ng-Pass!" } });
    expect(ruleState("minLength")).toBe("true");
    expect(ruleState("mixedClasses")).toBe("true");
    expect(ruleState("notCommon")).toBe("true");
  });
});

describe("ChangePassword — password rules checklist", () => {
  it("renders the checklist under the new-password input", () => {
    render(<ChangePassword />);
    expect(screen.getByTestId("password-rules-checklist")).toBeTruthy();
    expect(ruleState("minLength")).toBe("false");
  });

  it("flips rules to met when a valid new password is entered", () => {
    render(<ChangePassword />);
    const input = screen.getByTestId("change-password-new");
    fireEvent.change(input, { target: { value: "Str0ng-Pass!" } });
    expect(ruleState("minLength")).toBe("true");
    expect(ruleState("mixedClasses")).toBe("true");
    expect(ruleState("notCommon")).toBe("true");
  });
});

describe("ResetPassword — password rules checklist", () => {
  it("renders the checklist once the reset token validates", async () => {
    render(<ResetPassword />);
    // The form (and checklist) only show after the token is validated.
    expect(await screen.findByTestId("password-rules-checklist")).toBeTruthy();
    expect(ruleState("minLength")).toBe("false");
  });

  it("flips rules to met as the user types a valid password", async () => {
    render(<ResetPassword />);
    const input = await screen.findByTestId("reset-new-password");
    fireEvent.change(input, { target: { value: "Str0ng-Pass!" } });
    await waitFor(() => expect(ruleState("minLength")).toBe("true"));
    expect(ruleState("mixedClasses")).toBe("true");
    expect(ruleState("notCommon")).toBe("true");
  });
});
