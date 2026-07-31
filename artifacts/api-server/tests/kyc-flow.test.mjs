// End-to-end tests for the KYC verification gate.
//
// These tests run against a live API server (default http://localhost:8080/api).
// They use random email addresses so they don't collide with existing data and
// don't need an explicit cleanup step. Run with `pnpm --filter @workspace/api-server test`.
//
// Coverage (task #62):
//   1. anonymous send blocked              (401)
//   2. authed-but-unverified send blocked  (403)
//   3. mismatched-email blocked            (403)
//   4. approved user can send              (201)
//   5. rejected user sees reason via /kyc/status
//   6. admin photo endpoint rejects query-string tokens
//   7. admin photo endpoint accepts header tokens
//   8. re-approving an already-decided submission returns 409

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";

const BASE = process.env.API_BASE_URL ?? "http://localhost:8080/api";

// Track everything this suite creates so it can be deleted at the end. Users
// cascade to their kyc_submissions and sessions, but the admin_clients (and
// their service requests + activity-log rows) auto-created by a successful
// /public/request are keyed by email with no cascade from users, so they must
// be removed explicitly. Re-running the suite then leaves no DB residue.
const createdUserIds = [];
const createdEmails = [];
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function rnd() {
  return Math.random().toString(36).slice(2, 10);
}

// The api server runs with `trust proxy: 1`, so the rate limiter keys off the
// X-Forwarded-For IP. Giving each test a fresh fake IP keeps the per-minute
// public + KYC submission limiters from rejecting our test traffic, without
// having to weaken or special-case the production limiter config.
function fakeIp() {
  const oct = () => Math.floor(Math.random() * 254) + 1;
  return `10.${oct()}.${oct()}.${oct()}`;
}

function ipHeaders(extra = {}) {
  return { "x-forwarded-for": fakeIp(), ...extra };
}

async function json(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

async function signupUser() {
  const email = `kycflow-${rnd()}@example.com`;
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      name: "KYC Flow Test",
      email,
      password: "Passw0rd!!",
      scammedVia: "Crypto",
    }),
  });
  assert.equal(res.status, 201, "signup should succeed");
  const body = await json(res);
  createdUserIds.push(body.user.id);
  createdEmails.push(email.toLowerCase());
  return { email, token: body.token, userId: body.user.id };
}

async function adminLogin() {
  const res = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 200, "admin login should succeed");
  const body = await json(res);
  return body.token;
}

async function uploadPhoto(token) {
  const up = await fetch(`${BASE}/public/kyc/upload-url`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  assert.equal(up.status, 200);
  const { uploadURL } = await json(up);
  // Minimal but valid-ish JPEG header so storage doesn't care.
  const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x70, 0x68, 0x6f, 0x74, 0x6f]);
  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: photo,
  });
  assert.equal(put.status, 200, "PUT to presigned URL should succeed");
  return uploadURL;
}

async function submitKyc(token) {
  const uploadURL = await uploadPhoto(token);
  const res = await fetch(`${BASE}/public/kyc/submit`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}`, "content-type": "application/json" }),
    body: JSON.stringify({
      fullName: "Kyc Flow Test",
      dateOfBirth: "1990-01-01",
      address: "1 main",
      city: "NYC",
      country: "US",
      idType: "Passport",
      idNumber: `ID-${rnd()}`,
      photoUploadURL: uploadURL,
      photoMimeType: "image/jpeg",
    }),
  });
  assert.equal(res.status, 201, "kyc submit should succeed");
  const body = await json(res);
  return body.submissionId;
}

let adminToken;

before(async () => {
  assert.ok(ADMIN_USERNAME && ADMIN_PASSWORD, "ADMIN_USERNAME/ADMIN_PASSWORD must be set");
  // Smoke-check the server is up before running any tests.
  const probe = await fetch(`${BASE}/public/kyc/status`).catch(() => null);
  assert.ok(probe, `API server not reachable at ${BASE}`);
  adminToken = await adminLogin();
});

// Remove all data this suite created. admin_service_requests and
// admin_activity_log reference admin_clients without ON DELETE CASCADE, so they
// must be deleted before the clients. Users are deleted last and cascade to
// their kyc_submissions and sessions.
after(async () => {
  if (createdEmails.length > 0) {
    const { rows } = await pool.query(
      `SELECT id FROM admin_clients WHERE email = ANY($1::text[])`,
      [createdEmails],
    );
    const clientIds = rows.map((r) => r.id);
    if (clientIds.length > 0) {
      await pool.query(`DELETE FROM admin_activity_log WHERE client_id = ANY($1::int[])`, [clientIds]);
      await pool.query(`DELETE FROM admin_service_requests WHERE client_id = ANY($1::int[])`, [clientIds]);
      await pool.query(`DELETE FROM admin_clients WHERE id = ANY($1::int[])`, [clientIds]);
    }
  }
  if (createdUserIds.length > 0) {
    await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }
});

test("1) anonymous send is blocked (401)", async () => {
  const res = await fetch(`${BASE}/public/request`, {
    method: "POST",
    headers: ipHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ name: "x", email: "x@x.com", type: "send", amount: "10", currency: "USD" }),
  });
  assert.equal(res.status, 401);
});

test("2) authed but unverified send is blocked (403)", async () => {
  const { email, token } = await signupUser();
  const res = await fetch(`${BASE}/public/request`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}`, "content-type": "application/json" }),
    body: JSON.stringify({ name: "KYC Flow Test", email, type: "send", amount: "10", currency: "USD" }),
  });
  assert.equal(res.status, 403);
  const body = await json(res);
  assert.equal(body.kycStatus, "none");
});

