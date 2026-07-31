// Tests guarding the Recovery Portal money flows:
//
//   POST /api/auth/signup                        — documents reported loss
//   POST /api/auth/intake                        — post-social-signup intake
//   GET  /api/auth/recovery-metrics              — derived personal figures
//   POST /api/admin/users/:id/record-recovery    — admin credits a recovery
//
// Coverage:
//   Signup:
//     1. signup with initialBalanceUsd stores it as reportedLossUsd
//     2. signup without a balance leaves reported loss undocumented
//   Intake:
//     3. missing both fields -> 400 (stays undocumented)
//     4. only scammedVia (loss still undocumented) -> 400
//     5. invalid / out-of-range assetsTotalUsd -> 400
//     6. valid intake documents both fields, needsIntake flips false
//     7. intake never overwrites already-documented values
//   Record recovery:
//     8. rejects invalid ids and non-positive / non-numeric amounts
//     9. rejects when the user has no documented loss
//    10. rejects amounts above the remaining at-risk balance
//    11. valid credit increments the cumulative recovered total
//    12. concurrent credits cannot push recovered past the reported loss —
//        exactly one wins, losers get 409 (or 400 if serialized)
//   Metrics:
//    13. at-risk, recovery rate and risk score derive correctly at 0%,
//        partial, and 100% recovery
//
// These run against a live API server (default http://localhost:8080/api).
// Run with `pnpm --filter @workspace/api-server test`.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080/api";

const createdUserIds = [];
const createdEmails = [];
let adminToken = null;

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

async function signupUser(overrides = {}) {
  const email = `recovery-flow-${rnd()}@example.com`;
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      name: "Recovery Flow Test",
      email,
      password: "Passw0rd!!",
      ...overrides,
    }),
  });
  assert.equal(res.status, 201, "signup should succeed");
  const body = await jsonOf(res);
  createdUserIds.push(body.user.id);
  createdEmails.push(email.toLowerCase());
  return { email, token: body.token, userId: body.user.id };
}

async function getMetrics(token) {
  const res = await fetch(`${BASE}/auth/recovery-metrics`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(res.status, 200, "recovery-metrics should succeed");
  return await jsonOf(res);
}

async function submitIntake(token, payload) {
  return fetch(`${BASE}/auth/intake`, {
    method: "POST",
    headers: ipHeaders({
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    }),
    body: JSON.stringify(payload),
  });
}

async function recordRecovery(userId, body) {
  return fetch(`${BASE}/admin/users/${userId}/record-recovery`, {
    method: "POST",
    headers: ipHeaders({
      "content-type": "application/json",
      "x-admin-token": adminToken,
    }),
    body: JSON.stringify(body),
  });
}

// Simulate a social signup (no documented loss) by clearing the documented
// fields directly — the OAuth flow itself is covered by the social suites.
async function makeUndocumented(userId) {
  await pool.query(
    `UPDATE users SET reported_loss_usd = NULL, scammed_via = NULL WHERE id = $1`,
    [userId],
  );
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
  // Best-effort admin session cleanup.
  if (adminToken) {
    await fetch(`${BASE}/admin/logout`, {
      method: "POST",
      headers: ipHeaders({ "x-admin-token": adminToken }),
    }).catch(() => {});
  }
  if (createdUserIds.length > 0) {
    // record-recovery writes admin_activity_log rows keyed by metadata userId
    // (no clientId FK), so clear those before the users themselves. Sessions
    // cascade with the user rows.
    await pool.query(
      `DELETE FROM admin_activity_log
       WHERE (metadata->>'userId')::int = ANY($1::int[])`,
      [createdUserIds],
    );
    await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }
  await pool.end();
});

// --- Signup documents the reported loss ------------------------------------

test("signup with initialBalanceUsd stores it as the documented reported loss", async () => {
  const { token } = await signupUser({ initialBalanceUsd: 50_000, scammedVia: "Phishing" });
  const { metrics, scammedVia } = await getMetrics(token);
  assert.equal(metrics.reportedLossUsd, 50_000);
  assert.equal(metrics.documented, true);
  assert.equal(metrics.recoveredUsd, 0);
  assert.equal(metrics.atRiskUsd, 50_000);
  assert.equal(scammedVia, "Phishing");
});

test("signup without a balance leaves the reported loss undocumented", async () => {
  const { token } = await signupUser();
  const { metrics } = await getMetrics(token);
  assert.equal(metrics.documented, false);
  assert.equal(metrics.reportedLossUsd, 0);
  assert.equal(metrics.atRiskUsd, 0);
  assert.equal(metrics.recoveryRatePct, 0);
  assert.equal(metrics.riskScore, 0);
});

// --- Intake requires both fields and never overwrites ------------------------

test("intake rejects an empty submission when nothing is documented yet", async () => {
  const { token, userId } = await signupUser();
  await makeUndocumented(userId);
  const res = await submitIntake(token, {});
  assert.equal(res.status, 400);
});

test("intake rejects a partial submission (scammedVia only, loss undocumented)", async () => {
  const { token, userId } = await signupUser();
  await makeUndocumented(userId);
  const res = await submitIntake(token, { scammedVia: "Romance scam" });
  assert.equal(res.status, 400);
  // And the reverse: amount only, scammedVia still missing.
  const res2 = await submitIntake(token, { assetsTotalUsd: 1000 });
  assert.equal(res2.status, 400);
});

