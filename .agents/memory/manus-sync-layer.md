---
name: Manus/Netspy data-sync layer
description: Non-obvious decisions for the feature-flagged Refunds.site <-> Netspy-World sync layer in api-server
---

# Manus/Netspy data-sync layer (feature-flagged)

Lives in `artifacts/api-server/src/lib/manus/*` + `src/routes/refunds-sync.ts`.
Disabled by default; inbound and outbound are SEPARATE readiness gates (each
needs its own flag AND its own credentials configured) — a half-configured side
serves 503 rather than half-working. Contract: `docs/manus-data-sync-requirements.md`
(our inbound `/sync/*`) + the Netspy handoff PDF (outbound client + webhook receiver).

## Idempotency uses an atomic reservation row, not advisory locks
`runIdempotent(key, rawBody, handler)` does `INSERT (key, request_hash) ON CONFLICT
DO NOTHING` as the single serialization point; the winner runs the handler then
writes the response, losers replay/409/в-progress.
**Why:** the earlier advisory-lock design held a pooled connection across the whole
handler, risking pool exhaustion/starvation under concurrent retries. The
reservation pattern holds no connection across handler execution.
**How to apply:** keep handlers' side effects naturally idempotent on business
keys too (clients on email/manusClientId, cases on manusCaseId, activity on
manusEventId) — the key is the contract guard, not the only guard.

## Webhook redeliveries mutate a per-attempt deliveryId INSIDE the body
Netspy at-least-once redeliveries reuse a stable `body.id` (event id) but change
`body.deliveryId` per attempt. So the webhook receiver:
- de-dupes on `webhook:${body.id ?? body.deliveryId ?? header X-Webhook-Delivery-Id ?? sha256(raw)}` (stable event id FIRST), and
- calls `runIdempotent(..., { conflictOnBodyMismatch: false })`.
**Why:** the default `runIdempotent` 409s when a reused key arrives with a
different raw body. For webhooks that would turn every legitimate redelivery
(different deliveryId in the body) into a 409 instead of replaying the stored 200.
`conflictOnBodyMismatch:false` exists specifically for this case; `/sync/*` keeps
the default true (caller-chosen UUID key, different body genuinely = different request).

## The real Netspy staging sender deviates from its own PDF spec
The handoff PDF (§4.1) specifies `X-Webhook-Signature = sha256=HMAC(timestamp.body)`
plus a timestamp header and 300s replay window. The actual staging sender (Manus
sandbox) instead sends `x-netspy-signature` = bare lowercase hex HMAC over the raw
body only — no timestamp. The receiver accepts BOTH: PDF scheme first, plain-body
scheme as fallback (`verifyNetspyPlainSignature`). The sender also puts the
event type in body field `type` with snake_case names ("case_created"), not the
PDF's `event` with dotted names — receiver normalizes via a closed alias table
(`normalizeWebhookEventName`); the `case_updated→case.statusUpdated` alias is an
unverified guess, confirm semantics when their first real one arrives. Their
staging vocabulary also includes `case_synced` and `blockchain_data_updated` —
absent from the PDF, deliberately NOT aliased (no guessing); they fall to the
default recorder (logged + acked 200) until the partner defines their payloads.
**Why:** the partner implementation, not the spec, is authoritative for interop;
blocking on spec conformance would stall staging indefinitely.
**Recurring gotcha:** the partner (Manus AI) repeatedly sends status docs with the
two servers SWAPPED — claiming *we* must implement `cases.*` / that *our* API "only
exposes system.health" / that the `*.manus.computer` URL is ours. All false: `cases.*`
+ `system.health` live on THEIR tRPC server (we're the client via `client.ts`), the
sandbox URL is theirs, our prod URL is `refunds.site`. `docs/manus-data-sync-requirements.md`
§0 "Roles & topology" is the authoritative anti-role-reversal source of truth — point
them there rather than re-arguing. Never build `cases.*` procedures on our server off
a forwarded doc; that contradicts the contract and duplicates the working webhook path.
**How to apply:** for fallback-verified deliveries the unsigned
`X-Webhook-Delivery-Id` header must NOT key replay de-dupe or the envelope —
only signed material (body id/deliveryId, else sha256(raw)). Expect similar
spec-vs-reality drift in their outbound tRPC procedures (`cases.*` from the PDF
were absent on staging; only `system.health` existed — requires `{timestamp}`
input, and it's public/unauthenticated). Their base URL is an ephemeral
`*.manus.computer` sandbox host — it changes on sandbox restart and the sandbox
sleeps; 502 "Manus Sandbox" HTML page = asleep/expired link, wake it from the
Manus task.

## Production go-live state (inbound only)
Inbound webhook receiver is LIVE in production at
`https://refunds.site/api/public/refunds/webhooks/netspy-events` (prod flag
`MANUS_INBOUND_SYNC_ENABLED=1`, prod `NETSPY_WEBHOOK_SECRET` rotated to a fresh
value distinct from staging). Outbound stays OFF in prod — still blocked on the
partner's missing `cases.*` tRPC procedures and a stable (non-sandbox) API URL.
**Why:** the prior staging secret was burned by being screenshotted, so prod got
a freshly minted secret; keep prod/staging secrets distinct.
**How to apply:** production DB is SEPARATE from dev (independent case-number
sequence — prod started ~RF-2026-00xx while dev was ~RF-2026-03xx), so live
verification against prod writes REAL rows into the firm's prod dashboard; clean
up test cases afterward. Deploy is user-initiated (Publish button) — the receiver
404s in prod until the user republishes after code changes.

## Contract enforcement worth remembering
- `/sync/*` writes REQUIRE an `Idempotency-Key` header (§4 rule 3); absent => 400
  ("missing required field", §10), rejected before any side effect.
- Schema: `manus_idempotency_keys.response_status/response_body` are NULLABLE (a
  reservation is created before the response exists). `pruneIdempotencyKeys(7)`
  exists for retention but is NOT auto-scheduled — wire a cron if growth matters.

## Partner "production URL" verification (2026-07)
Netspy's claimed production tRPC base `https://netspyworld.com/api/trpc` is NOT a
deployed API: Cloudflare-fronted, returns HTTP 403 + HTML `<title>Manus Space</title>`
on every path (`/`, `/api/trpc`, `/api/trpc/*`) — a Manus sandbox placeholder, not
tRPC. Even `system.health` fails there.
**Rule:** before enabling outbound (`NETSPY_API_BASE_URL` + `MANUS_OUTBOUND_SYNC_ENABLED=1`),
curl the URL and require a JSON tRPC response from `system.health`; a "Manus Space"
HTML page or any non-JSON = undeployed, do NOT enable. A delivered URL is necessary
but not sufficient — `cases.createUnified/getUnified/syncStatus` must actually respond.
**Inbound payloads:** map `case.updated`/`case.synced`/`blockchain.data.updated` in
processWebhookEvent only from concrete field specs, never a summary; until then they
stay logged+acked (no guessing).