test("3) mismatched email is blocked even for an approved user", async () => {
  // Force the request through the email-mismatch check by first getting the
  // user past the KYC gate. Otherwise the unverified-KYC guard would short-
  // circuit and this test would never exercise the mismatch enforcement.
  const { token } = await signupUser();
  const submissionId = await submitKyc(token);
  const approve = await fetch(`${BASE}/admin/kyc/${submissionId}/approve`, {
    method: "POST",
    headers: ipHeaders({ "x-admin-token": adminToken, "content-type": "application/json" }),
    body: JSON.stringify({}),
  });
  assert.equal(approve.status, 200);

  const res = await fetch(`${BASE}/public/request`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}`, "content-type": "application/json" }),
    body: JSON.stringify({
      name: "Someone Else",
      email: `other-${rnd()}@example.com`,
      type: "send",
      amount: "10",
      currency: "USD",
    }),
  });
  assert.equal(res.status, 403, "mismatched email must be rejected with 403");
  const body = await json(res);
  // Server-side message is "...does not match...". Assert a stable substring
  // so the test fails loudly if the mismatch branch is removed.
  assert.match(String(body?.error ?? ""), /match/i);
});

test("4) approved user can send (201)", async () => {
  const { email, token } = await signupUser();
  const submissionId = await submitKyc(token);
  const approve = await fetch(`${BASE}/admin/kyc/${submissionId}/approve`, {
    method: "POST",
    headers: ipHeaders({ "x-admin-token": adminToken, "content-type": "application/json" }),
    body: JSON.stringify({}),
  });
  assert.equal(approve.status, 200);

  const send = await fetch(`${BASE}/public/request`, {
    method: "POST",
    headers: ipHeaders({ authorization: `Bearer ${token}`, "content-type": "application/json" }),
    body: JSON.stringify({ name: "KYC Flow Test", email, type: "send", amount: "10", currency: "USD" }),
  });
  assert.equal(send.status, 201);
});

test("5) rejected user sees the reason on /kyc/status", async () => {
  const { token } = await signupUser();
  const submissionId = await submitKyc(token);
  const reason = "Photo is blurry — please retake.";
  const rej = await fetch(`${BASE}/admin/kyc/${submissionId}/reject`, {
    method: "POST",
    headers: ipHeaders({ "x-admin-token": adminToken, "content-type": "application/json" }),
    body: JSON.stringify({ notes: reason }),
  });
  assert.equal(rej.status, 200);

  const status = await fetch(`${BASE}/public/kyc/status`, {
    headers: ipHeaders({ authorization: `Bearer ${token}` }),
  });
  const body = await json(status);
  assert.equal(body.status, "rejected");
  assert.equal(body.submission.reviewerNotes, reason);
});

test("5b) reject without a reason is rejected (400)", async () => {
  const { token } = await signupUser();
  const submissionId = await submitKyc(token);
  const rej = await fetch(`${BASE}/admin/kyc/${submissionId}/reject`, {
    method: "POST",
    headers: ipHeaders({ "x-admin-token": adminToken, "content-type": "application/json" }),
    body: JSON.stringify({ notes: "   " }),
  });
  assert.equal(rej.status, 400);
});

test("6) admin photo endpoint rejects query-string tokens", async () => {
  const { token } = await signupUser();
  const submissionId = await submitKyc(token);
  const res = await fetch(`${BASE}/admin/kyc/${submissionId}/photo?token=${encodeURIComponent(adminToken)}`);
  // Without a header, the admin guard must reject (401). The query token must
  // never be accepted as a fallback — that loophole was closed in task #59.
  assert.equal(res.status, 401);
});

test("7) admin photo endpoint accepts header tokens", async () => {
  const { token } = await signupUser();
  const submissionId = await submitKyc(token);
  const res = await fetch(`${BASE}/admin/kyc/${submissionId}/photo`, {
    headers: ipHeaders({ "x-admin-token": adminToken }),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^image\//);
  const buf = new Uint8Array(await res.arrayBuffer());
  assert.ok(buf.byteLength > 0, "photo body should be non-empty");
});

test("8) re-approving an already-decided submission returns 409", async () => {
  const { token } = await signupUser();
  const submissionId = await submitKyc(token);
  const first = await fetch(`${BASE}/admin/kyc/${submissionId}/approve`, {
    method: "POST",
    headers: ipHeaders({ "x-admin-token": adminToken, "content-type": "application/json" }),
    body: JSON.stringify({}),
  });
  assert.equal(first.status, 200);
  const again = await fetch(`${BASE}/admin/kyc/${submissionId}/approve`, {
    method: "POST",
    headers: ipHeaders({ "x-admin-token": adminToken, "content-type": "application/json" }),
    body: JSON.stringify({}),
  });
  assert.equal(again.status, 409);
});