test("intake rejects invalid and out-of-range amounts", async () => {
  const { token, userId } = await signupUser();
  await makeUndocumented(userId);
  for (const bad of ["abc", -5, 1_000_001]) {
    const res = await submitIntake(token, { assetsTotalUsd: bad, scammedVia: "Phishing" });
    assert.equal(res.status, 400, `assetsTotalUsd=${bad} should be rejected`);
  }
});

test("a complete intake documents both fields and clears needsIntake", async () => {
  const { token, userId } = await signupUser();
  await makeUndocumented(userId);
  const res = await submitIntake(token, { assetsTotalUsd: 12_500, scammedVia: "Fake exchange" });
  assert.equal(res.status, 200);
  const body = await jsonOf(res);
  assert.equal(body.needsIntake, false);
  assert.equal(body.metrics.reportedLossUsd, 12_500);
  assert.equal(body.metrics.documented, true);
  const { metrics, scammedVia } = await getMetrics(token);
  assert.equal(metrics.reportedLossUsd, 12_500);
  assert.equal(scammedVia, "Fake exchange");
});

test("intake never overwrites already-documented values", async () => {
  const { token } = await signupUser({ initialBalanceUsd: 30_000, scammedVia: "Phishing" });
  const res = await submitIntake(token, { assetsTotalUsd: 999_999, scammedVia: "Different story" });
  assert.equal(res.status, 200, "re-submitting intake is accepted but must be a no-op");
  const { metrics, scammedVia } = await getMetrics(token);
  assert.equal(metrics.reportedLossUsd, 30_000, "documented loss must not change");
  assert.equal(scammedVia, "Phishing", "documented scammedVia must not change");
});

// --- Record recovery ---------------------------------------------------------

test("record-recovery validates ids and amounts", async () => {
  const { userId } = await signupUser({ initialBalanceUsd: 1000, scammedVia: "Phishing" });
  assert.equal((await recordRecovery("abc", { amountUsd: 10 })).status, 400);
  for (const bad of [0, -10, "abc", null]) {
    const res = await recordRecovery(userId, { amountUsd: bad });
    assert.equal(res.status, 400, `amountUsd=${bad} should be rejected`);
  }
  // Unauthenticated admin call must be rejected.
  const res = await fetch(`${BASE}/admin/users/${userId}/record-recovery`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ amountUsd: 10 }),
  });
  assert.equal(res.status, 401);
});

test("record-recovery rejects users with no documented loss", async () => {
  const { userId } = await signupUser();
  await makeUndocumented(userId);
  const res = await recordRecovery(userId, { amountUsd: 100 });
  assert.equal(res.status, 400);
});

test("record-recovery caps credits at the remaining at-risk balance", async () => {
  const { token, userId } = await signupUser({ initialBalanceUsd: 10_000, scammedVia: "Phishing" });

  // Over the cap outright.
  assert.equal((await recordRecovery(userId, { amountUsd: 10_001 })).status, 400);

  // Partial credit succeeds and increments the running total.
  const res1 = await recordRecovery(userId, { amountUsd: 4000 });
  assert.equal(res1.status, 200);
  assert.equal((await jsonOf(res1)).user.recoveredUsd, 4000);

  // Second credit above the new remaining (6000) is rejected.
  assert.equal((await recordRecovery(userId, { amountUsd: 6001 })).status, 400);

  // Metrics reflect the partial recovery.
  const { metrics } = await getMetrics(token);
  assert.equal(metrics.recoveredUsd, 4000);
  assert.equal(metrics.atRiskUsd, 6000);
  assert.equal(metrics.recoveryRatePct, 40);
  // riskScore = round((6000/10000)*90)+5 = 59
  assert.equal(metrics.riskScore, 59);

  // Exactly the remaining amount succeeds and empties the at-risk balance.
  const res2 = await recordRecovery(userId, { amountUsd: 6000 });
  assert.equal(res2.status, 200);
  const done = await getMetrics(token);
  assert.equal(done.metrics.recoveredUsd, 10_000);
  assert.equal(done.metrics.atRiskUsd, 0);
  assert.equal(done.metrics.recoveryRatePct, 100);
  assert.equal(done.metrics.riskScore, 5);

  // Fully recovered: any further credit is rejected.
  assert.equal((await recordRecovery(userId, { amountUsd: 1 })).status, 400);
});

test("concurrent record-recovery requests cannot exceed the reported loss", async () => {
  const { token, userId } = await signupUser({ initialBalanceUsd: 5000, scammedVia: "Phishing" });

  // Fire several parallel credits that each individually fit the remaining
  // balance, but together exceed it. The atomic conditional UPDATE must let
  // exactly one through; the racers that pass the pre-check but lose the
  // UPDATE get 409, and any serialized behind the winner get 400.
  const responses = await Promise.all(
    Array.from({ length: 5 }, () => recordRecovery(userId, { amountUsd: 5000 })),
  );
  const statuses = responses.map((r) => r.status).sort();
  assert.equal(statuses.filter((s) => s === 200).length, 1, `exactly one credit should win (got ${statuses})`);
  assert.ok(
    statuses.every((s) => s === 200 || s === 400 || s === 409),
    `losers must fail cleanly with 400/409 (got ${statuses})`,
  );

  const { metrics } = await getMetrics(token);
  assert.equal(metrics.recoveredUsd, 5000, "recovered must never exceed the reported loss");
  assert.equal(metrics.atRiskUsd, 0);
});
