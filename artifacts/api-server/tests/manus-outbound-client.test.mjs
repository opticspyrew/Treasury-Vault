// Mocked-fetch tests for the Netspy outbound client wire format.
//
// The partner's live server is a tRPC server with a superjson-style
// transformer: query inputs travel as `?input={"json":<input>}`, mutation
// bodies as `{"json":<input>}`, and success payloads arrive wrapped as
// {"result":{"data":{"json":<output>}}}. These tests pin the exact
// serialization so a refactor cannot silently regress case sync against the
// partner's production API.
//
// Pure unit tests: fetch is replaced with a recorder; no DB, no live server.
//
// Run with:
//   pnpm --filter @workspace/api-server exec node --import tsx \
//     --experimental-test-module-mocks --test tests/manus-outbound-client.test.mjs

import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const API_KEY = "nspy_key_test_123";
const API_SECRET = "nspy_secret_test_456";
const BASE_URL = "https://netspy.example.com/api/trpc";

// Config reads env live on every call; set before importing the client.
process.env.MANUS_OUTBOUND_SYNC_ENABLED = "1";
process.env.NETSPY_API_KEY = API_KEY;
process.env.NETSPY_API_SECRET = API_SECRET;
process.env.NETSPY_API_BASE_URL = BASE_URL;

const {
  health,
  createUnifiedCase,
  getUnifiedCase,
  syncCaseStatus,
  wrapTrpcInput,
  unwrapTrpcResult,
  healthUrl,
} = await import("../src/lib/manus/client.ts");

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

/** Recorded calls: [{ url, method, headers, body }] */
let calls = [];

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Install a fetch mock that records each call and returns queued responses. */
function mockFetch(...responses) {
  calls = [];
  const queue = [...responses];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method,
      headers: init.headers ?? {},
      body: init.body,
    });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return typeof next === "function" ? next() : next;
  };
}

function hmac(payload) {
  return crypto.createHmac("sha256", API_SECRET).update(payload).digest("hex");
}

const TRPC_OK = (output) => jsonResponse(200, { result: { data: { json: output } } });

beforeEach(() => {
  process.env.MANUS_OUTBOUND_SYNC_ENABLED = "1";
  process.env.NETSPY_API_KEY = API_KEY;
  process.env.NETSPY_API_SECRET = API_SECRET;
  process.env.NETSPY_API_BASE_URL = BASE_URL;
});

// --- Mutations: exact body serialization -----------------------------------

test("cases.createUnified POSTs body {json:<input>} to <base>/cases.createUnified", async () => {
  const output = { unifiedCaseId: 42, status: "pending" };
  mockFetch(TRPC_OK(output));
  const input = {
    clientEmail: "victim@example.com",
    clientName: "Vic Tim",
    caseType: "crypto_scam",
    estimatedLoss: 12500.5,
    blockchainData: { walletAddresses: ["0xabc"], chains: ["ethereum"] },
  };
  const res = await createUnifiedCase(input);

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.url, `${BASE_URL}/cases.createUnified`);
  assert.equal(call.method, "POST");
  // Exact wire body: superjson wrapper around the untouched input.
  assert.equal(call.body, JSON.stringify({ json: input }));
  assert.equal(call.headers["Content-Type"], "application/json");
  assert.deepEqual(res, { ok: true, status: 200, data: output });
});

test("cases.syncStatus POSTs body {json:<input>} to <base>/cases.syncStatus", async () => {
  mockFetch(TRPC_OK({ ok: true }));
  const input = {
    unifiedCaseId: 7,
    investigationStatus: "in_progress",
    recoveryStatus: "pending",
    blockchainData: { txHashes: ["0xdead"] },
  };
  const res = await syncCaseStatus(input);

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.url, `${BASE_URL}/cases.syncStatus`);
  assert.equal(call.method, "POST");
  assert.equal(call.body, JSON.stringify({ json: input }));
  assert.deepEqual(res, { ok: true, status: 200, data: { ok: true } });
});

// --- Queries: exact query-string serialization ------------------------------

test("cases.getUnified GETs with ?input={\"json\":{...}} and no body", async () => {
  mockFetch(TRPC_OK({ unifiedCaseId: 42 }));
  const res = await getUnifiedCase(42);

  assert.equal(calls.length, 1);
  const call = calls[0];
  const expectedQs = new URLSearchParams({
    input: JSON.stringify({ json: { unifiedCaseId: 42 } }),
  }).toString();
  assert.equal(call.url, `${BASE_URL}/cases.getUnified?${expectedQs}`);
  assert.equal(call.method, "GET");
  assert.equal(call.body, undefined);
  // GETs carry auth headers but never a signature or content type.
  assert.equal(call.headers["X-API-Signature"], undefined);
  assert.equal(call.headers["Content-Type"], undefined);
  assert.deepEqual(res, { ok: true, status: 200, data: { unifiedCaseId: 42 } });
});

