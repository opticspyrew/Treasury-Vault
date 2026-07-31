# Manus ↔ Refunds.site Data-Sync Requirements ("our side")

**Owner:** NETSPYWORLD FORENSICS LTD (brand: Netspy-World Forensics)
**Scope:** Refunds.site, which lives inside the `crypto-dashboard` artifact at `/refunds`.
**Status:** Inbound (Manus/Netspy → Refunds.site) is **LIVE in production** — the
webhook receiver is deployed and verified. Outbound (Refunds.site → Manus)
remains **BLOCKED on the partner** (see §0 and §11). This document describes what
*our* side (Refunds.site backend, `@workspace/api-server`) needs in order to
exchange case data with Manus, and — in §0 — the authoritative split of which side
owns what. It does not commit Manus to any specific contract.

---

## 0. Roles & topology (authoritative — read this first)

**This section overrides any conflicting statement elsewhere, in this doc or in
any external document. It exists because integration ownership has repeatedly
been described with the two servers swapped.**

Two independent systems, two servers:

| | **Refunds.site (our side)** | **Netspy / Manus (partner side)** |
|---|---|---|
| Codebase | `@workspace/api-server` + `crypto-dashboard/refunds` | Manus sandbox / Netspy production (not in this repo) |
| Production URL | `https://refunds.site` — stable, deployed | must supply one; today only an ephemeral `*.manus.computer` sandbox |
| API style | REST under `/api/public/refunds/*` (+ `/admin`, `/auth`) | tRPC (`system.health`, plus the `cases.*` procedures below) |
| Exposes `system.health` / `cases.*`? | **No — never.** | **Yes — these live here.** Today only `system.health` is implemented. |

Data flows:

- **Netspy → Refunds.site (inbound to us): LIVE.** Netspy pushes events to the
  webhook receiver we expose at
  `POST https://refunds.site/api/public/refunds/webhooks/netspy-events` (and, when
  enabled, the `/sync/*` endpoints in §6.1). **We are the receiver.**
- **Refunds.site → Netspy (outbound from us): BLOCKED on partner.** Our outbound
  client (`lib/manus/client.ts`) **calls** `cases.createUnified`,
  `cases.getUnified`, and `cases.syncStatus` **on Netspy's tRPC server**. **We are
  the client;** those procedures must be implemented **on their side**. They are
  not, and will not be, procedures on our server.

Consequences that keep getting reversed:

1. **`cases.*` procedures are Netspy's to implement, on Netspy's server.** We
   never expose them. "Only `system.health` responds" describes **their** server,
   not ours.
2. **The ephemeral `*.manus.computer` URL is Netspy's.** Ours (`refunds.site`) is
   already stable. The stable production tRPC URL is **owed by Netspy**.
3. **Event payloads are defined by the sender.** Netspy sends the `case.*` /
   `blockchain.*` events, so Netspy defines their fields; we map what they send.
   Unknown/undefined events are received, signature-verified, logged, and acked
   (never dropped) until their shape is confirmed.

Event naming: the handoff PDF uses **dotted** names (`case.created`); Netspy's live
sender uses **snake_case** (`case_created`). Our receiver accepts both via a closed
alias table, with dotted as canonical. Standardize on dotted before full production.

If Netspy would prefer to push inbound by calling tRPC `cases.*` procedures **on
our** server instead of via the webhook that already works, that is a **new,
deliberate design change** — not the agreed contract — and must be scoped
explicitly, never inferred from a status document.

---

## 1. Purpose & goals

Manus is the firm's external case-management / operations system. Refunds.site is
the client-facing intake and status portal. We need a reliable, idempotent,
auditable sync so that:

1. Cases (service requests) and the clients who own them stay consistent across
   both systems.
2. Status changes made by analysts in Manus surface to clients on Refunds.site
   without manual re-entry.
3. New intakes captured on Refunds.site reach Manus for triage.
4. Every sync action is recorded in our activity log so the case timeline shown
   to clients (and used by the AI assistant for narratives) stays complete.

Non-goals: Manus's internal workflow, analyst tooling, or any data we do not
already model. We sync only the three canonical entities below.

---

## 2. Canonical entities (the only data we sync)

Our side already models these in `lib/db/src/schema/admin.ts`. The sync contract
maps **one-to-one** onto these tables. We do **not** invent new external-facing
tables; Manus-specific identifiers are added as additive columns (see §4).

### 2.1 Client — `admin_clients`

