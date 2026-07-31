// Configuration & feature gates for the Manus / Netspy-World data-sync layer.
//
// The whole integration is DISABLED by default. Each direction has an explicit
// enable flag AND requires its credentials to be present before it is considered
// "ready". A surface that is not ready returns HTTP 503 (per the error contract
// in docs/manus-data-sync-requirements.md §10) before any auth/signature check,
// and the outbound path records a local "pending" marker instead of calling out.
//
// No secrets are ever logged or returned to callers; this module only reports
// readiness (a boolean + a human-readable reason), never the secret values.

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function flag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v ? TRUTHY.has(v) : false;
}

function secret(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

// The closed status vocabulary both systems must agree on (§3). Any other value
// is a contract change and is rejected (422), never silently coerced.
export const VALID_CASE_STATUSES = [
  "pending",
  "processing",
  "approved",
  "rejected",
] as const;
export type CaseStatus = (typeof VALID_CASE_STATUSES)[number];

export function isValidCaseStatus(value: unknown): value is CaseStatus {
  return (
    typeof value === "string" &&
    (VALID_CASE_STATUSES as readonly string[]).includes(value)
  );
}

// Batch cap for the array form of the /sync/* endpoints (§6.1); larger -> 413.
export const MANUS_BATCH_CAP = 100;

// Webhook replay window in seconds (PDF §4.1): reject if |now - timestamp| > 300.
export const WEBHOOK_REPLAY_WINDOW_SECONDS = 300;

export interface Readiness {
  ready: boolean;
  /** Human-readable, secret-free explanation when not ready. */
  reason?: string;
}

// --- Inbound /sync/* (machine-to-machine push from Manus) -------------------
// Auth: Authorization: Bearer <MANUS_SYNC_TOKEN>. Optional HMAC body signature
// (X-Manus-Signature: sha256=...) when MANUS_SIGNING_SECRET is configured.

export function inboundSyncReadiness(): Readiness {
  if (!flag("MANUS_INBOUND_SYNC_ENABLED")) {
    return { ready: false, reason: "inbound sync disabled" };
  }
  if (!secret("MANUS_SYNC_TOKEN")) {
    return { ready: false, reason: "credentials not configured" };
  }
  return { ready: true };
}

export function inboundSyncToken(): string | undefined {
  return secret("MANUS_SYNC_TOKEN");
}

/** Optional shared key for verifying X-Manus-Signature over the raw body. */
export function inboundSigningSecret(): string | undefined {
  return secret("MANUS_SIGNING_SECRET");
}

// --- Inbound webhook receiver (Netspy event push) ---------------------------
// Gated by the same inbound enable flag, but verified with NETSPY_WEBHOOK_SECRET.

export function webhookReadiness(): Readiness {
  if (!flag("MANUS_INBOUND_SYNC_ENABLED")) {
    return { ready: false, reason: "inbound sync disabled" };
  }
  if (!secret("NETSPY_WEBHOOK_SECRET")) {
    return { ready: false, reason: "credentials not configured" };
  }
  return { ready: true };
}

export function webhookSecret(): string | undefined {
  return secret("NETSPY_WEBHOOK_SECRET");
}

// --- Outbound client (Refunds.site -> Netspy API) ---------------------------
// Requires an explicit base URL: we never default to the production host while
// its DNS is unverified, to avoid silently calling a non-existent endpoint.

export interface OutboundConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}

export function outboundReadiness(): Readiness {
  if (!flag("MANUS_OUTBOUND_SYNC_ENABLED")) {
    return { ready: false, reason: "outbound sync disabled" };
  }
  if (!secret("NETSPY_API_KEY")) {
    return { ready: false, reason: "NETSPY_API_KEY not configured" };
  }
  if (!secret("NETSPY_API_SECRET")) {
    return { ready: false, reason: "NETSPY_API_SECRET not configured" };
  }
  if (!secret("NETSPY_API_BASE_URL")) {
    return { ready: false, reason: "NETSPY_API_BASE_URL not configured" };
  }
  return { ready: true };
}

export function outboundConfig(): OutboundConfig | null {
  const apiKey = secret("NETSPY_API_KEY");
  const apiSecret = secret("NETSPY_API_SECRET");
  const baseUrl = secret("NETSPY_API_BASE_URL");
  if (!apiKey || !apiSecret || !baseUrl) return null;
  return { apiKey, apiSecret, baseUrl: baseUrl.replace(/\/+$/, "") };
}
