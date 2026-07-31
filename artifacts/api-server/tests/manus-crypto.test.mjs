// Unit tests for the Manus / Netspy HMAC signing & verification helpers.
//
// These are pure-function tests (no DB, no live server). They run via tsx, which
// lets the .mjs test import the TypeScript source directly.
//
// Run with:
//   pnpm --filter @workspace/api-server exec node --import tsx \
//     --experimental-test-module-mocks --test tests/manus-crypto.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  hmacSha256Hex,
  sha256Hex,
  signOutboundPayload,
  timingSafeEqualStr,
  verifyWebhookSignature,
  verifyBodySignature,
  verifyNetspyPlainSignature,
} from "../src/lib/manus/crypto.ts";

const SECRET = "whk_secret_test_abc123";

function webhookSig(secret, timestamp, rawBody) {
  const h = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `sha256=${h}`;
}

test("hmacSha256Hex / sha256Hex are deterministic", () => {
  assert.equal(hmacSha256Hex(SECRET, "hello"), hmacSha256Hex(SECRET, "hello"));
  assert.equal(sha256Hex("hello"), sha256Hex("hello"));
  assert.notEqual(hmacSha256Hex(SECRET, "hello"), hmacSha256Hex(SECRET, "world"));
});

test("signOutboundPayload matches a hand-computed HMAC", () => {
  const body = JSON.stringify({ clientEmail: "a@example.com" });
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(signOutboundPayload(SECRET, body), expected);
});

test("timingSafeEqualStr handles equal, unequal, and length-mismatch", () => {
  assert.equal(timingSafeEqualStr("abc", "abc"), true);
  assert.equal(timingSafeEqualStr("abc", "abd"), false);
  assert.equal(timingSafeEqualStr("abc", "abcd"), false);
});

test("verifyWebhookSignature accepts a valid, fresh delivery", () => {
  const now = 1_750_000_000;
  const body = JSON.stringify({ event: "case.created", data: { unifiedCaseId: 1 } });
  const sig = webhookSig(SECRET, String(now), body);
  const r = verifyWebhookSignature({
    rawBody: body,
    signatureHeader: sig,
    timestampHeader: String(now),
    secret: SECRET,
    nowSeconds: now,
  });
  assert.equal(r.ok, true);
});

test("verifyWebhookSignature rejects a tampered body", () => {
  const now = 1_750_000_000;
  const body = JSON.stringify({ event: "case.created", data: { unifiedCaseId: 1 } });
  const sig = webhookSig(SECRET, String(now), body);
  const r = verifyWebhookSignature({
    rawBody: body.replace("1", "2"),
    signatureHeader: sig,
    timestampHeader: String(now),
    secret: SECRET,
    nowSeconds: now,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "signature mismatch");
});

test("verifyWebhookSignature rejects a stale timestamp (replay)", () => {
  const signedTs = 1_750_000_000;
  const now = signedTs + 301; // just outside the 300s window
  const body = JSON.stringify({ event: "case.created" });
  const sig = webhookSig(SECRET, String(signedTs), body);
  const r = verifyWebhookSignature({
    rawBody: body,
    signatureHeader: sig,
    timestampHeader: String(signedTs),
    secret: SECRET,
    nowSeconds: now,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "stale timestamp");
});

test("verifyWebhookSignature rejects missing headers and bad timestamps", () => {
  const body = "{}";
  assert.equal(
    verifyWebhookSignature({
      rawBody: body,
      signatureHeader: undefined,
      timestampHeader: "1750000000",
      secret: SECRET,
    }).ok,
    false,
  );
  assert.equal(
    verifyWebhookSignature({
      rawBody: body,
      signatureHeader: "sha256=deadbeef",
      timestampHeader: "not-a-number",
      secret: SECRET,
    }).reason,
    "invalid timestamp",
  );
});

test("verifyWebhookSignature rejects a wrong secret", () => {
  const now = 1_750_000_000;
  const body = JSON.stringify({ event: "vault.funded" });
  const sig = webhookSig("the-wrong-secret", String(now), body);
  const r = verifyWebhookSignature({
    rawBody: body,
    signatureHeader: sig,
    timestampHeader: String(now),
    secret: SECRET,
    nowSeconds: now,
  });
  assert.equal(r.ok, false);
});

test("verifyBodySignature verifies the optional X-Manus-Signature", () => {
  const body = JSON.stringify({ manusClientId: "mc_1", email: "a@example.com" });
  const good = `sha256=${crypto.createHmac("sha256", SECRET).update(body).digest("hex")}`;
  assert.equal(verifyBodySignature({ rawBody: body, signatureHeader: good, secret: SECRET }), true);
  assert.equal(
    verifyBodySignature({ rawBody: body, signatureHeader: "sha256=deadbeef", secret: SECRET }),
    false,
  );
  assert.equal(
    verifyBodySignature({ rawBody: body, signatureHeader: undefined, secret: SECRET }),
    false,
  );
});

test("verifyNetspyPlainSignature accepts a bare lowercase hex HMAC over the raw body", () => {
  const body = JSON.stringify({ id: "evt_1", type: "case_created" });
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(
    verifyNetspyPlainSignature({ rawBody: body, signatureHeader: sig, secret: SECRET }).ok,
    true,
  );
});

test("verifyNetspyPlainSignature tolerates a sha256= prefix and uppercase hex", () => {
  const body = JSON.stringify({ id: "evt_2", type: "case_updated" });
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(
    verifyNetspyPlainSignature({ rawBody: body, signatureHeader: `sha256=${sig}`, secret: SECRET })
      .ok,
    true,
  );
  assert.equal(
    verifyNetspyPlainSignature({
      rawBody: body,
      signatureHeader: sig.toUpperCase(),
      secret: SECRET,
    }).ok,
    true,
  );
});

test("verifyNetspyPlainSignature rejects wrong secret, tampered body, and missing header", () => {
  const body = JSON.stringify({ id: "evt_3", type: "case_created" });
  const wrong = crypto.createHmac("sha256", "not-the-secret").update(body).digest("hex");
  assert.equal(
    verifyNetspyPlainSignature({ rawBody: body, signatureHeader: wrong, secret: SECRET }).ok,
    false,
  );
  const good = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(
    verifyNetspyPlainSignature({
      rawBody: body + " ",
      signatureHeader: good,
      secret: SECRET,
    }).ok,
    false,
  );
  assert.equal(
    verifyNetspyPlainSignature({ rawBody: body, signatureHeader: undefined, secret: SECRET }).ok,
    false,
  );
});