| Field        | DB column     | Type                | Notes                                            |
|--------------|---------------|---------------------|--------------------------------------------------|
| id           | `id`          | serial PK           | Our internal id. Never sent as the join key.     |
| name         | `name`        | text, required      |                                                  |
| email        | `email`       | text, **unique**    | Natural business key on our side.                |
| phone        | `phone`       | text, nullable      |                                                  |
| company      | `company`     | text, nullable      |                                                  |
| status       | `status`      | text, default `pending` | Lifecycle (see §3).                          |
| notes        | `notes`       | text, nullable      | Internal notes; **not** exposed to clients.      |
| createdAt    | `created_at`  | timestamptz         |                                                  |
| updatedAt    | `updated_at`  | timestamptz         | Used for last-writer reconciliation (see §7).    |

### 2.2 Service request (a "case") — `admin_service_requests`

| Field        | DB column      | Type                     | Notes                                          |
|--------------|----------------|--------------------------|------------------------------------------------|
| id           | `id`           | serial PK                | Drives the public case reference (see §5).      |
| clientId     | `client_id`    | int FK → admin_clients   | Required.                                       |
| type         | `type`         | text, default `withdrawal` |                                              |
| amount       | `amount`       | numeric(14,2), nullable  | Optional. Validate precision/scale on ingest.  |
| currency     | `currency`     | text, default `USD`      |                                                |
| notes        | `notes`        | text, nullable           | Internal.                                      |
| txnId        | `txn_id`       | text, nullable           | On-chain / external transaction reference.     |
| status       | `status`       | text, default `pending`  | Lifecycle (see §3).                            |
| publicToken  | `public_token` | varchar(64), **unique**  | Unguessable capability token; **never** sent to Manus and never logged. |
| createdAt    | `created_at`   | timestamptz              |                                                |
| updatedAt    | `updated_at`   | timestamptz              | Reconciliation timestamp.                      |

> **Security:** `public_token` is a per-row capability used by the public status
> lookup. It must never appear in any Manus payload, log line, or error message.

### 2.3 Activity event — `admin_activity_log`

| Field        | DB column     | Type                   | Notes                                            |
|--------------|---------------|------------------------|--------------------------------------------------|
| id           | `id`          | serial PK              |                                                  |
| eventType    | `event_type`  | text, required         | e.g. `service_request_submitted`, `status_changed`. |
| clientId     | `client_id`   | int FK, nullable       |                                                  |
| description  | `description` | text, required         | Human-readable; surfaced in the client timeline. |
| metadata     | `metadata`    | jsonb, nullable        | Structured detail; sync provenance goes here.    |
| createdAt    | `created_at`  | timestamptz            |                                                  |

Activity is **append-only**. Sync never updates or deletes existing rows; it only
inserts new events. Each synced event carries provenance in `metadata`
(`{ "source": "manus", "manusEventId": "..." }`) so we never double-insert.

> **Per-case scoping (required).** `admin_activity_log` today links an event only
> to a *client* (`client_id`), not to a specific case. That means reports and
> AI-generated narratives currently aggregate **all** of a client's activity,
> which is inaccurate for clients with more than one case. Every synced event
> MUST therefore carry the owning case in `metadata`
> (`{ "reference": "RF-2026-0001", "manusCaseId": "case_..." }`), and the planned
> additive column `admin_activity_log.service_request_id` (see §4) must be
> populated so the report helper can filter activity by case rather than by
> client. Until that column exists, the case reference in `metadata` is the only
> reliable per-case scope.

---

## 3. Status lifecycle (shared vocabulary)

Both systems must agree on a closed set of status strings. Our code currently
recognizes the following for service requests; Manus must map its internal states
onto these and reject anything else:

- `pending` — intake received, not yet triaged (our default on create).
- `processing` — actively being worked.
- `approved` — recovery outcome approved; counts toward "value released" metrics.
- `rejected` — declined; a reason should accompany this transition.

Client `status` uses `pending` by default and follows the firm's onboarding
states. Any new status value is a **contract change** and must be agreed in
writing before either side emits it, because unknown values break our public
metrics aggregation (which filters on `approved` / `processing`).

> **Compliance guardrail:** status text and any synced narrative must never imply
> guaranteed recovery. "Recovery is never guaranteed" remains the firm's stance.

---

## 4. External IDs & idempotency keys

We do **not** join on autoincrement `id` across systems. Each side keeps its own
primary key and stores the *other* system's id alongside it.

Required additive columns on our side (migration to be scheduled with Phase 5):

