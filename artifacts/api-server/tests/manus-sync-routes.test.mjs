// Integration tests for the Manus / Netspy-World inbound sync surfaces, mounted
// under /api/public/refunds:
//
//   POST /sync/clients | /sync/cases | /sync/activity   (bearer-authenticated)
//   POST /webhooks/netspy-events                         (HMAC-signed)
//
// The whole integration is DISABLED by default, so these tests run an in-process
// Express app with the inbound flag + credentials set BEFORE importing the app
// (mirroring social-oauth-e2e.test.mjs). Readiness is evaluated live per request,
// so individual tests toggle process.env to exercise the disabled (503) path.
//
// Coverage:
//   * disabled  -> 503 BEFORE auth (a probe can tell "off" from "unauthorized")
//   * enabled + missing/bad bearer -> 401
//   * /sync/clients create -> 201; Idempotency-Key replay returns the stored
//     response; same key + different body -> 409; missing key -> 400 (no write)
//   * batch over the 100-item cap -> 413
//   * /sync/cases invalid status -> 422
//   * webhook: valid signature -> 200 processed; tampered sig -> 401; stale
//     timestamp -> 401; disabled -> 503
//   * concurrency: two same-key /sync/clients -> handler runs at most once
//   * webhook redelivery (fresh delivery id, same event id) -> de-duped replay
//
// Run with `pnpm --filter @workspace/api-server test`.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SYNC_TOKEN = `test-sync-token-${crypto.randomBytes(8).toString("hex")}`;
const WEBHOOK_SECRET = `test-webhook-secret-${crypto.randomBytes(8).toString("hex")}`;

// Must be set before importing app.js. Config reads env live, but set early so
// the very first request already sees an enabled, configured inbound surface.
process.env.MANUS_INBOUND_SYNC_ENABLED = "1";
process.env.MANUS_SYNC_TOKEN = SYNC_TOKEN;
process.env.NETSPY_WEBHOOK_SECRET = WEBHOOK_SECRET;
// Keep the optional body-signature off and outbound disabled for these tests.
delete process.env.MANUS_SIGNING_SECRET;
delete process.env.MANUS_OUTBOUND_SYNC_ENABLED;
if (process.env.NODE_ENV === "production") process.env.NODE_ENV = "test";

let server;
let pool;
let BASE;

const createdEmails = [];

function rnd() {
  return crypto.randomBytes(6).toString("hex");
}

// trust proxy is on, so limiters key off X-Forwarded-For; a fresh fake IP per
// request keeps the per-minute sync limiter from rejecting test traffic.
function fakeIp() {
  const oct = () => Math.floor(Math.random() * 254) + 1;
  return `10.${oct()}.${oct()}.${oct()}`;
}

function headers(extra = {}) {
  return { "x-forwarded-for": fakeIp(), "content-type": "application/json", ...extra };
}

function authHeaders(extra = {}) {
  return headers({ authorization: `Bearer ${SYNC_TOKEN}`, ...extra });
}

async function jsonOf(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function signWebhook(rawBody, tsSeconds) {
  const signed = `${tsSeconds}.${rawBody}`;
  return `sha256=${crypto.createHmac("sha256", WEBHOOK_SECRET).update(signed).digest("hex")}`;
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
  if (createdEmails.length > 0) {
    const { rows } = await pool.query(
      `SELECT id FROM admin_clients WHERE lower(email) = ANY($1::text[])`,
      [createdEmails.map((e) => e.toLowerCase())],
    );
    const clientIds = rows.map((r) => r.id);
    if (clientIds.length > 0) {
      await pool.query(`DELETE FROM admin_service_requests WHERE client_id = ANY($1::int[])`, [clientIds]);
      await pool.query(`DELETE FROM admin_activity_log WHERE client_id = ANY($1::int[])`, [clientIds]);
      await pool.query(`DELETE FROM admin_clients WHERE id = ANY($1::int[])`, [clientIds]);
    }
  }
  // Idempotency keys this suite created don't reference clients; clear the test
  // ones by their well-known prefix so repeated runs stay clean.
  await pool.query(`DELETE FROM manus_idempotency_keys WHERE key LIKE 'test-%'`);
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("disabled inbound sync returns 503 BEFORE auth", async () => {
  delete process.env.MANUS_INBOUND_SYNC_ENABLED;
  try {
    // No bearer token at all: a disabled surface must still answer 503, not 401,
    // so a probe can distinguish "not enabled yet" from "enabled but rejected".
    const res = await fetch(`${BASE}/public/refunds/sync/clients`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email: `x-${rnd()}@example.com`, name: "X" }),
    });
    assert.equal(res.status, 503);
    const body = await jsonOf(res);
    assert.equal(body.success, false);
  } finally {
    process.env.MANUS_INBOUND_SYNC_ENABLED = "1";
  }
});

