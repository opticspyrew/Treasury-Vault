/**
 * Regression contract for Replit task #193 (sign-in security-lock screen).
 *
 * These tests exercise the real SignIn page, AuthProvider and API client.
 * The upstream "Security Lock with Email OTP" dependency must land before
 * this suite can pass. Until then, keep this test branch / PR in draft.
 *
 * In particular, a server SECURITY_LOCKED response must be handled ahead
 * of the temporary local login-throttle countdown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/lib/auth-context";
import SignIn from "../sign-in";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/sign-in", mocks.navigate],
}));

vi.mock("@/components/social-auth-buttons", () => ({
  default: () => null,
}));

vi.mock("@/components/total-assets-banner", () => ({
  default: () => null,
}));

vi.mock("@/components/forgot-password-panel", () => ({
  ForgotPasswordPanel: () => null,
}));

vi.mock("@/components/password-input", () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
  }) => (
    <input
      type="password"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label="Password"
    />
  ),
}));

const originalFetch = globalThis.fetch;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function setupServer(verifyResult?: Response) {
  const requests: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    requests.push(path);

    if (path.endsWith("/auth/login")) {
      return json(
        {
          error: "This account is security locked. Enter the email verification code.",
          code: "SECURITY_LOCKED",
          maskedEmail: "a***e@example.com",
        },
        423,
      );
    }

    if (path.endsWith("/auth/security-lock/verify")) {
      return verifyResult ?? json({ error: "Invalid verification code." }, 400);
    }

    if (path.endsWith("/auth/security-lock/resend")) {
      return json({ ok: true });
    }

    return json({ error: `Unexpected endpoint: ${path}` }, 500);
  });
  globalThis.fetch = fetchMock as typeof fetch;
  return { requests, fetchMock };
}

function renderSignIn() {
  render(
    <AuthProvider>
      <SignIn />
    </AuthProvider>,
  );
}

async function requestSecurityLock() {
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "alice@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "wrong-password" },
  });
  fireEvent.click(screen.getByTestId("signin-submit"));

  return screen.findByTestId("security-lock-panel");
}

async function enterCodeAndVerify(code: string) {
  const panel = screen.getByTestId("security-lock-panel");
  const otp = panel.querySelector("input");
  expect(otp).not.toBeNull();
  fireEvent.change(otp!, { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: /verify|unlock/i }));
}

beforeEach(() => {
  window.history.replaceState({}, "", "/sign-in");
  window.localStorage.clear();
  window.sessionStorage.clear();
  mocks.navigate.mockReset();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("Security Lock with Email OTP — sign-in regression (task #193)", () => {
  it("shows the masked-email six-digit security-lock panel, NOT a countdown", async () => {
    const { requests } = setupServer();
    const panel = await (async () => {
      renderSignIn();
      return requestSecurityLock();
    })();

    expect(panel.textContent).toMatch(/a[^@\s]*@example\.com/i);
    expect(panel.textContent).toMatch(/lock|verification|code/i);
    expect(panel.querySelector("input")?.getAttribute("maxLength")).toBe("6");
    expect(screen.queryByTestId("signin-lockout-banner")).toBeNull();
    expect(requests.some((path) => path.endsWith("/auth/login"))).toBe(true);
  });

  it("rejects a wrong verification code without signing in", async () => {
    const { requests } = setupServer(json({ code: "INVALID_OTP", error: "Invalid verification code." }, 400));
    renderSignIn();
    await requestSecurityLock();
    await enterCodeAndVerify("123456");

    await waitFor(() => {
      expect(screen.getByTestId("security-lock-panel").textContent).toMatch(/invalid|incorrect|expired/i);
    });
    expect(requests.some((path) => path.endsWith("/auth/security-lock/verify"))).toBe(true);
    expect(window.localStorage.getItem("cryptovault.session")).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalledWith("/dashboard");
  });

  it("stores the verified session and navigates to the dashboard", async () => {
    const session = {
      token: "verified-security-otp-session",
      expiresAt: "2030-01-01T00:00:00.000Z",
      user: { id: 12, email: "alice@example.com", name: "Alice" },
    };
    const { requests } = setupServer(json(session));
    renderSignIn();
    await requestSecurityLock();
    await enterCodeAndVerify("654321");

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/dashboard"));
    const stored = JSON.parse(window.localStorage.getItem("cryptovault.session") ?? "null");
    expect(stored?.token).toBe(session.token);
    expect(stored?.user?.email).toBe(session.user.email);
    expect(requests.some((path) => path.endsWith("/auth/security-lock/verify"))).toBe(true);
  });
});