- `admin_clients.manus_client_id` (text, nullable, unique when present)
- `admin_service_requests.manus_case_id` (text, nullable, unique when present)
- `admin_activity_log.service_request_id` (int, nullable, FK → admin_service_requests.id)
  — links each event to its owning case so reports/narratives can be scoped per
  case rather than per client (see §2.3). Backfill from `metadata.reference`
  where possible.
- A durable store of processed `Idempotency-Key` values (key → result hash,
  retained ≥ 7 days) so retried webhooks return the original result instead of
  re-applying writes (see §4 rules 3–4).

Join/idempotency rules:

1. **Clients** join on `email` (our natural unique key) **or** `manus_client_id`
   when known. Email is case-insensitive for matching.
2. **Service requests** join on `manus_case_id`; if absent, fall back to our case
   reference (§5) supplied by Manus.
3. Every **write** request carries an `Idempotency-Key` header (a UUID chosen by
   the caller). We persist processed keys for at least 7 days and return the
   original result for repeats, so retries never create duplicates.
4. Activity events additionally de-dupe on `metadata.manusEventId`.

---

## 5. Case reference format

The client-facing reference is derived deterministically from the service-request
id and its creation year:

```
RF-<YYYY>-<id zero-padded to 4>      e.g.  RF-2026-0001
```

Parsing back is strict: `^RF-\d{4}-(\d+)$`. Manus may display this reference but
must treat `manus_case_id` (not the reference) as the durable join key, since the
reference encodes our internal id and year.

---

## 6. Sync direction & transport

Two directions, each explicit:

### 6.1 Manus → Refunds.site (push, primary)

Manus is the system of record for analyst-driven changes (status, notes, new
activity). Manus **pushes** changes to endpoints we expose. Preferred transport:
**webhook-style HTTPS POST** with idempotency keys. Endpoints we will expose
(under the existing `/api/public/refunds` surface, but on a dedicated, separately
authenticated sub-path — see §8):

- `POST /sync/clients` — upsert a client.
- `POST /sync/cases` — upsert a service request (case).
- `POST /sync/activity` — append one or more activity events.

All three are **upsert/append** and **idempotent**. Batching: accept either a
single object or an array (cap array length, e.g. 100, and reject larger batches
with 413).

### 6.2 Refunds.site → Manus (push on intake)

When a client files a case on Refunds.site, we emit it to Manus so triage can
begin. Until Manus's API is documented, this is **outbound-pending**: we enqueue
the event locally (activity log marker `eventType = "manus_sync_pending"`) and
flush once credentials exist. No client-facing behavior depends on Manus being
reachable.

### 6.3 Reconciliation pull (secondary, optional)

A scheduled **pull** (`GET` from Manus, or a Manus-initiated full push) reconciles
drift. Frequency and endpoint TBD with Manus. Used only to repair missed
webhooks; the push path is authoritative for real-time updates.

---

## 7. Conflict resolution & reconciliation

- **Last-writer-wins by `updatedAt`** per field-group, with Manus winning ties on
  analyst-owned fields (`status`, `notes`) and Refunds.site winning on
  client-owned intake fields (`name`, `email`, `phone`, `company`, `amount`,
  `currency`, `txnId`).
- Status transitions are validated against §3; an out-of-vocabulary status is
  rejected (422) and logged, never silently coerced.
- Every applied sync writes an `admin_activity_log` row with
  `metadata.source = "manus"` so the change is auditable and appears in the client
  timeline and AI-generated narratives.
- Reconciliation compares `updatedAt` per record; mismatches are resolved by the
  rules above and the loser's prior value is preserved in the activity
  `metadata` for audit.

---

## 8. Authentication & security

- The `/sync/*` endpoints are **machine-to-machine**, not client-facing. They do
  **not** use the per-user bearer-session auth used by the rest of
  `/api/public/refunds`. Instead require a dedicated shared secret presented as
  `Authorization: Bearer <MANUS_SYNC_TOKEN>` (stored as a secret, requested via
  the environment-secrets flow when Phase 5 starts), plus an allow-listed source
  if Manus publishes stable egress IPs.
- Optional but recommended: HMAC signature header
  (`X-Manus-Signature: sha256=...`) over the raw body using a shared signing key,
  verified before parsing.
- Rate-limit the sync endpoints independently of the client API.
- TLS only. Reject non-HTTPS. Never log request bodies containing PII
  (`name`, `email`, `phone`) or `public_token`.

---

## 9. Payload examples (grounded in the schema)

### 9.1 Upsert client — `POST /sync/clients`

