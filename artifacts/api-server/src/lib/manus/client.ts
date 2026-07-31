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
  // NETSPY_BACKOFF_BASE_MS exists so tests can shorten waits; unset in prod.
  const base = Number(process.env.NETSPY_BACKOFF_BASE_MS ?? 250);
  return new Promise((resolve) => setTimeout(resolve, base * 2 ** (attempt - 1)));
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
    const err = (data as Record<string, unknown>).error;
    // tRPC error envelope: {"error":{"json":{"message":...}}}
    if (err && typeof err === "object") {
      const json = (err as Record<string, unknown>).json;
      if (json && typeof json === "object" && "message" in (json as object)) {
        return String((json as Record<string, unknown>).message);
      }
    }
    return String(err);
  }
  return `HTTP ${status}`;
}

// The live Netspy server (verified 2026-07-31 at netspyworld.manus.space) is a
// real tRPC server with a superjson-style transformer: query inputs travel as
// `?input={"json":<input>}` and mutation bodies as `{"json":<input>}`. Success
// payloads arrive as {"result":{"data":{"json":<output>}}}. The handoff PDF's
// plain-REST framing does not work against it (400 invalid_type).
function wrapTrpcInput(input: unknown): string {
  return JSON.stringify({ json: input });
}

function unwrapTrpcResult(data: unknown): unknown {
  if (data && typeof data === "object" && "result" in data) {
    const result = (data as Record<string, unknown>).result;
    if (result && typeof result === "object" && "data" in (result as object)) {
      const inner = (result as Record<string, unknown>).data;
      if (inner && typeof inner === "object" && "json" in (inner as object)) {
        return (inner as Record<string, unknown>).json;
      }
      return inner;
    }
  }
  return data;
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
      if (resp.ok) return { ok: true, status: resp.status, data: unwrapTrpcResult(data) as T };
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
  // The live server's zod schema requires a STRING here (verified 2026-07-31:
  // a number is rejected with invalid_type "expected string, received number"),
  // despite the handoff PDF typing it as a number.
  estimatedLoss?: string;
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
  return request("POST", "cases.createUnified", { body: { json: input } });
}

export function getUnifiedCase(unifiedCaseId: number | string): Promise<OutboundResponse> {
  const id = Number(unifiedCaseId);
  if (!Number.isFinite(id)) {
    return Promise.resolve({
      ok: false,
      status: 0,
      error: `invalid unifiedCaseId: ${String(unifiedCaseId)}`,
    });
  }
  return request("GET", "cases.getUnified", {
    query: { input: wrapTrpcInput({ unifiedCaseId: id }) },
  });
}

export function syncCaseStatus(input: SyncStatusInput): Promise<OutboundResponse> {
  return request("POST", "cases.syncStatus", { body: { json: input } });
}

export { healthUrl, wrapTrpcInput, unwrapTrpcResult };