test("cases.getUnified coerces a numeric-string id to a number in the wire input", async () => {
  mockFetch(TRPC_OK({}));
  await getUnifiedCase("42");
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("input"), JSON.stringify({ json: { unifiedCaseId: 42 } }));
});

test("cases.getUnified rejects non-finite ids locally without calling fetch", async () => {
  mockFetch(TRPC_OK({}));
  // Note: "" is NOT here — Number("") is 0, which is finite and passes through.
  for (const bad of ["abc", NaN, Infinity, "12abc"]) {
    const res = await getUnifiedCase(bad);
    assert.equal(res.ok, false);
    assert.equal(res.status, 0);
    assert.match(res.error, /invalid unifiedCaseId/);
  }
  assert.equal(calls.length, 0);
});

// --- Signature: HMAC over the exact transmitted wrapped body -----------------

test("X-API-Signature is HMAC-SHA256(api_secret, exact transmitted wrapped body)", async () => {
  mockFetch(TRPC_OK({}));
  const input = { clientEmail: "a@b.co", clientName: "A B" };
  await createUnifiedCase(input);

  const call = calls[0];
  const wrappedBody = JSON.stringify({ json: input });
  assert.equal(call.body, wrappedBody);
  // Signature covers the WRAPPED body actually sent, not the bare input.
  assert.equal(call.headers["X-API-Signature"], hmac(wrappedBody));
  assert.notEqual(call.headers["X-API-Signature"], hmac(JSON.stringify(input)));
  // Auth headers accompany every request.
  assert.equal(call.headers.Authorization, `Bearer ${API_KEY}`);
  assert.equal(call.headers["X-API-Key"], API_KEY);
});

// --- Response unwrapping and errors -----------------------------------------

test("tRPC success envelope {result:{data:{json:X}}} unwraps to X", async () => {
  const output = { unifiedCaseId: 9, nested: { deep: [1, 2] } };
  mockFetch(TRPC_OK(output));
  const res = await getUnifiedCase(9);
  assert.deepEqual(res.data, output);

  // Pure helpers behave the same, including non-superjson fallbacks.
  assert.deepEqual(unwrapTrpcResult({ result: { data: { json: output } } }), output);
  assert.deepEqual(unwrapTrpcResult({ result: { data: { plain: 1 } } }), { plain: 1 });
  assert.deepEqual(unwrapTrpcResult({ other: true }), { other: true });
  assert.equal(wrapTrpcInput({ a: 1 }), '{"json":{"a":1}}');
});

test("tRPC error envelope message is extracted on 4xx", async () => {
  mockFetch(
    jsonResponse(400, {
      error: { json: { message: "invalid_type: expected number", code: -32600 } },
    }),
  );
  const res = await getUnifiedCase(1);
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
  assert.equal(res.error, "invalid_type: expected number");
  // Deterministic 4xx must not be retried.
  assert.equal(calls.length, 1);
});

test("non-tRPC error bodies fall back to HTTP <status>", async () => {
  mockFetch(new Response("not json at all", { status: 404 }));
  const res = await getUnifiedCase(1);
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
  assert.equal(res.error, "HTTP 404");
});

// --- REST health passthrough -------------------------------------------------

test("health GETs <origin>/api/health and passes the REST body through untouched", async () => {
  const body = { status: "ok", uptime: 123 };
  mockFetch(jsonResponse(200, body));
  const res = await health();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://netspy.example.com/api/health");
  assert.equal(calls[0].method, "GET");
  // No tRPC envelope on the REST route: body is returned as-is.
  assert.deepEqual(res, { ok: true, status: 200, data: body });

  assert.equal(healthUrl(BASE_URL), "https://netspy.example.com/api/health");
  assert.equal(healthUrl("not a url/api/trpc"), "not a url/api/health");
});

// --- Gating -------------------------------------------------------------------

test("client short-circuits without fetch when outbound is disabled", async () => {
  mockFetch(TRPC_OK({}));
  delete process.env.MANUS_OUTBOUND_SYNC_ENABLED;
  const res = await syncCaseStatus({
    unifiedCaseId: 1,
    investigationStatus: "x",
    recoveryStatus: "y",
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 0);
  assert.match(res.error, /not enabled/);
  assert.equal(calls.length, 0);
});