```http
POST /api/public/refunds/sync/clients
Authorization: Bearer <MANUS_SYNC_TOKEN>
Idempotency-Key: 7c3b...e1
Content-Type: application/json
```
```json
{
  "manusClientId": "mc_01HZX...",
  "name": "Jordan Avery",
  "email": "jordan@example.com",
  "phone": "+1-555-0100",
  "company": "Avery Holdings",
  "status": "pending",
  "updatedAt": "2026-06-28T04:10:00.000Z"
}
```
Response `200`:
```json
{ "ok": true, "clientId": 42, "manusClientId": "mc_01HZX...", "created": false }
```

### 9.2 Upsert case — `POST /sync/cases`

```json
{
  "manusCaseId": "case_01J2A...",
  "reference": "RF-2026-0001",
  "client": { "email": "jordan@example.com", "manusClientId": "mc_01HZX..." },
  "type": "withdrawal",
  "amount": "1000.00",
  "currency": "USD",
  "txnId": "0xabc123...",
  "status": "processing",
  "updatedAt": "2026-06-28T04:12:00.000Z"
}
```
Response `200`:
```json
{ "ok": true, "caseId": 1, "reference": "RF-2026-0001", "manusCaseId": "case_01J2A...", "created": false }
```
Notes: `amount` is validated against `numeric(14,2)`; out-of-range/non-numeric →
`422`. `public_token` is **never** present in this payload.

### 9.3 Append activity — `POST /sync/activity`

```json
[
  {
    "manusEventId": "evt_01J2B...",
    "case": { "reference": "RF-2026-0001", "manusCaseId": "case_01J2A..." },
    "clientEmail": "jordan@example.com",
    "eventType": "status_changed",
    "description": "Case moved to processing after on-chain trace confirmed.",
    "metadata": { "from": "pending", "to": "processing" },
    "createdAt": "2026-06-28T04:12:00.000Z"
  }
]
```
Response `200`:
```json
{ "ok": true, "inserted": 1, "skippedDuplicates": 0 }
```

---

## 10. Error contract

| HTTP | Meaning                                                            |
|------|-------------------------------------------------------------------|
| 200  | Upsert/append applied (idempotent repeats also return 200).       |
| 400  | Malformed JSON or missing required field.                         |
| 401  | Missing/invalid `MANUS_SYNC_TOKEN` (or bad HMAC signature).       |
| 404  | Referenced client/case not found and payload lacks data to create.|
| 409  | Idempotency-Key reused with a *different* body.                   |
| 413  | Batch exceeds the array cap.                                      |
| 422  | Valid JSON but invalid value (unknown status, bad amount).        |
| 429  | Rate limit exceeded.                                              |
| 503  | Sync temporarily disabled (e.g. credentials not configured).     |

Errors return `{ "error": "<human-readable message>" }` and never echo secrets,
tokens, or `public_token`.

---

## 11. Open questions & outstanding deliverables

**Resolved** (staging + production go-live):

- Manus pushes webhooks (not pull-only). Auth: HMAC-SHA256 body signature on
  webhooks; bearer `MANUS_SYNC_TOKEN` on the `/sync/*` path. (was Q1, Q4)
- Signing scheme confirmed: HMAC-SHA256 over the raw request body. The live
  sender uses header `x-netspy-signature` (bare hex over body); the PDF scheme
  (`X-Webhook-Signature` over `timestamp.body`) is also accepted. (was Q4)
- Status vocabulary and mapping to ours implemented (§3). (was Q3)

**Outstanding — owned by Netspy** (block full bidirectional production):

1. Implement `cases.createUnified` / `cases.getUnified` / `cases.syncStatus` on
   the **Netspy** tRPC server (today only `system.health` exists there). See §0.
2. Provide a **stable, production-grade tRPC base URL** (not an ephemeral
   `*.manus.computer` sandbox).
3. Confirm payload field definitions for `case.updated`, `case.synced`, and
   `blockchain.data.updated` (see §0, consequence 3).
4. Migrate the live sender from snake_case to dotted event names.

**Outstanding — owned by us** (on demand):

5. Provision and hand over a `MANUS_SYNC_TOKEN` if Netspy will use the `/sync/*`
   push path. (The webhook path needs no such token; it is already live.)
6. Canonical id formats, egress IP allow-listing, batch/retry policy, and
   reconciliation-pull SLA remain TBD with Manus if/when those paths are enabled.

Inbound (Netspy → Refunds.site) is **live in production**. Outbound remains
**blocked** until items 1–3 are delivered by Netspy; the contract above is what
our side is built to honor.
