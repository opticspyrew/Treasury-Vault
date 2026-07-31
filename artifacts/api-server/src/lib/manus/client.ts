// Outbound client for the Netspy-World tRPC API (handoff PDF §3).
//
// Surfaces used by our hooks: health, cases.createUnified, cases.getUnified,
// cases.syncStatus. Every request carries Authorization: Bearer <key> and
// X-API-Key: <key>; POSTs additionally carry X-API-Signature, the hex
// HMAC-SHA256 of the exact JSON body under NETSPY_API_SECRET (PDF §3.3).
//
// This module is inert unless outbound is enabled AND fully configured —
// outboundConfig() returns null otherwise and every call short-circuits to a
// non-throwing error result. Transient failures (network errors, 5xx, 429) are
// retried with exponential backoff; deterministic 4xx are returned as-is.

import { outboundConfig, outboundReadiness } from "./config";
import { signOutboundPayload } from "./crypto";

export interface OutboundResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;

function backoff(attempt: number): Promise<void> {
  // 250ms, 500ms, 1000ms — short enough to stay within a request's patience when
  // a caller chooses to await, long enough to ride out a brief blip.
  return new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFrom(data: unknown, status: number): string {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as Record<string, unknown>).error);
  }
  return `HTTP ${status}`;
}

// Derive the health URL: health lives at <origin>/api/health, a sibling of the
// /api/trpc base, so we cannot just append to baseUrl.
function healthUrl(baseUrl: string): string {
  try {
    return `${new URL(baseUrl).origin}/api/health`;
  } catch {
    return `${baseUrl.replace(/\/api\/trpc$/, "")}/api/health`;
  }
}

interface RequestOptions {
  query?: Record<string, string>;
  body?: unknown;
}

async function request<T = unknown>(
  method: "GET" | "POST",
  pathOrUrl: string,
  opts: RequestOptions = {},
): Promise<OutboundResponse<T>> {
  // Honor the master enable flag at the client boundary too, not just in the
  // hooks, so no future caller can reach Netspy while outbound is disabled.
  if (!outboundReadiness().ready) {
    return { ok: false, status: 0, error: "outbound not enabled" };
  }
  const cfg = outboundConfig();
  if (!cfg) return { ok: false, status: 0, error: "outbound not configured" };

  let url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${cfg.baseUrl}/${pathOrUrl.replace(/^\/+/, "")}`;
  if (opts.query) {
    const qs = new URLSearchParams(opts.query).toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }

  const hasBody = opts.body !== undefined;
  const payload = hasBody ? JSON.stringify(opts.body) : "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "X-API-Key": cfg.apiKey,
  };
  if (hasBody) {
    headers["Content-Type"] = "application/json";
    headers["X-API-Signature"] = signOutboundPayload(cfg.apiSecret, payload);
  }

  let lastError = "request failed";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method,
        headers,
        body: hasBody ? payload : undefined,
        signal: controller.signal,
      });
      const text = await resp.text();
      const data = parseBody(text);
      if (resp.ok) return { ok: true, status: resp.status, data: data as T };
      // Retry server-side and rate-limit errors; surface client errors verbatim.
      if (resp.status >= 500 || resp.status === 429) {
        lastError = `HTTP ${resp.status}`;
        if (attempt < MAX_ATTEMPTS) {
          await backoff(attempt);
          continue;
        }
        return { ok: false, status: resp.status, error: lastError };
      }
      return { ok: false, status: resp.status, error: errorFrom(data, resp.status) };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS) {
        await backoff(attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, error: lastError };
}

export interface CreateUnifiedCaseInput {
  clientEmail: string;
  clientName: string;
  caseType?: string;
  estimatedLoss?: number;
  caseDescription?: string;
  evidenceFileUrl?: string;
  blockchainData?: {
    walletAddresses?: string[];
    chains?: string[];
    transactionHashes?: string[];
  };
}

export interface SyncStatusInput {
  unifiedCaseId: number;
  investigationStatus: string;
  recoveryStatus: string;
  blockchainData?: unknown;
}

export function health(): Promise<OutboundResponse> {
  const cfg = outboundConfig();
  if (!cfg) return Promise.resolve({ ok: false, status: 0, error: "outbound not configured" });
  return request("GET", healthUrl(cfg.baseUrl));
}

export function createUnifiedCase(
  input: CreateUnifiedCaseInput,
): Promise<OutboundResponse<{ unifiedCaseId?: number; netsyyCaseId?: number; status?: string }>> {
  return request("POST", "cases.createUnified", { body: input });
}

export function getUnifiedCase(unifiedCaseId: number | string): Promise<OutboundResponse> {
  return request("GET", "cases.getUnified", { query: { unifiedCaseId: String(unifiedCaseId) } });
}

export function syncCaseStatus(input: SyncStatusInput): Promise<OutboundResponse> {
  return request("POST", "cases.syncStatus", { body: input });
}

export { healthUrl };
