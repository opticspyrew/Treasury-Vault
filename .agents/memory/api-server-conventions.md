---
name: api-server & crypto-dashboard data conventions
description: Non-obvious wiring conventions for adding API routes and frontend fetchers in this monorepo
---

# API server + frontend data conventions

## Frontend API base
- Frontend fetches use **root-relative `/api/...`**, NOT `import.meta.env.BASE_URL`.
  The proxy maps `/api` to the api-server regardless of the artifact's base path.
  Match `artifacts/crypto-dashboard/src/lib/api.ts` (`API_BASE = "/api"`) for any
  new fetcher; using BASE_URL would prepend the artifact path and break the call.

## api-server dev workflow needs a restart for new routes
- The `api-server` dev workflow runs `build` then `start` (esbuild bundle to
  dist/, then `node dist/index.mjs`) — it does **not** hot-reload.
- After adding/registering a route or changing route code, you must
  `restart_workflow("artifacts/api-server: API Server")` before curl sees it.
  A 404 on a brand-new route almost always just means "not restarted yet".

## Route registration order
- In `src/routes/index.ts`, mount more-specific prefixes BEFORE general ones,
  e.g. `router.use("/public/refunds", refundsRouter)` must come before
  `router.use("/public", publicRouter)` or the general router swallows the path.

## Auth for protected endpoints
- Use `extractBearerToken` + `findUserBySessionToken` (from `src/lib/auth.ts`);
  the returned `User` is the full `users` row (has `name`, `email`).
- Frontend gets the token from `useAuth()` (`@/lib/auth-context`), where
  `token` is `string | null`.

## Case-derived documents share one ownership-enforced endpoint
- `GET /public/refunds/reports/:reference` (frontend `useCaseReport`) is the
  single source for any document built from a case — Report Generation AND
  Legal Coordination both consume it, so generated docs cite server-verified
  facts, not client state. Build new case-document features on top of this hook.
- **Why:** keeps every case artifact behind the same ownership check (caller's
  `adminClients` email must match the request's `clientId`).
- Reference matching must be EXACT on year+id (`caseReference(id, createdAt)`),
  not just the numeric id — `referenceToId` alone would let `RF-9999-0001`
  resolve case `0001`. The route re-checks the full reference before returning.

## Per-case activity scoping in case reports
- `admin_activity_log.service_request_id` (nullable FK, ON DELETE SET NULL) tags
  an activity event to its owning case. A case report shows: events tagged to
  this case, PLUS client-level events (`service_request_id IS NULL` AND event
  type NOT in `CASE_SPECIFIC_EVENT_TYPES`). Untagged case-specific events
  (legacy rows, or rows nulled when a sibling case is deleted) are **hidden**,
  never shown as client-level.
- **Why:** treating every NULL as client-level leaks one case's timeline onto a
  multi-case client's *other* case reports/AI narratives. Hiding unattributable
  case events is the safe default; leaking them is a cross-case disclosure.
- **How to apply:** when you add an insert that sets `service_request_id`, also
  add that event type to `CASE_SPECIFIC_EVENT_TYPES` in `refunds.ts` (the two
  must stay in lockstep). Client-level events (registration, KYC) stay NULL.
- Schema changes here: apply additively via direct `psql "$DATABASE_URL"` ALTER.
  `drizzle push` is destructive/interactive in this repo (it tried to DROP an
  unrelated `transactions` table) — never run it for an additive column.

## Running the test suite (node:test)
- Tests are `node --import tsx --test tests/**/*.test.mjs`. `tsx` is NOT
  resolvable from the repo root — run a single file via
  `pnpm --filter @workspace/api-server exec node --import tsx --experimental-test-module-mocks --test tests/<file>.test.mjs`.
- node:test **block-buffers when piped** (`| tail`) and only flushes on process
  exit; the full suite (incl. the slow social-oauth e2e) runs ~85–100s and can
  exceed the 120s tool limit, yielding a killed call with *no output*. Run a
  focused single file (streams + finishes fast) instead of the whole suite when
  you only changed one code path. The harness boots a live server on :8080 and
  uses a fresh fake `X-Forwarded-For` per request to dodge rate limiters.
