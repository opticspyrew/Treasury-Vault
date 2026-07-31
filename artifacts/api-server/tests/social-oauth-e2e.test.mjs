// End-to-end tests for the full Google OAuth round-trip.
//
// Task #84 added unit tests (link-or-create) and HTTP tests (disconnect) but
// could not exercise the actual sign-in / connect redirect chain, because real
// Google credentials aren't configured. This file closes that gap by running
// the whole journey against an in-process Express app with the fake provider
// enabled (SOCIAL_OAUTH_TEST_MODE), so it runs in CI without any credentials:
//
//   1. Sign-in: /google/login -> fake consent -> /google/callback creates a
//      brand-new user, issues a session token, and lands on /dashboard.
//   2. Connect + disconnect: a logged-in user links Google from the
//      "Connected accounts" flow (/google/connect -> callback) and then
//      removes it via the disconnect endpoint.
//   3. Returning sign-in with the same email reuses the same user (no dupes).
//
// The fake consent screen (served at /google/test-authorize in test mode)
// stands in for Google's account chooser; the browser-level equivalent of
// these flows is covered separately via the Playwright testing subagent.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

// Must be set BEFORE the app module is imported so the social providers read it.
process.env.SOCIAL_OAUTH_TEST_MODE = "1";
delete process.env.GOOGLE_OAUTH_CLIENT_ID;
delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (process.env.NODE_ENV === "production") process.env.NODE_ENV = "test";

let server;
let pool;
let BASE;

// Track every account this suite creates — both the ones made via /auth/signup
// and the brand-new users the fake Google sign-in flow creates — so they can be
// deleted in after(). provider_identities and user_sessions have an ON DELETE
// CASCADE FK to users.id, so removing the user removes its linked rows too.
// Re-running the suite repeatedly then leaves no stale rows in the dev DB.
const createdEmails = [];

function rnd() {
  return Math.random().toString(36).slice(2, 10);
}

function fakeIp() {
  const oct = () => Math.floor(Math.random() * 254) + 1;
  return `10.${oct()}.${oct()}.${oct()}`;
}

function ipHeaders(extra = {}) {
  return { "x-forwarded-for": fakeIp(), ...extra };
}

async function jsonOf(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

// Pull the OAuth state cookie ("cv_oauth_google=...") out of a response so we
// can replay it on the follow-up callback request (an httpOnly cookie a real
// browser would send automatically).
function extractStateCookie(res) {
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const c of cookies) {
    if (c.startsWith("cv_oauth_google=")) {
      return c.split(";")[0];
    }
  }
  return null;
}

function stateFromLocation(location) {
  const url = new URL(location, "http://localhost");
  return url.searchParams.get("state");
}

before(async () => {
  const { default: app } = await import("../src/app.js");
  ({ pool } = await import("@workspace/db"));
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const { port } = server.address();
  BASE = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  // Remove every user this suite created (cascades to provider_identities and
  // user_sessions). Match case-insensitively because the server lowercases
  // emails on store, while the test keeps the original-cased string.
  if (pool && createdEmails.length > 0) {
    await pool.query(
      `DELETE FROM users WHERE lower(email) = ANY($1::text[])`,
      [createdEmails.map((e) => e.toLowerCase())],
    );
  }
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function signupUser() {
  const email = `e2e-${rnd()}@example.com`;
  createdEmails.push(email);
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      name: "E2E Test",
      email,
      password: "Passw0rd!!",
      scammedVia: "Crypto",
    }),
  });
  assert.equal(res.status, 201, "signup should succeed");
  const body = await jsonOf(res);
  return { email, token: body.token, userId: body.user.id };
}

// Drive the fake provider: hit /login (or /connect), then the callback with the
// returned state + chosen email. Returns the final callback response (manual
// redirect, so we can inspect the Location).
async function runFakeOAuth({ startPath, email, name }) {
  const start = await fetch(`${BASE}${startPath}`, {
    headers: ipHeaders(),
    redirect: "manual",
  });
  assert.equal(start.status, 302, `${startPath} should redirect to fake consent`);
  const location = start.headers.get("location");
  assert.ok(
    location && location.includes("/google/test-authorize"),
    `expected redirect to test-authorize, got ${location}`,
  );
  const state = stateFromLocation(location);
  assert.ok(state, "state must be present on the consent redirect");
  const cookie = extractStateCookie(start);
  assert.ok(cookie, "state cookie must be set by the login/connect step");

  const params = new URLSearchParams({ state, email });
  if (name) params.set("name", name);
  const callback = await fetch(`${BASE}/auth/google/callback?${params.toString()}`, {
    headers: ipHeaders({ cookie }),
    redirect: "manual",
  });
  return callback;
}

