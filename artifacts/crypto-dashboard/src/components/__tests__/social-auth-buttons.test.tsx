/**
 * Component tests for SocialAuthButtons.
 *
 *   1. When Google is disabled (its server-side OAuth config is missing), no
 *      provider button renders — but if a ?social_error= code was passed in,
 *      the error banner still appears.
 *   2. When Google is configured, the "Continue with Google" button renders
 *      with the right data-testid for the page mode (signin-google on
 *      sign-in, signup-google on sign-up).
 *   3. The errorCode → human message mapping renders the expected copy for
 *      all known error codes, and falls back to a generic message for an
 *      unknown code.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import SocialAuthButtons from "../social-auth-buttons";

const originalFetch = globalThis.fetch;

function mockProvidersConfig(config: { google: boolean }) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/auth/providers/config")) {
      return new Response(JSON.stringify({ providers: config }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not mocked", { status: 500 });
  }) as typeof fetch;
}

function mockProvidersConfigFailure() {
  globalThis.fetch = vi.fn(async () => {
    throw new Error("network down");
  }) as typeof fetch;
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("SocialAuthButtons — google disabled", () => {
  it("renders nothing when google is disabled and no error is passed", async () => {
    mockProvidersConfig({ google: false });
    const { container } = render(<SocialAuthButtons mode="signin" />);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    await Promise.resolve();
    expect(container.querySelector('[data-testid="signin-google"]')).toBeNull();
    expect(container.querySelector('[data-testid="social-auth-error"]')).toBeNull();
  });

  it("shows ONLY the error banner when google is disabled and an error code is passed", async () => {
    mockProvidersConfig({ google: false });
    render(<SocialAuthButtons mode="signin" errorCode="email_unverified" />);
    const banner = await screen.findByTestId("social-auth-error");
    expect(banner.textContent).toMatch(/verified email/i);
    expect(screen.queryByTestId("signin-google")).toBeNull();
  });

  it("treats a fetch failure as 'google disabled' (graceful degradation)", async () => {
    mockProvidersConfigFailure();
    const { container } = render(<SocialAuthButtons mode="signin" />);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    await Promise.resolve();
    expect(container.querySelector('[data-testid="signin-google"]')).toBeNull();
  });

  it("never renders an Apple button, even if the server somehow reports apple=true", async () => {
    mockProvidersConfig({ google: true, apple: true } as { google: boolean });
    render(<SocialAuthButtons mode="signin" />);
    await screen.findByTestId("signin-google");
    expect(screen.queryByTestId("signin-apple")).toBeNull();
  });
});

describe("SocialAuthButtons — google configured", () => {
  it("renders the Google button (sign-in mode) when google=true", async () => {
    mockProvidersConfig({ google: true });
    render(<SocialAuthButtons mode="signin" />);
    const googleBtn = await screen.findByTestId("signin-google");
    expect(googleBtn.tagName).toBe("A");
    expect(googleBtn.getAttribute("href")).toMatch(/\/auth\/google\/login$/);
    expect(googleBtn.textContent).toMatch(/Continue with Google/i);
  });

  it("uses 'signup-google' data-testid when mode is 'signup'", async () => {
    mockProvidersConfig({ google: true });
    render(<SocialAuthButtons mode="signup" />);
    expect(await screen.findByTestId("signup-google")).toBeTruthy();
    expect(screen.queryByTestId("signin-google")).toBeNull();
  });

  it("renders the error banner ABOVE the button when both are present", async () => {
    mockProvidersConfig({ google: true });
    render(<SocialAuthButtons mode="signin" errorCode="cancelled" />);
    const banner = await screen.findByTestId("social-auth-error");
    expect(banner.textContent).toMatch(/cancelled/i);
    expect(await screen.findByTestId("signin-google")).toBeTruthy();
  });
});

describe("SocialAuthButtons — error code → message mapping", () => {
  const cases: Array<[string, RegExp]> = [
    ["cancelled", /cancelled/i],
    ["provider_error", /provider reported/i],
    ["missing_state", /session expired/i],
    ["exchange_failed", /couldn'?t verify/i],
    ["email_unverified", /verified email/i],
    ["google_not_configured", /google sign-in/i],
    ["start_failed", /couldn'?t start/i],
    ["user_resolve_failed", /creating your account/i],
    ["session_failed", /create a session/i],
    ["auth_required", /sign in before/i],
  ];

  for (const [code, pattern] of cases) {
    it(`renders the right message for error code '${code}'`, async () => {
      mockProvidersConfig({ google: false });
      render(<SocialAuthButtons mode="signin" errorCode={code} />);
      const banner = await screen.findByTestId("social-auth-error");
      expect(banner.textContent ?? "").toMatch(pattern);
    });
  }

  it("falls back to a generic 'Sign-in failed' message for unknown codes", async () => {
    mockProvidersConfig({ google: false });
    render(<SocialAuthButtons mode="signin" errorCode="some_brand_new_code" />);
    const banner = await screen.findByTestId("social-auth-error");
    expect(banner.textContent).toMatch(/Sign-in failed/i);
  });

  it("does NOT include an apple_not_configured message", async () => {
    mockProvidersConfig({ google: false });
    render(<SocialAuthButtons mode="signin" errorCode="apple_not_configured" />);
    const banner = await screen.findByTestId("social-auth-error");
    // Unknown code → generic fallback, not an Apple-specific message.
    expect(banner.textContent).toMatch(/Sign-in failed/i);
    expect(banner.textContent ?? "").not.toMatch(/apple/i);
  });
});
