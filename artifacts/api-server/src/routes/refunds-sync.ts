// Inbound Manus / Netspy-World sync surfaces, mounted under /api/public/refunds.
//
//   POST /sync/clients   — upsert client(s)   (single object or array batch)
//   POST /sync/cases     — upsert case(s)      (single object or array batch)
//   POST /sync/activity  — append activity event(s) (single or array batch)
//   POST /webhooks/netspy-events — Netspy webhook receiver (HMAC + replay)
//
// Gating (docs/manus-data-sync-requirements.md §10): a surface that is disabled
// or missing credentials returns 503 BEFORE any auth/signature check, so a probe
// can tell "not enabled yet" apart from "enabled but unauthorized" (401). The
// whole integration is off by default; see the enablement notes in the summary.
//
// /sync/* auth: Authorization: Bearer <MANUS_SYNC_TOKEN>, plus an optional HMAC
// body signature (X-Manus-Signature) when MANUS_SIGNING_SECRET is set. Writes
// honor an Idempotency-Key header (replay returns the stored response; reuse with
// a different body -> 409). The webhook receiver verifies X-Webhook-Signature
// over `${X-Webhook-Timestamp}.${rawBody}` within a 300s replay window (PDF §4).

import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { logger } from "../lib/logger";
import {
  inboundSyncReadiness,
  inboundSyncToken,
  inboundSigningSecret,
  webhookReadiness,
  webhookSecret,
  MANUS_BATCH_CAP,
  WEBHOOK_REPLAY_WINDOW_SECONDS,
} from "../lib/manus/config";
import {
  verifyBodySignature,
  verifyWebhookSignature,
  verifyNetspyPlainSignature,
  timingSafeEqualStr,
  sha256Hex,
} from "../lib/manus/crypto";
import { runIdempotent } from "../lib/manus/idempotency";
import {
  upsertClient,
  upsertCase,
  appendActivity,
  processWebhookEvent,
  type SyncResult,
} from "../lib/manus/sync-service";

const router: IRouter = Router();

// Machine-to-machine traffic: a higher ceiling than the human intake limiter,
// still keyed by source IP so a misbehaving caller can't exhaust the server.
const syncLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, "Manus sync rate limit exceeded");
    res.status(429).json({ success: false, error: "Too many requests" });
  },
});

interface HttpResult {
  status: number;
  body: unknown;
}

// Translate a service SyncResult to an HTTP result. A successful create returns
// 201, an update 200; failures carry the service-chosen status (404/413/422).
function toResponse<T extends { created?: boolean }>(r: SyncResult<T>): HttpResult {
  if (!r.ok) return { status: r.status, body: { success: false, error: r.error } };
  const created = r.data.created === true;
  return { status: created ? 201 : 200, body: { success: true, ...r.data } };
}

// Per-item results for a batch request; the call never 5xxs on a bad element.
function batchResponse(results: SyncResult<unknown>[]): HttpResult {
  const items = results.map((r) =>
    r.ok
      ? { ok: true, ...(r.data as object) }
      : { ok: false, status: r.status, error: r.error },
  );
  const failed = items.filter((i) => i.ok === false).length;
  return {
    status: 200,
    body: { success: failed === 0, count: results.length, failed, results: items },
  };
}

function rawBodyOf(req: Request): Buffer {
  return req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
}

// Readiness (503) + bearer token (+ optional body signature) check. Returns true
// when the caller may proceed; otherwise it has already written the response.
function authorizeSync(req: Request, res: Response): boolean {
  const readiness = inboundSyncReadiness();
  if (!readiness.ready) {
    res.status(503).json({ success: false, error: "Manus sync not enabled", reason: readiness.reason });
    return false;
  }
  const token = inboundSyncToken();
  const header = req.headers.authorization;
  const provided =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : "";
  if (!token || !provided || !timingSafeEqualStr(provided, token)) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return false;
  }
  const signingSecret = inboundSigningSecret();
  if (signingSecret) {
    const ok = verifyBodySignature({
      rawBody: rawBodyOf(req),
      signatureHeader: req.header("x-manus-signature"),
      secret: signingSecret,
    });
    if (!ok) {
      res.status(401).json({ success: false, error: "Invalid signature" });
      return false;
    }
  }
  return true;
}

// Wrap a write in the Idempotency-Key protocol when the header is present.
async function withIdempotency(
  req: Request,
  res: Response,
  handler: () => Promise<HttpResult>,
): Promise<void> {
  // §4 rule 3: every /sync/* write must carry an Idempotency-Key. A missing one
  // is a missing required field (§10 -> 400) and is rejected BEFORE any side
  // effect, so an un-keyed retry can never re-run the write.
  const key = req.header("idempotency-key")?.trim();
  if (!key) {
    res.status(400).json({ success: false, error: "Idempotency-Key header is required" });
    return;
  }
  const raw = rawBodyOf(req);
  // runIdempotent atomically reserves the key and memoizes deterministic (<500)
  // results, so concurrent retries can never double-execute the write.
  const result = await runIdempotent(key, raw, () => handler());
  res.status(result.status).json(result.body);
}

// Compose readiness/auth + idempotency + error handling around a write handler.
function syncRoute(handler: (req: Request) => Promise<HttpResult>) {
  return async (req: Request, res: Response): Promise<void> => {
    if (!authorizeSync(req, res)) return;
    try {
      await withIdempotency(req, res, () => handler(req));
    } catch (err) {
      logger.error({ err }, "Manus sync handler failed");
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Internal error" });
      }
    }
  };
}

function tooManyItems(): HttpResult {
  return {
    status: 413,
    body: { success: false, error: `batch exceeds ${MANUS_BATCH_CAP} items` },
  };
}

