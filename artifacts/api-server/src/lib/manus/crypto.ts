// HMAC signing / verification helpers for the Manus / Netspy-World integration.
//
// Two distinct signature schemes are used:
//   * Outbound (us -> Netspy): X-API-Signature = HMAC-SHA256(rawBody, api_secret)
//     (PDF §3) — hex digest of the request body.
//   * Inbound webhook (Netspy -> us): X-Webhook-Signature = "sha256=" +
//     HMAC-SHA256(`${timestamp}.${rawBody}`, webhook_secret) (PDF §4.1), with a
//     replay window: reject if |now - timestamp| > 300s.
//   * Inbound /sync/* (optional): X-Manus-Signature = "sha256=" +
//     HMAC-SHA256(rawBody, signing_secret) over the raw body.
//
// All comparisons are constant-time. Verification is performed on the RAW body
// bytes captured before JSON parsing (see app.ts express.json verify hook), so a
// re-serialized body can never change the signature outcome.

import crypto from "node:crypto";

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function sha256Hex(payload: string | Buffer): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/** Outbound request body signature (hex digest), for the X-API-Signature header. */
export function signOutboundPayload(secret: string, rawBody: string | Buffer): string {
  return hmacSha256Hex(secret, rawBody);
}

/** Constant-time string compare that never throws on length mismatch. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface VerifyResult {
  ok: boolean;
  /** Secret-free reason on failure, for logging/diagnostics. */
  reason?: string;
}

export interface VerifyWebhookOptions {
  rawBody: string;
  signatureHeader: string | undefined; // "sha256=<hex>"
  timestampHeader: string | undefined; // unix seconds, as a string
  secret: string;
  /** Defaults to now; injectable for tests. */
  nowSeconds?: number;
  /** Defaults to 300s. */
  replayWindowSeconds?: number;
}

/**
 * Verify a Netspy webhook delivery (PDF §4.1): replay window first, then a
 * constant-time signature check over `${timestamp}.${rawBody}`.
 */
export function verifyWebhookSignature(opts: VerifyWebhookOptions): VerifyResult {
  const { rawBody, signatureHeader, timestampHeader, secret } = opts;
  if (!signatureHeader || !timestampHeader) {
    return { ok: false, reason: "missing signature or timestamp" };
  }
  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "invalid timestamp" };
  }
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const window = opts.replayWindowSeconds ?? 300;
  if (Math.abs(now - ts) > window) {
    return { ok: false, reason: "stale timestamp" };
  }
  const signedContent = `${timestampHeader}.${rawBody}`;
  const expected = `sha256=${hmacSha256Hex(secret, signedContent)}`;
  if (!timingSafeEqualStr(signatureHeader, expected)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

export interface VerifyNetspyPlainSignatureOptions {
  rawBody: string;
  /** Bare lowercase hex digest, optionally "sha256="-prefixed. */
  signatureHeader: string | undefined;
  secret: string;
}

/**
 * Compatibility scheme for the Netspy staging sender (X-Netspy-Signature):
 * plain HMAC-SHA256 over the raw body only — no timestamp, so no replay
 * window. Callers must rely on event-id de-duplication for replay safety.
 */
export function verifyNetspyPlainSignature(opts: VerifyNetspyPlainSignatureOptions): VerifyResult {
  const { rawBody, signatureHeader, secret } = opts;
  if (!signatureHeader) {
    return { ok: false, reason: "missing signature" };
  }
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const expected = hmacSha256Hex(secret, rawBody);
  if (!timingSafeEqualStr(provided.toLowerCase(), expected)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

export interface VerifyBodySignatureOptions {
  rawBody: string | Buffer;
  signatureHeader: string | undefined; // "sha256=<hex>"
  secret: string;
}

/** Verify the optional X-Manus-Signature over the raw body for /sync/* calls. */
export function verifyBodySignature(opts: VerifyBodySignatureOptions): boolean {
  const { rawBody, signatureHeader, secret } = opts;
  if (!signatureHeader) return false;
  const expected = `sha256=${hmacSha256Hex(secret, rawBody)}`;
  return timingSafeEqualStr(signatureHeader, expected);
}
