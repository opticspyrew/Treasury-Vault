/**
 * Cross-tab session sync tests for AuthProvider.
 *
 * The provider listens for the browser's "storage" event, which fires in every
 * OTHER tab of the origin when localStorage changes. These tests simulate that
 * event to confirm a login/logout in one tab is reflected in this one:
 *
 *   1. Removing the session elsewhere (logout) flips isAuthenticated to false.
 *   2. Writing a new session elsewhere (login/signup) flips isAuthenticated to
 *      true and adopts the new user.
 *   3. Unrelated storage keys are ignored.
 *
 * We start with an empty store so the provider's on-mount token validation
 * (authApi.me) short-circuits and never touches the network.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "../auth-context";

const SESSION_KEY = "cryptovault.session";

function sessionValue(email: string, name: string, token = "tok-123") {
  return JSON.stringify({ token, user: { email, name } });
}

function Consumer() {
  const { isAuthenticated, user } = useAuth();
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="email">{user?.email ?? ""}</span>
      <span data-testid="name">{user?.name ?? ""}</span>
    </div>
  );
}

/**
 * Simulate another tab mutating localStorage and the browser broadcasting the
 * resulting "storage" event to this tab. The real browser updates storage
 * before dispatching, so we mirror that ordering here.
 */
function dispatchStorage(key: string | null, newValue: string | null) {
  if (key !== null) {
    if (newValue === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, newValue);
    }
  }
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("AuthProvider — cross-tab session sync", () => {
  it("logs out when the session is removed in another tab", () => {
    window.localStorage.setItem(SESSION_KEY, sessionValue("a@example.com", "Ada"));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("auth").textContent).toBe("yes");
    expect(screen.getByTestId("email").textContent).toBe("a@example.com");

    dispatchStorage(SESSION_KEY, null);

    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(screen.getByTestId("email").textContent).toBe("");
    expect(screen.getByTestId("name").textContent).toBe("");
  });

  it("logs in with the new user when a session is written in another tab", () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("auth").textContent).toBe("no");

    dispatchStorage(SESSION_KEY, sessionValue("b@example.com", "Babbage"));

    expect(screen.getByTestId("auth").textContent).toBe("yes");
    expect(screen.getByTestId("email").textContent).toBe("b@example.com");
    expect(screen.getByTestId("name").textContent).toBe("Babbage");
  });

  it("swaps to the new user when another tab signs in as someone else", () => {
    window.localStorage.setItem(SESSION_KEY, sessionValue("a@example.com", "Ada"));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("email").textContent).toBe("a@example.com");

    dispatchStorage(SESSION_KEY, sessionValue("c@example.com", "Curie"));

    expect(screen.getByTestId("auth").textContent).toBe("yes");
    expect(screen.getByTestId("email").textContent).toBe("c@example.com");
    expect(screen.getByTestId("name").textContent).toBe("Curie");
  });

  it("ignores storage events for unrelated keys", () => {
    window.localStorage.setItem(SESSION_KEY, sessionValue("a@example.com", "Ada"));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("auth").textContent).toBe("yes");

    // A different key changes — even if its value looks session-like, it must
    // not affect auth state.
    dispatchStorage("some.other.key", sessionValue("evil@example.com", "Mallory"));

    expect(screen.getByTestId("auth").textContent).toBe("yes");
    expect(screen.getByTestId("email").textContent).toBe("a@example.com");
    expect(screen.getByTestId("name").textContent).toBe("Ada");
  });

  it("clears the session when the whole store is cleared (null key)", () => {
    window.localStorage.setItem(SESSION_KEY, sessionValue("a@example.com", "Ada"));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("auth").textContent).toBe("yes");

    // localStorage.clear() in another tab fires a "storage" event with key=null.
    window.localStorage.clear();
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });

    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(screen.getByTestId("email").textContent).toBe("");
  });
});
