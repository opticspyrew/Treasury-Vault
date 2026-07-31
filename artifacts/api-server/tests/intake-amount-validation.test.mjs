// Tests guarding loss-amount validation on the case-intake endpoint
// POST /api/public/refunds/intake.
//
// The intake handler stores `amount` into a numeric(14, 2) column. Before
// validation, a malformed value (e.g. "1.2.3") or one exceeding the column's
// 12-integer-digit precision reached Postgres as a cast/overflow and surfaced
// to the user as a 500. The handler now parses and validates `amount` up front
// and returns a clean 400 on bad input, while leaving valid (and omitted)
// amounts working unchanged.
//
// Coverage:
//   1. malformed amount ("1.2.3") -> 400
//   2. non-numeric amount ("abc") -> 400
//   3. negative amount ("-50") -> 400
//   4. out-of-range amount (>= 1e12) -> 400
//   5. a valid amount (with comma grouping) -> 201
//   6. an omitted amount -> 201 (amount is optional)
//
// These run against a live API server (default http://localhost:8080/api).
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
const createdEmails = [];

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
  const email = `intake-amt-${rnd()}@example.com`;
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      name: "Intake Amount Test",
      email,
      password: "Passw0rd!!",
      scammedVia: "Crypto",
    }),
  });
  assert.equal(res.status, 201, "signup should succeed");
  const body = await jsonOf(res);
  createdUserIds.push(body.user.id);
  createdEmails.push(email.toLowerCase());
  return { email, token: body.token, userId: body.user.id };
}

async function submitIntake(token, overrides = {}) {
  const res = await fetch(`${BASE}/public/refunds/intake`, {
    method: "POST",
    headers: ipHeaders({
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    }),
    body: JSON.stringify({
      incident: "phishing",
      asset: "ETH",
      chain: "Ethereum",
      ...overrides,
    }),
  });
  return res;
}

after(async () => {
  // The intake handler may auto-create an admin_client (and service requests)
  // keyed by the user's email. Remove those first, then the users.
  if (createdEmails.length > 0) {
    const { rows } = await pool.query(
      `SELECT id FROM admin_clients WHERE lower(email) = ANY($1::text[])`,
      [createdEmails],
    );
    const clientIds = rows.map((r) => r.id);
    if (clientIds.length > 0) {
      // admin_clients is referenced by both admin_service_requests and
      // admin_activity_log (the intake handler logs client_registered /
      // service_request_submitted), neither with ON DELETE CASCADE — so both
      // must be cleared before the clients themselves.
      await pool.query(
        `DELETE FROM admin_service_requests WHERE client_id = ANY($1::int[])`,
        [clientIds],
      );
      await pool.query(
        `DELETE FROM admin_activity_log WHERE client_id = ANY($1::int[])`,
        [clientIds],
      );
      await pool.query(`DELETE FROM admin_clients WHERE id = ANY($1::int[])`, [
        clientIds,
      ]);
    }
  }
  if (createdUserIds.length > 0) {
    await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [
      createdUserIds,
    ]);
  }
});

test("1) a malformed amount is rejected with 400, not a 500", async () => {
  const { token } = await signupUser();
  const res = await submitIntake(token, { amount: "1.2.3" });
  assert.equal(res.status, 400, "malformed amount should yield a clean 400");
  const body = await jsonOf(res);
  assert.match(body.error, /amount/i);
});

test("2) a non-numeric amount is rejected with 400", async () => {
  const { token } = await signupUser();
  const res = await submitIntake(token, { amount: "abc" });
  assert.equal(res.status, 400);
});

test("3) a negative amount is rejected with 400", async () => {
  const { token } = await signupUser();
  const res = await submitIntake(token, { amount: "-50" });
  assert.equal(res.status, 400);
});

test("4) an out-of-range amount (exceeds numeric precision) is rejected with 400", async () => {
  const { token } = await signupUser();
  // numeric(14, 2) caps at 12 integer digits; 13 digits would overflow.
  const res = await submitIntake(token, { amount: "9999999999999" });
  assert.equal(res.status, 400);
});

test("5) a valid amount (with comma grouping) is accepted with 201", async () => {
  const { token } = await signupUser();
  const res = await submitIntake(token, { amount: "12,500.50" });
  assert.equal(res.status, 201, "a well-formed amount should be accepted");
  const body = await jsonOf(res);
  assert.match(body.reference, /^RF-\d{4}-\d{4}$/);
});

test("6) an omitted amount is accepted with 201 (amount is optional)", async () => {
  const { token } = await signupUser();
  const res = await submitIntake(token, {});
  assert.equal(res.status, 201, "amount is optional and may be omitted");
});

test("7) a non-string amount payload is rejected with 400, not a 500", async () => {
  const { token } = await signupUser();
  // A JSON number would throw on string ops; an object/array likewise. All must
  // be rejected cleanly rather than crashing into the 500 catch block.
  for (const badAmount of [123, { value: 1 }, [1, 2]]) {
    const res = await submitIntake(token, { amount: badAmount });
    assert.equal(
      res.status,
      400,
      `non-string amount ${JSON.stringify(badAmount)} should yield 400`,
    );
  }
});