test("sign-in with Google creates a brand-new user and lands on the dashboard", async () => {
  const email = `e2e-google-${rnd()}@example.com`;
  createdEmails.push(email);
  const res = await runFakeOAuth({
    startPath: "/auth/google/login",
    email,
    name: "Gloria Google",
  });

  assert.equal(res.status, 302, "callback should redirect");
  const location = res.headers.get("location");
  assert.ok(
    location && location.startsWith("/dashboard#social_token="),
    `expected dashboard hand-off, got ${location}`,
  );
  assert.match(location, /provider=google/);

  // The new user must actually exist in the database.
  const { rows } = await pool.query(
    "SELECT id, name FROM users WHERE email = $1",
    [email],
  );
  assert.equal(rows.length, 1, "exactly one user should have been created");
  assert.equal(rows[0].name, "Gloria Google");

  // ...with a matching provider identity row.
  const links = await pool.query(
    "SELECT provider FROM provider_identities WHERE user_id = $1",
    [rows[0].id],
  );
  assert.ok(
    links.rows.some((r) => r.provider === "google"),
    "a google provider_identities row should exist for the new user",
  );
});

test("signing in again with the same Google email reuses the same user (no duplicate)", async () => {
  const email = `e2e-return-${rnd()}@example.com`;
  createdEmails.push(email);
  await runFakeOAuth({ startPath: "/auth/google/login", email, name: "Repeat User" });
  const second = await runFakeOAuth({
    startPath: "/auth/google/login",
    email,
    name: "Repeat User",
  });
  assert.equal(second.status, 302);
  assert.ok(second.headers.get("location")?.startsWith("/dashboard#social_token="));

  const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  assert.equal(rows.length, 1, "should not create a second user for the same email");
});

test("connect Google from a signed-in session, then disconnect it", async () => {
  const { token, userId, email } = await signupUser();

  // Connect: the /connect endpoint authenticates via ?token= on the redirect.
  const connectRes = await runFakeOAuth({
    startPath: `/auth/google/connect?token=${encodeURIComponent(token)}`,
    email, // same email as the account -> auto-link / attach to this user
    name: "E2E Test",
  });
  assert.equal(connectRes.status, 302);
  assert.equal(
    connectRes.headers.get("location"),
    "/connected-accounts?status=connected",
    "connect should land on connected-accounts with success status",
  );

  // The link should now show up for this user.
  const linked = await fetch(`${BASE}/auth/providers/linked`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  const linkedBody = await jsonOf(linked);
  assert.ok(
    linkedBody.linked.some((l) => l.provider === "google"),
    "google should be listed as a connected provider",
  );

  // Sanity: it's attached to the right user.
  const dbLinks = await pool.query(
    "SELECT provider FROM provider_identities WHERE user_id = $1",
    [userId],
  );
  assert.ok(dbLinks.rows.some((r) => r.provider === "google"));

  // Disconnect (the user still has a password, so this is allowed).
  const disc = await fetch(`${BASE}/auth/providers/google/disconnect`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(disc.status, 200);
  assert.equal((await jsonOf(disc)).ok, true);

  const afterLinked = await fetch(`${BASE}/auth/providers/linked`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  const afterBody = await jsonOf(afterLinked);
  assert.ok(
    !afterBody.linked.some((l) => l.provider === "google"),
    "google link should be gone after disconnect",
  );
});

test("cancelling at the fake consent screen surfaces a sign-in error", async () => {
  const start = await fetch(`${BASE}/auth/google/login`, {
    headers: ipHeaders(),
    redirect: "manual",
  });
  const state = stateFromLocation(start.headers.get("location"));
  const cookie = extractStateCookie(start);

  const params = new URLSearchParams({ state, error: "user_cancelled_authorize" });
  const res = await fetch(`${BASE}/auth/google/callback?${params.toString()}`, {
    headers: ipHeaders({ cookie }),
    redirect: "manual",
  });
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.get("location"),
    "/sign-in?social_error=cancelled",
    "cancel should redirect to /sign-in with a cancelled error",
  );
});

test("/providers/config reports google as available in test mode", async () => {
  const res = await fetch(`${BASE}/auth/providers/config`, { headers: ipHeaders() });
  assert.equal(res.status, 200);
  const body = await jsonOf(res);
  assert.equal(body.providers.google, true, "google must be configured in test mode");
});
