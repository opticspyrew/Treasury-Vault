/**
 * Page-level tests that exercise the real query-string plumbing for the
 * social sign-in UX (Google only):
 *
 *   - SignIn  reads ?social_error= on mount, passes it to <SocialAuthButtons />
 *   - SignUp  does the same
 *   - ConnectedAccounts reads ?status= on mount and shows the correct banner
 *   - ConnectedAccounts renders Connect / Disconnect for Google with the
 *     right states from /api/auth/providers/linked
 *   - Apple has been removed entirely — no Apple button or row should appear
 *
 * Heavy page dependencies (auth context, dashboard layout, login throttle,
 * forgot-password panel) are mocked so the tests stay focused on the
 * social-auth surface and don't require a running backend.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

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

vi.mock("@/lib/login-throttle", () => ({
  LoginLockoutError: class extends Error {
    msRemaining = 0;
  },
  formatRemaining: () => "",
  getLockoutState: () => ({ msRemaining: 0 }),
  subscribe: () => () => {},
  recordFailure: vi.fn(),
  recordSuccess: vi.fn(),
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

import SignIn from "../sign-in";
import SignUp from "../sign-up";
import ConnectedAccounts from "../connected-accounts";

type FetchMockMap = Record<string, (init: RequestInit | undefined) => Response | Promise<Response>>;

function installFetchMock(routes: FetchMockMap) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        return handler(init);
      }
    }
    return new Response(`unmocked ${url}`, { status: 500 });
  }) as typeof fetch;
}

function setUrl(path: string, search: string) {
  window.history.replaceState({}, "", `${path}${search}`);
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  setUrl("/", "");
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("SignIn — ?social_error= query plumbing", () => {
  it("surfaces the error banner when the URL has ?social_error=email_unverified", async () => {
    setUrl("/sign-in", "?social_error=email_unverified");
    installFetchMock({
      "/auth/providers/config": () =>
        new Response(JSON.stringify({ providers: { google: false } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    render(<SignIn />);

    const banner = await screen.findByTestId("social-auth-error");
    expect(banner.textContent).toMatch(/verified email/i);
    expect(window.location.search).toBe("");
  });

  it("does NOT render the error banner when no ?social_error is present", async () => {
    setUrl("/sign-in", "");
    installFetchMock({
      "/auth/providers/config": () =>
        new Response(JSON.stringify({ providers: { google: false } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const { container } = render(<SignIn />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await Promise.resolve();
    expect(container.querySelector('[data-testid="social-auth-error"]')).toBeNull();
  });

  it("renders the Google sign-in button when /providers/config reports google=true and NO Apple button", async () => {
    setUrl("/sign-in", "");
    installFetchMock({
      "/auth/providers/config": () =>
        new Response(JSON.stringify({ providers: { google: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    render(<SignIn />);
    const btn = await screen.findByTestId("signin-google");
    expect(btn.getAttribute("href")).toMatch(/\/auth\/google\/login$/);
    expect(screen.queryByTestId("signin-apple")).toBeNull();
  });
});

describe("SignUp — ?social_error= query plumbing", () => {
  it("surfaces the cancelled banner when the URL has ?social_error=cancelled", async () => {
    setUrl("/sign-up", "?social_error=cancelled");
    installFetchMock({
      "/auth/providers/config": () =>
        new Response(JSON.stringify({ providers: { google: false } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    render(<SignUp />);
    const banner = await screen.findByTestId("social-auth-error");
    expect(banner.textContent).toMatch(/cancelled/i);
  });

  it("does not render an Apple sign-up button", async () => {
    setUrl("/sign-up", "");
    installFetchMock({
      "/auth/providers/config": () =>
        new Response(JSON.stringify({ providers: { google: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    render(<SignUp />);
    await screen.findByTestId("signup-google");
    expect(screen.queryByTestId("signup-apple")).toBeNull();
  });
});

describe("ConnectedAccounts — ?status= query plumbing and provider rendering", () => {
  function mockLinked(payload: {
    providers: { google: boolean };
    linked: Array<{ provider: "google"; email?: string | null; linkedAt?: string }>;
    hasPassword: boolean;
  }) {
    installFetchMock({
      "/auth/providers/linked": () =>
        new Response(
          JSON.stringify({
            providers: payload.providers,
            linked: payload.linked.map((l) => ({
              provider: l.provider,
              email: l.email ?? null,
              linkedAt: l.linkedAt ?? new Date().toISOString(),
            })),
            hasPassword: payload.hasPassword,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
  }

  it("shows the success status banner for ?status=connected", async () => {
    setUrl("/connected-accounts", "?status=connected");
    mockLinked({ providers: { google: false }, linked: [], hasPassword: true });

    render(<ConnectedAccounts />);
    const banner = await screen.findByTestId("connected-accounts-status");
    expect(banner.textContent).toMatch(/Account connected/i);
    expect(window.location.search).toBe("");
  });

  it("shows the in_use_elsewhere error banner for ?status=in_use_elsewhere", async () => {
    setUrl("/connected-accounts", "?status=in_use_elsewhere");
    mockLinked({ providers: { google: true }, linked: [], hasPassword: true });

    render(<ConnectedAccounts />);
    const banner = await screen.findByTestId("connected-accounts-status");
    expect(banner.textContent).toMatch(/different Treasury Vault user/i);
  });

  it("renders an enabled Connect button when Google is configured", async () => {
    setUrl("/connected-accounts", "");
    mockLinked({ providers: { google: true }, linked: [], hasPassword: true });

    render(<ConnectedAccounts />);
    const connectGoogle = await screen.findByTestId("connect-google");
    expect(connectGoogle.textContent).toMatch(/Connect/i);
    expect((connectGoogle as HTMLButtonElement).disabled).toBe(false);
  });

  it("never renders an Apple row, Connect, or Disconnect button", async () => {
    setUrl("/connected-accounts", "");
    mockLinked({ providers: { google: true }, linked: [], hasPassword: true });

    const { container } = render(<ConnectedAccounts />);
    await screen.findByTestId("connect-google");
    expect(container.querySelector('[data-testid="connect-apple"]')).toBeNull();
    expect(container.querySelector('[data-testid="disconnect-apple"]')).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/Apple/);
  });

  it("DISABLES Disconnect when removing the link would strand the user (no password, no other provider)", async () => {
    setUrl("/connected-accounts", "");
    mockLinked({
      providers: { google: true },
      linked: [{ provider: "google", email: "alice@example.com" }],
      hasPassword: false,
    });

    render(<ConnectedAccounts />);
    const disconnect = await screen.findByTestId("disconnect-google");
    expect((disconnect as HTMLButtonElement).disabled).toBe(true);
    expect(disconnect.getAttribute("title")).toMatch(/password|provider/i);
  });

  it("ENABLES Disconnect when the user has a password (a remaining sign-in method)", async () => {
    setUrl("/connected-accounts", "");
    mockLinked({
      providers: { google: true },
      linked: [{ provider: "google", email: "alice@example.com" }],
      hasPassword: true,
    });

    render(<ConnectedAccounts />);
    const disconnect = await screen.findByTestId("disconnect-google");
    expect((disconnect as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders a disabled Connect button when Google is NOT configured", async () => {
    setUrl("/connected-accounts", "");
    mockLinked({ providers: { google: false }, linked: [], hasPassword: true });

    const { container } = render(<ConnectedAccounts />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();

    const connectGoogle = container.querySelector('[data-testid="connect-google"]') as HTMLButtonElement | null;
    expect(connectGoogle?.disabled).toBe(true);
    expect(container.querySelector('[data-testid="disconnect-google"]')).toBeNull();
  });
});
