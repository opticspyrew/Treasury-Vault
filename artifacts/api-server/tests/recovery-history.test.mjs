// Tests guarding GET /api/auth/recovery-history — the credit-by-credit
// timeline in the Recovery Portal.
//
// Coverage:
//   1. requires authentication (401 without / with a bogus token)
//   2. entries appear (newest first) after admin record-recovery credits,
//      with correct amountUsd / runningTotalUsd
//   3. entries are scoped to the authenticated user only
//   4. cursor pagination: first page is 50, hasMore/nextCursor correct,
//      `before` returns strictly older rows, non-overlapping, terminal page
//      has hasMore=false / nextCursor=null; garbage cursors are ignored
//   5. rows with unparseable amount metadata are skipped without breaking
//      the page (string-numeric amounts are coerced, not dropped)
//
// These run against a live API server (default http://localhost:8080/api).
// Run with `pnpm --filter @workspace/api-server test`.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080/api";

const createdUserIds = [];
let adminToken = null;

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

async function signupUser(overrides = {}) {
  const email = `recovery-history-${rnd()}@example.com`;
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      name: "Recovery History Test",
      email,
      password: "Passw0rd!!",
      initialBalanceUsd: 500_000,
      scammedVia: "Phishing",
      ...overrides,
    }),
  });
  assert.equal(res.status, 201, "signup should succeed");
  const body = await jsonOf(res);
  createdUserIds.push(body.user.id);
  return { email, token: body.token, userId: body.user.id };
}

async function recordRecovery(userId, amountUsd) {
  const res = await fetch(`${BASE}/admin/users/${userId}/record-recovery`, {
    method: "POST",
    headers: ipHeaders({
      "content-type": "application/json",
      "x-admin-token": adminToken,
    }),
    body: JSON.stringify({ amountUsd }),
  });
  assert.equal(res.status, 200, `record-recovery(${amountUsd}) should succeed`);
  return jsonOf(res);
}

async function getHistory(token, before) {
  const qs = before !== undefined ? `?before=${encodeURIComponent(before)}` : "";
  return fetch(`${BASE}/auth/recovery-history${qs}`, {
    headers: ipHeaders(token ? { authorization: `Bearer ${token}` } : {}),
  });
}

// Insert a synthetic ledger row directly, bypassing the admin endpoint —
// used for bulk pagination fixtures and malformed-metadata rows.
async function insertLedgerRow(metadata) {
  const { rows } = await pool.query(
    `INSERT INTO admin_activity_log (event_type, description, metadata)
     VALUES ('user_recovery_recorded', 'test fixture', $1::jsonb)
     RETURNING id`,
    [JSON.stringify(metadata)],
  );
  return rows[0].id;
}

before(async () => {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  assert.ok(user && pass, "ADMIN_USERNAME / ADMIN_PASSWORD must be set to run these tests");
  const res = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ username: user, password: pass }),
  });
  assert.equal(res.status, 200, "admin login should succeed");
  adminToken = (await jsonOf(res)).token;
});

after(async () => {
  if (adminToken) {
    await fetch(`${BASE}/admin/logout`, {
      method: "POST",
      headers: ipHeaders({ "x-admin-token": adminToken }),
    }).catch(() => {});
  }
  if (createdUserIds.length > 0) {
    await pool.query(
      `DELETE FROM admin_activity_log
       WHERE (metadata->>'userId')::int = ANY($1::int[])`,
      [createdUserIds],
    );
    await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }
  await pool.end();
});

// --- Auth ---------------------------------------------------------------

test("recovery-history requires a valid session", async () => {
  const noToken = await getHistory(null);
  assert.equal(noToken.status, 401);
  const badToken = await getHistory("definitely-not-a-real-token");
  assert.equal(badToken.status, 401);
});

// --- Entries appear after admin credits ----------------------------------

