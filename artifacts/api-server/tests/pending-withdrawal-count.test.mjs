// Tests guarding the pending-withdrawal warning count surfaced by
// GET /api/auth/sessions.
//
// The "Sign out all other devices" dialog warns users about in-flight
// withdrawals using `pendingWithdrawalCount`, computed in GET /sessions by
// joining admin_service_requests to admin_clients (by email) and filtering
// type='withdrawal', status='pending'. A future change to that join or those
// filters could silently report the wrong number to users, so these tests pin
// the behaviour down.
//
// Coverage:
//   1. zero pending withdrawals -> count is 0
//   2. a mix of withdrawal/non-withdrawal and pending/non-pending requests
//      -> only the pending withdrawals are counted
//   3. requests belonging to a different client/email are excluded
//
// These run against a live API server (default http://localhost:8080/api).
// Admin clients + service requests are seeded directly via SQL because there's
// no public endpoint to create an arbitrary mix of request types/statuses.
// Run with `pnpm --filter @workspace/api-server test`.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080/api";

// Track everything this suite creates so it can be removed at the end.
// admin_service_requests references admin_clients without ON DELETE CASCADE, so
// the requests must be deleted before their clients. Users cascade to their
// sessions. Re-running the suite then leaves no DB residue.
const createdUserIds = [];
const createdClientIds = [];

function rnd() {
  return Math.random().toString(36).slice(2, 10);
}

// The api server runs with `trust proxy: 1`, so the rate limiter keys off the
// X-Forwarded-For IP. A fresh fake IP per request keeps the per-minute limiters
// from rejecting our test traffic without weakening the production config.
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
  const email = `pendingwd-${rnd()}@example.com`;
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      name: "Pending WD Test",
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

async function seedClient(email) {
  const { rows } = await pool.query(
    `INSERT INTO admin_clients (name, email) VALUES ($1, $2) RETURNING id`,
    ["Pending WD Client", email],
  );
  const id = rows[0].id;
  createdClientIds.push(id);
  return id;
}

async function seedRequest(clientId, type, status) {
  await pool.query(
    `INSERT INTO admin_service_requests (client_id, type, status) VALUES ($1, $2, $3)`,
    [clientId, type, status],
  );
}

async function getPendingWithdrawalCount(token) {
  const res = await fetch(`${BASE}/auth/sessions`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(res.status, 200, "GET /sessions should succeed");
  const body = await jsonOf(res);
  return body.pendingWithdrawalCount;
}

after(async () => {
  if (createdClientIds.length > 0) {
    await pool.query(
      `DELETE FROM admin_service_requests WHERE client_id = ANY($1::int[])`,
      [createdClientIds],
    );
    await pool.query(`DELETE FROM admin_clients WHERE id = ANY($1::int[])`, [
      createdClientIds,
    ]);
  }
  if (createdUserIds.length > 0) {
    await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [
      createdUserIds,
    ]);
  }
});

test("1) a user with no withdrawals reports a count of 0", async () => {
  const { token } = await signupUser();
  // No admin_client / no service requests at all for this email.
  assert.equal(await getPendingWithdrawalCount(token), 0);
});

test("1b) a client with only non-pending / non-withdrawal requests reports 0", async () => {
  const { email, token } = await signupUser();
  const clientId = await seedClient(email);
  // Withdrawals that are not pending must not count...
  await seedRequest(clientId, "withdrawal", "completed");
  await seedRequest(clientId, "withdrawal", "rejected");
  // ...nor must pending requests of other types.
  await seedRequest(clientId, "deposit", "pending");
  await seedRequest(clientId, "send", "pending");
  assert.equal(await getPendingWithdrawalCount(token), 0);
});

test("2) only pending withdrawals are counted among a mixed set", async () => {
  const { email, token } = await signupUser();
  const clientId = await seedClient(email);
  // 3 that should count.
  await seedRequest(clientId, "withdrawal", "pending");
  await seedRequest(clientId, "withdrawal", "pending");
  await seedRequest(clientId, "withdrawal", "pending");
  // Decoys that must be excluded: wrong status and/or wrong type.
  await seedRequest(clientId, "withdrawal", "completed");
  await seedRequest(clientId, "deposit", "pending");
  await seedRequest(clientId, "send", "completed");
  assert.equal(await getPendingWithdrawalCount(token), 3);
});

test("3) pending withdrawals belonging to a different client/email are excluded", async () => {
  const { email, token } = await signupUser();
  const myClientId = await seedClient(email);
  // One genuine pending withdrawal for our user.
  await seedRequest(myClientId, "withdrawal", "pending");

  // A completely separate client (different email) with its own pending
  // withdrawals — these must never leak into our user's count.
  const otherClientId = await seedClient(`other-${rnd()}@example.com`);
  await seedRequest(otherClientId, "withdrawal", "pending");
  await seedRequest(otherClientId, "withdrawal", "pending");

  assert.equal(await getPendingWithdrawalCount(token), 1);
});
