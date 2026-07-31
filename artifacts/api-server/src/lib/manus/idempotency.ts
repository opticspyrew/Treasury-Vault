// Durable, concurrency-safe idempotency store for the Manus /sync/* write
// endpoints and the webhook receiver (docs/manus-data-sync-requirements.md §4).
//
// runIdempotent(key, rawBody, handler) guarantees the handler runs at most once
// per Idempotency-Key, even under concurrent retries:
//
//   1. Atomically reserve the key with `INSERT ... ON CONFLICT DO NOTHING`.
//      The INSERT is the single serialization point — exactly one caller wins.
//   2. The winner runs the handler, then UPDATEs the row with the response,
//      but only when status < 500 so a transient 5xx is dropped and stays
//      retriable.
//   3. A caller that loses the INSERT inspects the existing row:
//        - different body                  -> 409 conflict
//        - same body, response stored      -> replay the stored response
//        - same body, response still NULL  -> another caller is processing it
//          right now -> 409 "retry" (unless the reservation is clearly
//          abandoned, in which case it is reclaimed and re-run).
//
// The body hash is sha256 of the RAW request bytes, so a re-serialized body
// cannot be mistaken for a different request. Reservations never hold a pooled
// connection across the handler, so concurrent unique keys cannot exhaust the
// pool. Rows older than the retention window are pruned by pruneIdempotencyKeys.

import { pool } from "@workspace/db";
import { sha256Hex } from "./crypto";

export interface StoredResult {
  status: number;
  body: unknown;
}

// A reservation whose response is still NULL after this many seconds is treated
// as abandoned (e.g. the process crashed mid-handler) and may be reclaimed, so a
// single failed attempt cannot wedge a key until the retention sweep. The window
// is far larger than any real handler latency, so it never steals a genuinely
// in-flight reservation.
const ABANDONED_RESERVATION_SECONDS = 120;

const CONFLICT_DIFFERENT_BODY: StoredResult = {
  status: 409,
  body: {
    success: false,
    error: "Idempotency-Key reused with a different request body",
  },
};

const IN_PROGRESS: StoredResult = {
  status: 409,
  body: {
    success: false,
    error: "a request with this Idempotency-Key is already being processed",
  },
};

interface KeyRow {
  request_hash: string;
  response_status: number | null;
  response_body: unknown;
}

export interface RunIdempotentOptions {
  // When true (default), a reused key with a different request body returns 409
  // (the /sync/* contract, §4 rule 3 / §10). When false (webhook receiver), body
  // differences are ignored and the stored response is replayed, so at-least-once
  // redeliveries that mutate per-attempt metadata (e.g. deliveryId) still de-dupe
  // on the stable event id.
  conflictOnBodyMismatch?: boolean;
}

export async function runIdempotent(
  key: string,
  rawBody: string | Buffer,
  handler: () => Promise<StoredResult>,
  opts: RunIdempotentOptions = {},
): Promise<StoredResult> {
  const conflictOnBodyMismatch = opts.conflictOnBodyMismatch ?? true;
  const requestHash = sha256Hex(rawBody);

  // Atomic reservation: the INSERT is the single serialization point, so only
  // one concurrent caller with this key wins and gets to run the handler.
  const reserved = await pool.query(
    `INSERT INTO manus_idempotency_keys (key, request_hash)
     VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING
     RETURNING key`,
    [key, requestHash],
  );

  let owns = (reserved.rowCount ?? 0) > 0;

  if (!owns) {
    const { rows } = await pool.query(
      `SELECT request_hash, response_status, response_body
         FROM manus_idempotency_keys
        WHERE key = $1`,
      [key],
    );
    const row = rows[0] as KeyRow | undefined;
    // Rare race: the row was pruned/released between our INSERT and this read.
    if (!row) return IN_PROGRESS;
    if (conflictOnBodyMismatch && row.request_hash !== requestHash) {
      return CONFLICT_DIFFERENT_BODY;
    }
    if (row.response_status != null) {
      return { status: row.response_status, body: row.response_body };
    }
    // Response still NULL: another caller holds the reservation, OR a previous
    // attempt crashed mid-flight. Reclaim only if it is clearly abandoned. The
    // UPDATE is atomic and row-locked, so concurrent reclaimers can't both win.
    const reclaimed = await pool.query(
      `UPDATE manus_idempotency_keys
          SET created_at = now()
        WHERE key = $1
          AND response_status IS NULL
          AND created_at < now() - ($2::int * interval '1 second')
        RETURNING key`,
      [key, ABANDONED_RESERVATION_SECONDS],
    );
    if ((reclaimed.rowCount ?? 0) === 0) return IN_PROGRESS;
    owns = true;
  }

  // We hold the reservation: run the handler exactly once.
  try {
    const result = await handler();
    if (result.status < 500) {
      await pool.query(
        `UPDATE manus_idempotency_keys
            SET response_status = $2, response_body = $3
          WHERE key = $1`,
        [key, result.status, JSON.stringify(result.body)],
      );
    } else {
      // Transient failure: drop the reservation so a retry can re-process.
      await releaseReservation(key);
    }
    return result;
  } catch (err) {
    // Handler threw: release the reservation so the request can be retried,
    // then surface the error to the caller's error handler.
    await releaseReservation(key);
    throw err;
  }
}

async function releaseReservation(key: string): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM manus_idempotency_keys
        WHERE key = $1 AND response_status IS NULL`,
      [key],
    );
  } catch {
    // Best-effort cleanup; a stale reservation is reclaimed or pruned later.
  }
}

export async function pruneIdempotencyKeys(retentionDays = 7): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM manus_idempotency_keys
      WHERE created_at < now() - ($1::int * interval '1 day')`,
    [retentionDays],
  );
  return rowCount ?? 0;
}