test("credits recorded by an admin appear in the timeline, newest first", async () => {
  const { token, userId } = await signupUser();

  // Empty timeline before any credit.
  const empty = await jsonOf(await getHistory(token));
  assert.deepEqual(empty, { entries: [], hasMore: false, nextCursor: null });

  await recordRecovery(userId, 1000);
  await recordRecovery(userId, 250);

  const body = await jsonOf(await getHistory(token));
  assert.equal(body.hasMore, false);
  assert.equal(body.nextCursor, null);
  assert.equal(body.entries.length, 2);

  // Newest first: the $250 credit came second.
  const [newest, oldest] = body.entries;
  assert.equal(newest.amountUsd, 250);
  assert.equal(newest.runningTotalUsd, 1250);
  assert.equal(oldest.amountUsd, 1000);
  assert.equal(oldest.runningTotalUsd, 1000);
  assert.ok(newest.id > oldest.id, "ids should be descending");
  for (const e of body.entries) {
    assert.ok(!Number.isNaN(Date.parse(e.creditedAt)), "creditedAt must be an ISO timestamp");
    // Only the projected fields — never the admin-facing description/metadata.
    assert.deepEqual(
      Object.keys(e).sort(),
      ["amountUsd", "creditedAt", "id", "runningTotalUsd"],
    );
  }
});

// --- Scoping --------------------------------------------------------------

test("a user only sees their own credits", async () => {
  const alice = await signupUser();
  const bob = await signupUser();

  await recordRecovery(alice.userId, 5000);
  await recordRecovery(bob.userId, 777);

  const aliceBody = await jsonOf(await getHistory(alice.token));
  assert.equal(aliceBody.entries.length, 1);
  assert.equal(aliceBody.entries[0].amountUsd, 5000);

  const bobBody = await jsonOf(await getHistory(bob.token));
  assert.equal(bobBody.entries.length, 1);
  assert.equal(bobBody.entries[0].amountUsd, 777);
});

// --- Pagination -------------------------------------------------------------

test("cursor pagination returns older pages with correct hasMore/nextCursor", async () => {
  const { token, userId } = await signupUser();

  // 60 synthetic credits → page 1 has 50, page 2 has 10.
  const ids = [];
  for (let i = 1; i <= 60; i++) {
    ids.push(await insertLedgerRow({ userId, amountUsd: i, recoveredUsd: i }));
  }

  const page1 = await jsonOf(await getHistory(token));
  assert.equal(page1.entries.length, 50);
  assert.equal(page1.hasMore, true);
  const oldestOnPage1 = page1.entries[page1.entries.length - 1];
  assert.equal(page1.nextCursor, oldestOnPage1.id, "nextCursor is the oldest id on the page");
  // Newest first: page 1 covers credits 60 down to 11.
  assert.equal(page1.entries[0].amountUsd, 60);
  assert.equal(oldestOnPage1.amountUsd, 11);

  const page2 = await jsonOf(await getHistory(token, page1.nextCursor));
  assert.equal(page2.entries.length, 10);
  assert.equal(page2.hasMore, false);
  assert.equal(page2.nextCursor, null);
  assert.equal(page2.entries[0].amountUsd, 10);
  assert.equal(page2.entries[9].amountUsd, 1);

  // No overlap between pages.
  const seen = new Set(page1.entries.map((e) => e.id));
  for (const e of page2.entries) {
    assert.ok(!seen.has(e.id), "pages must not overlap");
    assert.ok(e.id < page1.nextCursor, "page 2 rows are strictly older than the cursor");
  }

  // Garbage cursors are ignored (treated as no cursor), not a server error.
  for (const bad of ["abc", "-5", "0"]) {
    const res = await getHistory(token, bad);
    assert.equal(res.status, 200, `before=${bad} should not error`);
    const body = await jsonOf(res);
    assert.equal(body.entries.length, 50, `before=${bad} should behave like the first page`);
  }
});

// --- Malformed metadata -------------------------------------------------------

test("rows with unparseable amount metadata are skipped without breaking the page", async () => {
  const { token, userId } = await signupUser();

  await insertLedgerRow({ userId, amountUsd: 100, recoveredUsd: 100 });
  // Unparseable variants that must be skipped.
  await insertLedgerRow({ userId, amountUsd: "not-a-number", recoveredUsd: 100 });
  await insertLedgerRow({ userId, recoveredUsd: 100 }); // amount missing
  await insertLedgerRow({ userId, amountUsd: null, recoveredUsd: 100 });
  // String-numeric amount is coerced, not dropped.
  await insertLedgerRow({ userId, amountUsd: "42", recoveredUsd: 142 });

  const res = await getHistory(token);
  assert.equal(res.status, 200, "malformed rows must not break the endpoint");
  const body = await jsonOf(res);
  assert.equal(body.entries.length, 2, "only parseable rows are returned");
  assert.equal(body.entries[0].amountUsd, 42); // newest
  assert.equal(body.entries[0].runningTotalUsd, 142);
  assert.equal(body.entries[1].amountUsd, 100);
  assert.equal(body.hasMore, false);
});