router.post(
  "/sync/clients",
  syncLimiter,
  syncRoute(async (req) => {
    const body = req.body;
    if (Array.isArray(body)) {
      if (body.length > MANUS_BATCH_CAP) return tooManyItems();
      const results: SyncResult<unknown>[] = [];
      for (const item of body) results.push(await upsertClient(item ?? {}));
      return batchResponse(results);
    }
    return toResponse(await upsertClient(body ?? {}));
  }),
);

router.post(
  "/sync/cases",
  syncLimiter,
  syncRoute(async (req) => {
    const body = req.body;
    if (Array.isArray(body)) {
      if (body.length > MANUS_BATCH_CAP) return tooManyItems();
      const results: SyncResult<unknown>[] = [];
      for (const item of body) results.push(await upsertCase(item ?? {}));
      return batchResponse(results);
    }
    return toResponse(await upsertCase(body ?? {}));
  }),
);

router.post(
  "/sync/activity",
  syncLimiter,
  syncRoute(async (req) => {
    const body = req.body;
    const events = Array.isArray(body) ? body : [body ?? {}];
    if (events.length > MANUS_BATCH_CAP) return tooManyItems();
    const result = await appendActivity(events);
    if (!result.ok) return { status: result.status, body: { success: false, error: result.error } };
    return { status: 200, body: { success: true, ...result.data } };
  }),
);

// ---------------------------------------------------------------------------
// Netspy webhook receiver (PDF §4). Signature + replay verified over the raw
// body; blockchain/vault events are recorded as case activity but not acted on.
// ---------------------------------------------------------------------------

router.post(
  "/webhooks/netspy-events",
  syncLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const readiness = webhookReadiness();
    if (!readiness.ready) {
      res
        .status(503)
        .json({ success: false, error: "webhook receiver not enabled", reason: readiness.reason });
      return;
    }
    const secret = webhookSecret();
    if (!secret) {
      res.status(503).json({ success: false, error: "webhook receiver not enabled" });
      return;
    }
    const raw = req.rawBody
      ? req.rawBody.toString("utf8")
      : JSON.stringify(req.body ?? {});
    // Primary scheme (PDF §4.1): X-Webhook-Signature over `${timestamp}.${body}`
    // with a replay window. Compatibility fallback for the actual Netspy staging
    // sender: X-Netspy-Signature = plain HMAC-SHA256 over the raw body (no
    // timestamp; replay safety comes from the event-id de-dupe below).
    let verify = verifyWebhookSignature({
      rawBody: raw,
      signatureHeader: req.header("x-webhook-signature"),
      timestampHeader: req.header("x-webhook-timestamp"),
      secret,
      replayWindowSeconds: WEBHOOK_REPLAY_WINDOW_SECONDS,
    });
    let verifiedViaFallback = false;
    if (!verify.ok) {
      const netspySig = req.header("x-netspy-signature");
      if (netspySig) {
        verify = verifyNetspyPlainSignature({
          rawBody: raw,
          signatureHeader: netspySig,
          secret,
        });
        if (verify.ok) {
          verifiedViaFallback = true;
          logger.info("Netspy webhook accepted via X-Netspy-Signature compatibility scheme");
        }
      }
    }
    if (!verify.ok) {
      logger.warn({ reason: verify.reason }, "Netspy webhook signature rejected");
      res.status(401).json({ success: false, error: "invalid signature" });
      return;
    }
    try {
      // The fallback scheme signs only the raw body, so the X-Webhook-Delivery-Id
      // header is UNSIGNED under it. Only signed material may key replay
      // protection: ignore the header entirely for fallback-verified deliveries
      // (both for the envelope's deliveryId and the de-dupe key below), falling
      // back to sha256(raw) when the body carries no id/deliveryId of its own.
      const deliveryId = verifiedViaFallback
        ? undefined
        : req.header("x-webhook-delivery-id");
      const body = (req.body ?? {}) as Record<string, unknown>;
      const envelope = {
        ...body,
        deliveryId:
          (typeof body.deliveryId === "string" ? body.deliveryId : undefined) ?? deliveryId,
      };
      // De-dupe at-least-once webhook redeliveries BEFORE any upsert runs, so a
      // repeated delivery never re-applies side effects; the stored response is
      // replayed instead. Key on the STABLE event id first (matching
      // mapWebhookEvent's manusEventId = env.id ?? env.deliveryId), so a retry
      // that carries a fresh per-attempt X-Webhook-Delivery-Id still de-dupes.
      const bodyId = typeof body.id === "string" ? body.id : undefined;
      const bodyDeliveryId =
        typeof body.deliveryId === "string" ? body.deliveryId : undefined;
      const dedupeId = bodyId ?? bodyDeliveryId ?? deliveryId ?? sha256Hex(raw);
      const result = await runIdempotent(`webhook:${dedupeId}`, raw, async () => {
        const r = await processWebhookEvent(envelope);
        if (!r.ok) {
          // Bad data: acknowledge with the error but do not 5xx, so Netspy does
          // not retry an event that can never succeed.
          return { status: r.status, body: { success: false, processed: false, error: r.error } };
        }
        return {
          status: 200,
          body: {
            success: true,
            processed: true,
            action: r.data.action,
            ...(r.data.refundsCaseId ? { refundsCaseId: r.data.refundsCaseId } : {}),
          },
        };
      }, { conflictOnBodyMismatch: false });
      res.status(result.status).json(result.body);
    } catch (err) {
      logger.error({ err }, "Netspy webhook processing failed");
      res.status(500).json({ success: false, processed: false, error: "processing failed" });
    }
  },
);

export default router;
