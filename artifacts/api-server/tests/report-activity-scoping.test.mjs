// Tests guarding per-case activity scoping on the case report endpoint
// GET /api/public/refunds/reports/:reference (which also backs the AI case
// narrative at POST /api/public/refunds/ai/report/:reference).
//
// A client can have more than one recovery case. The report's activity timeline
// must show ONLY the events that belong to the case being viewed, plus
// client-level events that have no owning case (e.g. client registration). It
// must never bleed another case's events into this report — otherwise a client
// would see investigation activity for an unrelated case of theirs.
//
// admin_activity_log.service_request_id encodes the owning case. The report
// filter keeps rows where service_request_id matches this case OR is NULL
// (client-level), and excludes rows tagged to a different case.
//
// Coverage:
//   1. a case report includes its own intake event + the client-level
//      registration event, and EXCLUDES the other case's intake event.
//
// Runs against a live API server (default http://localhost:8080/api).
// Run with `pnpm --filter @workspace/api-server test`.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080/api";

const createdUserIds = [];
const createdEmails = [];

function rnd() {
  return Math.random().toString(36).slice(2, 10);
}

// The api server runs with `trust proxy: 1`, so limiters key off X-Forwarded-For.
// A fresh fake IP per request keeps the per-minute limiters from rejecting test
// traffic without weakening the production config.
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
  const email = `report-scope-${rnd()}@example.com`;
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      name: "Report Scope Test",
      email,
      password: "Passw0rd!!",
      scammedVia: "Crypto",
    }),
  });
  assert.equal(res.status, 201, "signup should succeed");
  const body = await jsonOf(res);
  createdUserIds.push(body.user.id);
  createdEmails.push(email.toLowerCase());
  return { email, token: body.token };
}

async function submitIntake(token, overrides) {
  const res = await fetch(`${BASE}/public/refunds/intake`, {
    method: "POST",
    headers: ipHeaders({
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    }),
    body: JSON.stringify({ chain: "Ethereum", ...overrides }),
  });
  assert.equal(res.status, 201, "intake should succeed");
  return jsonOf(res);
}

async function fetchReport(token, reference) {
  const res = await fetch(
    `${BASE}/public/refunds/reports/${encodeURIComponent(reference)}`,
    { headers: ipHeaders({ authorization: `Bearer ${token}` }) },
  );
  assert.equal(res.status, 200, "report fetch should succeed");
  const body = await jsonOf(res);
  return body.report;
}

after(async () => {
  if (createdEmails.length > 0) {
    const { rows } = await pool.query(
      `SELECT id FROM admin_clients WHERE lower(email) = ANY($1::text[])`,
      [createdEmails],
    );
    const clientIds = rows.map((r) => r.id);
    if (clientIds.length > 0) {
      // service_request_id is ON DELETE SET NULL, so deleting the requests first
      // nulls the activity links rather than blocking; then activity and clients
      // (neither cascading from clients) are cleared in dependency order.
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

test("1) a case report shows its own activity + client-level events, not another case's", async () => {
  const { token } = await signupUser();

  // Two distinct cases for the same client. Distinct assets make each case's
  // intake event identifiable by description.
  const caseA = await submitIntake(token, { incident: "phishing", asset: "ETH" });
  const caseB = await submitIntake(token, { incident: "sim_swap", asset: "BTC" });
  assert.notEqual(caseA.reference, caseB.reference, "cases should be distinct");

  const report = await fetchReport(token, caseA.reference);
  assert.equal(report.case.reference, caseA.reference);

  const descriptions = report.activity.map((a) => a.description);
  const hasIntake = (asset) =>
    descriptions.some((d) => d.includes("Recovery case intake") && d.includes(asset));

  // This case's own intake event is present.
  assert.ok(hasIntake("ETH"), "case A report should include case A's intake event");
  // The other case's intake event must NOT leak into this report.
  assert.ok(!hasIntake("BTC"), "case A report must exclude case B's intake event");
  // Client-level events (service_request_id IS NULL) still show: the client was
  // auto-registered on first intake.
  assert.ok(
    report.activity.some((a) => a.eventType === "client_registered"),
    "client-level registration event should still appear",
  );
});

test("2) an untagged case-specific event (service_request_id NULL) is not shown", async () => {
  const { token } = await signupUser();
  const caseA = await submitIntake(token, { incident: "phishing", asset: "SOL" });

  // The intake auto-creates an admin_client keyed by the user's email.
  const { rows } = await pool.query(
    `SELECT id FROM admin_clients WHERE lower(email) = $1`,
    [createdEmails[createdEmails.length - 1]],
  );
  const clientId = rows[0].id;

  // Simulate a pre-migration row: a case-specific event type with no owning case
  // (service_request_id NULL). It cannot be attributed to a case, so it must not
  // surface on any case report — otherwise it would appear on every case.
  const marker = `LEGACY-UNTAGGED-${rnd()}`;
  await pool.query(
    `INSERT INTO admin_activity_log (event_type, client_id, service_request_id, description)
     VALUES ('service_request_submitted', $1, NULL, $2)`,
    [clientId, marker],
  );

  const report = await fetchReport(token, caseA.reference);
  const descriptions = report.activity.map((a) => a.description);
  assert.ok(
    !descriptions.includes(marker),
    "an untagged case-specific event must be excluded from the report",
  );
  // Sanity: this case's own tagged intake event is still present.
  assert.ok(
    descriptions.some((d) => d.includes("Recovery case intake") && d.includes("SOL")),
    "this case's own tagged intake event should still appear",
  );
});