test("enabled inbound sync rejects missing/bad bearer with 401", async () => {
  const noAuth = await fetch(`${BASE}/public/refunds/sync/clients`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: `x-${rnd()}@example.com`, name: "X" }),
  });
  assert.equal(noAuth.status, 401);

  const badAuth = await fetch(`${BASE}/public/refunds/sync/clients`, {
    method: "POST",
    headers: headers({ authorization: "Bearer not-the-token" }),
    body: JSON.stringify({ email: `x-${rnd()}@example.com`, name: "X" }),
  });
  assert.equal(badAuth.status, 401);
});

test("/sync/clients creates a client (201) and is idempotent on replay", async () => {
  const email = `manus-sync-${rnd()}@example.com`;
  createdEmails.push(email);
  const key = `test-${rnd()}`;
  const payload = JSON.stringify({ email, name: "Sync Client", manusClientId: `mc_${rnd()}` });

  const first = await fetch(`${BASE}/public/refunds/sync/clients`, {
    method: "POST",
    headers: authHeaders({ "idempotency-key": key }),
    body: payload,
  });
  assert.equal(first.status, 201, "first create should be 201");
  const firstBody = await jsonOf(first);
  assert.equal(firstBody.success, true);
  assert.equal(firstBody.created, true);

  // Exact replay (same key + same body) returns the stored response verbatim.
  const replay = await fetch(`${BASE}/public/refunds/sync/clients`, {
    method: "POST",
    headers: authHeaders({ "idempotency-key": key }),
    body: payload,
  });
  assert.equal(replay.status, 201, "replay should return the stored 201");
  const replayBody = await jsonOf(replay);
  assert.deepEqual(replayBody, firstBody, "replay body should match the stored response");

  // Same key, different body -> 409 conflict (before the handler runs).
  const conflict = await fetch(`${BASE}/public/refunds/sync/clients`, {
    method: "POST",
    headers: authHeaders({ "idempotency-key": key }),
    body: JSON.stringify({ email, name: "Different Body" }),
  });
  assert.equal(conflict.status, 409, "reused key with a different body should 409");
});

