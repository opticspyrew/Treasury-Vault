// HTTP integration tests for the /api/auth/providers/* endpoints.
//
// Coverage:
//   - GET /providers/config returns google flag
//   - GET /providers/linked requires auth (401) and returns shape (200)
//   - POST /providers/:p/disconnect rejects unknown provider (400)
//   - POST /providers/:p/disconnect requires auth (401)
//   - Disconnect succeeds when user still has password (i.e. a remaining method)
//   - Disconnect BLOCKED (400) when it would leave the user with no sign-in
//     method (no password AND no other provider) — the critical safety rule
//
// Provider identities are seeded directly via SQL because the OAuth callback
// can't be exercised without live provider credentials. The disconnect logic
// itself is independent of how the link was created.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080/api";

// Track every user this suite creates so we can delete them (and their
// cascading rows: provider_identities, user_sessions, etc.) at the end. This
// keeps the dev database free of test residue no matter how often the suite
// is re-run.
const createdUserIds = [];

function rnd() {
  return Math.random().toString(36).slice(2, 10);
}

// Delete every user created by this suite. The FK from provider_identities and
// user_sessions to users.id is ON DELETE CASCADE, so removing the user removes
// its seeded provider links and sessions too.
after(async () => {
  if (createdUserIds.length > 0) {
    await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }
});

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

async function signupUser() {
  const email = `social-${rnd()}@example.com`;
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      name: "Social Test",
      email,
      password: "Passw0rd!!",
      scammedVia: "Crypto",
    }),
  });
  assert.equal(res.status, 201, "signup should succeed");
  const body = await jsonOf(res);
  createdUserIds.push(body.user.id);
  return { email, token: body.token, userId: body.user.id };
}

async function seedProviderIdentity(userId, provider, providerUserId) {
  await pool.query(
    `INSERT INTO provider_identities (user_id, provider, provider_user_id, email_at_link)
     VALUES ($1, $2, $3, $4)`,
    [userId, provider, providerUserId, `${providerUserId}@example.com`],
  );
}

async function clearPassword(userId) {
  await pool.query(
    `UPDATE users
     SET password_hash = NULL, password_salt = NULL, password_iterations = NULL
     WHERE id = $1`,
    [userId],
  );
}

test("GET /providers/config returns provider availability flags", async () => {
  const res = await fetch(`${BASE}/auth/providers/config`, { headers: ipHeaders() });
  assert.equal(res.status, 200);
  const body = await jsonOf(res);
  assert.ok(body.providers, "expected providers object");
  assert.equal(typeof body.providers.google, "boolean");
  assert.equal(body.providers.apple, undefined, "apple must no longer be reported");
});

test("GET /providers/linked without a token returns 401", async () => {
  const res = await fetch(`${BASE}/auth/providers/linked`, { headers: ipHeaders() });
  assert.equal(res.status, 401);
});

test("GET /providers/linked returns linked providers and hasPassword for the session", async () => {
  const { token, userId } = await signupUser();
  await seedProviderIdentity(userId, "google", `g-${rnd()}`);

  const res = await fetch(`${BASE}/auth/providers/linked`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(res.status, 200);
  const body = await jsonOf(res);
  assert.equal(body.hasPassword, true);
  assert.ok(Array.isArray(body.linked));
  const providers = body.linked.map((l) => l.provider);
  assert.ok(providers.includes("google"));
});

test("POST /providers/:p/disconnect rejects unknown provider", async () => {
  const { token } = await signupUser();
  const res = await fetch(`${BASE}/auth/providers/facebook/disconnect`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(res.status, 400);
});

test("POST /providers/apple/disconnect is rejected (apple no longer supported)", async () => {
  const { token } = await signupUser();
  const res = await fetch(`${BASE}/auth/providers/apple/disconnect`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(res.status, 400);
});

test("POST /providers/:p/disconnect without a token returns 401", async () => {
  const res = await fetch(`${BASE}/auth/providers/google/disconnect`, {
    method: "POST",
    headers: ipHeaders(),
  });
  assert.equal(res.status, 401);
});

test("disconnect succeeds when the user still has a password", async () => {
  const { token, userId } = await signupUser();
  await seedProviderIdentity(userId, "google", `g-${rnd()}`);

  const res = await fetch(`${BASE}/auth/providers/google/disconnect`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(res.status, 200);
  const body = await jsonOf(res);
  assert.equal(body.ok, true);

  // Confirm the row is actually gone.
  const linked = await fetch(`${BASE}/auth/providers/linked`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  const linkedBody = await jsonOf(linked);
  const providers = linkedBody.linked.map((l) => l.provider);
  assert.ok(!providers.includes("google"));
});

test("disconnect is BLOCKED when it would leave the user with no sign-in method", async () => {
  const { token, userId } = await signupUser();
  await seedProviderIdentity(userId, "google", `g-${rnd()}`);
  await clearPassword(userId); // now only sign-in method is google

  const res = await fetch(`${BASE}/auth/providers/google/disconnect`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(res.status, 400, "must refuse to disconnect last method");
  const body = await jsonOf(res);
  assert.match(body.error, /sign-in method|password|provider/i);

  // The provider link should still exist.
  const linked = await fetch(`${BASE}/auth/providers/linked`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  const linkedBody = await jsonOf(linked);
  const providers = linkedBody.linked.map((l) => l.provider);
  assert.ok(providers.includes("google"), "blocked disconnect must not have deleted the row");
});

test("disconnect google is BLOCKED when only fallback is a stale apple row (apple no longer counts as a sign-in method)", async () => {
  const { token, userId } = await signupUser();
  await seedProviderIdentity(userId, "google", `g-${rnd()}`);
  await seedProviderIdentity(userId, "apple", `a-${rnd()}`); // stale, unsupported
  await clearPassword(userId);

  const res = await fetch(`${BASE}/auth/providers/google/disconnect`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(
    res.status,
    400,
    "stale apple row must NOT count as a valid alternate sign-in method",
  );
  const body = await jsonOf(res);
  assert.match(body.error, /sign-in method|password|provider/i);
});

test("GET /providers/linked hides any leftover apple rows (provider was removed)", async () => {
  const { token, userId } = await signupUser();
  await seedProviderIdentity(userId, "apple", `a-${rnd()}`);

  const res = await fetch(`${BASE}/auth/providers/linked`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(res.status, 200);
  const body = await jsonOf(res);
  const providers = body.linked.map((l) => l.provider);
  assert.ok(!providers.includes("apple"), "apple links must not be returned");
});