test("/sync write without an Idempotency-Key is rejected (400) with no side effects", async () => {
  const email = `manus-nokey-${rnd()}@example.com`;
  createdEmails.push(email); // safety net for cleanup if the guard regresses
  const res = await fetch(`${BASE}/public/refunds/sync/clients`, {
    method: "POST",
    headers: authHeaders(), // valid bearer, but no Idempotency-Key
    body: JSON.stringify({ email, name: "No Key" }),
  });
  assert.equal(res.status, 400, "a write without an Idempotency-Key should be a 400");
  const body = await jsonOf(res);
  assert.equal(body.success, false);

  // The guard runs before the handler, so nothing was written.
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM admin_clients WHERE lower(email) = $1`,
    [email.toLowerCase()],
  );
  assert.equal(rows[0].n, 0, "a rejected write must not create a client");
});

test("batch over the 100-item cap returns 413", async () => {
  const items = Array.from({ length: 101 }, () => ({
    email: `batch-${rnd()}@example.com`,
    name: "Batch",
  }));
  const res = await fetch(`${BASE}/public/refunds/sync/clients`, {
    method: "POST",
    headers: authHeaders({ "idempotency-key": `test-${rnd()}` }),
    body: JSON.stringify(items),
  });
  assert.equal(res.status, 413);
});

test("/sync/cases with an unknown status returns 422", async () => {
  const res = await fetch(`${BASE}/public/refunds/sync/cases`, {
    method: "POST",
    headers: authHeaders({ "idempotency-key": `test-${rnd()}` }),
    body: JSON.stringify({
      manusCaseId: `case_${rnd()}`,
      client: { email: `case-${rnd()}@example.com` },
      status: "definitely-not-a-status",
    }),
  });
  assert.equal(res.status, 422);
  const body = await jsonOf(res);
  assert.equal(body.success, false);
});

test("webhook case.created with a valid signature is processed (200)", async () => {
  const email = `webhook-${rnd()}@example.com`;
  createdEmails.push(email);
  const envelope = {
    id: `evt_${rnd()}`,
    timestamp: new Date().toISOString(),
    event: "case.created",
    source: "netspy",
    data: {
      unifiedCaseId: 1000 + Math.floor(Math.random() * 9000),
      netsyyCaseId: 2000 + Math.floor(Math.random() * 9000),
      clientEmail: email,
      clientName: "Webhook Client",
      caseType: "both",
      estimatedLoss: 50000,
      caseDescription: "Unauthorized access",
    },
    deliveryId: `dlv_${rnd()}`,
  };
  const raw = JSON.stringify(envelope);
  const ts = Math.floor(Date.now() / 1000);

  const res = await fetch(`${BASE}/public/refunds/webhooks/netspy-events`, {
    method: "POST",
    headers: headers({
      "x-webhook-signature": signWebhook(raw, ts),
      "x-webhook-timestamp": String(ts),
      "x-webhook-delivery-id": envelope.deliveryId,
    }),
    body: raw,
  });
  assert.equal(res.status, 200, "valid webhook should be accepted");
  const body = await jsonOf(res);
  assert.equal(body.success, true);
  assert.equal(body.processed, true);
  assert.ok(body.refundsCaseId, "response should surface the refunds case reference");
});

test("webhook in Netspy staging-sender format (type: case_created + x-netspy-signature) is processed", async () => {
  const email = `webhook-compat-${rnd()}@example.com`;
  createdEmails.push(email);
  const envelope = {
    id: `evt_${rnd()}`,
    type: "case_created", // snake_case in `type`, not dotted in `event`
    data: {
      unifiedCaseId: 1000 + Math.floor(Math.random() * 9000),
      clientEmail: email,
      clientName: "Compat Webhook Client",
      caseType: "both",
      estimatedLoss: 12345,
      caseDescription: "Staging-sender format",
    },
  };
  const raw = JSON.stringify(envelope);
  const plainSig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");

  const res = await fetch(`${BASE}/public/refunds/webhooks/netspy-events`, {
    method: "POST",
    headers: headers({ "x-netspy-signature": plainSig }),
    body: raw,
  });
  assert.equal(res.status, 200, "staging-sender format should be accepted");
  const body = await jsonOf(res);
  assert.equal(body.success, true);
  assert.equal(body.processed, true);
  assert.ok(body.refundsCaseId, "response should surface the refunds case reference");
});

test("webhook with a tampered signature is rejected (401)", async () => {
  const raw = JSON.stringify({ id: `evt_${rnd()}`, event: "case.statusUpdated", data: {} });
  const ts = Math.floor(Date.now() / 1000);
  const res = await fetch(`${BASE}/public/refunds/webhooks/netspy-events`, {
    method: "POST",
    headers: headers({
      "x-webhook-signature": `sha256=${"0".repeat(64)}`,
      "x-webhook-timestamp": String(ts),
    }),
    body: raw,
  });
  assert.equal(res.status, 401);
});

test("webhook with a stale timestamp is rejected (401)", async () => {
  const raw = JSON.stringify({ id: `evt_${rnd()}`, event: "case.statusUpdated", data: {} });
  const staleTs = Math.floor(Date.now() / 1000) - 1000; // beyond the 300s window
  const res = await fetch(`${BASE}/public/refunds/webhooks/netspy-events`, {
    method: "POST",
    headers: headers({
      "x-webhook-signature": signWebhook(raw, staleTs),
      "x-webhook-timestamp": String(staleTs),
    }),
    body: raw,
  });
  assert.equal(res.status, 401);
});

test("webhook receiver returns 503 when inbound sync is disabled", async () => {
  delete process.env.MANUS_INBOUND_SYNC_ENABLED;
  try {
    const raw = JSON.stringify({ id: `evt_${rnd()}`, event: "case.statusUpdated", data: {} });
    const ts = Math.floor(Date.now() / 1000);
    const res = await fetch(`${BASE}/public/refunds/webhooks/netspy-events`, {
      method: "POST",
      headers: headers({
        "x-webhook-signature": signWebhook(raw, ts),
        "x-webhook-timestamp": String(ts),
      }),
      body: raw,
    });
    assert.equal(res.status, 503);
  } finally {
    process.env.MANUS_INBOUND_SYNC_ENABLED = "1";
  }
});

test("concurrent same-key /sync/clients executes the handler at most once", async () => {
  const email = `manus-conc-${rnd()}@example.com`;
  createdEmails.push(email);
  const key = `test-conc-${rnd()}`;
  const payload = JSON.stringify({ email, name: "Concurrent Client", manusClientId: `mc_${rnd()}` });

  // Fire two identical requests with the same Idempotency-Key simultaneously.
  const [a, b] = await Promise.all([
    fetch(`${BASE}/public/refunds/sync/clients`, {
      method: "POST",
      headers: authHeaders({ "idempotency-key": key }),
      body: payload,
    }),
    fetch(`${BASE}/public/refunds/sync/clients`, {
      method: "POST",
      headers: authHeaders({ "idempotency-key": key }),
      body: payload,
    }),
  ]);
  const statuses = [a.status, b.status].sort();
  // Exactly one caller wins the atomic reservation and creates (201); the other
  // either replays the stored 201 or is told the key is in flight (409). There
  // is never a second independent create.
  assert.ok(statuses.includes(201), `expected at least one 201, got ${statuses}`);
  for (const s of statuses) {
    assert.ok(s === 201 || s === 409, `unexpected status ${s} (statuses=${statuses})`);
  }

  // The decisive invariant: the handler ran at most once, so exactly one client
  // row exists for this email regardless of which way the race resolved.
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM admin_clients WHERE lower(email) = $1`,
    [email.toLowerCase()],
  );
  assert.equal(rows[0].n, 1, "concurrent same-key writes must create exactly one client");
});

test("webhook redelivery with a fresh delivery id de-dupes on the stable event id", async () => {
  const email = `webhook-redeliver-${rnd()}@example.com`;
  createdEmails.push(email);
  const envelope = {
    id: `evt_${rnd()}`, // stable event id, identical across redeliveries
    timestamp: new Date().toISOString(),
    event: "case.created",
    source: "netspy",
    data: {
      unifiedCaseId: 1000 + Math.floor(Math.random() * 9000),
      netsyyCaseId: 2000 + Math.floor(Math.random() * 9000),
      clientEmail: email,
      clientName: "Redeliver Client",
      caseType: "both",
      estimatedLoss: 50000,
      caseDescription: "Unauthorized access",
    },
    deliveryId: `dlv_${rnd()}`,
  };
  const raw = JSON.stringify(envelope);
  const ts = Math.floor(Date.now() / 1000);

  const first = await fetch(`${BASE}/public/refunds/webhooks/netspy-events`, {
    method: "POST",
    headers: headers({
      "x-webhook-signature": signWebhook(raw, ts),
      "x-webhook-timestamp": String(ts),
      "x-webhook-delivery-id": `dlv_a_${rnd()}`,
    }),
    body: raw,
  });
  assert.equal(first.status, 200);
  const firstBody = await jsonOf(first);
  assert.equal(firstBody.processed, true);

  // A real at-least-once retry: same STABLE event id, but mutated per-attempt
  // delivery metadata (a different deliveryId in BOTH the body and the header)
  // and a fresh signature timestamp. It must still de-dupe on the event id and
  // replay the stored response rather than re-run the upsert.
  const envelope2 = { ...envelope, deliveryId: `dlv_${rnd()}` };
  const raw2 = JSON.stringify(envelope2);
  const ts2 = ts + 1;
  const second = await fetch(`${BASE}/public/refunds/webhooks/netspy-events`, {
    method: "POST",
    headers: headers({
      "x-webhook-signature": signWebhook(raw2, ts2),
      "x-webhook-timestamp": String(ts2),
      "x-webhook-delivery-id": `dlv_b_${rnd()}`,
    }),
    body: raw2,
  });
  assert.equal(second.status, 200, "redelivery should be accepted");
  const secondBody = await jsonOf(second);
  assert.deepEqual(secondBody, firstBody, "redelivery should replay the stored response");

  // The side effect ran once: exactly one case exists for this client.
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM admin_service_requests sr
       JOIN admin_clients c ON c.id = sr.client_id
      WHERE lower(c.email) = $1`,
    [email.toLowerCase()],
  );
  assert.equal(rows[0].n, 1, "redelivery must not create a second case");
});
