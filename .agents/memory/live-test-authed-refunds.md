---
name: Live-testing authed Refunds API endpoints
description: How to exercise bearer-protected refunds routes (incl. the AI assistant) end-to-end without the UI, and what the OpenAI quota failure looks like.
---

# Live-testing authed Refunds endpoints

The Refunds AI routes (`POST /api/public/refunds/ai/chat`, `/ai/report/:reference`)
and the case routes are gated by `extractBearerToken` + `findUserBySessionToken`.
Session tokens are stored **plaintext** in `user_sessions.token`, so you can mint
a throwaway session directly in SQL to test as a real signed-in user.

**Why:** there is no simple email/password curl flow; the OAuth test-mode path is
heavier. A SQL-minted session is the fastest way to reach the authed code path.

**How to apply:**
- Hit the api-server directly on `localhost:8080` (the `$REPLIT_DEV_DOMAIN/api`
  proxy goes through the crypto-dashboard vite server, not the api-server).
- Create user + session in ONE statement and key cleanup by email so a failed
  capture never leaves an orphan account (a guard test forbids leftover accounts):
  ```sql
  WITH u AS (INSERT INTO users (email,name) VALUES ('ai-livetest-<ts>@example.invalid','t') RETURNING id)
  INSERT INTO user_sessions (user_id, token, expires_at)
  SELECT id, '<token>', now() + interval '1 hour' FROM u;
  ```
  then `DELETE FROM users WHERE email='ai-livetest-...';` (session cascades).
- Gotcha: **`UID` is a readonly bash variable** — never use it to capture an id;
  use `NEW_UID` etc. And `psql -c "INSERT ... RETURNING id"` prints the command
  tag too, so a CTE that needs no id capture is cleaner.

## OpenAI quota failure is graceful, not a crash
With a valid key but no billing/credits, the chat call returns
`429 insufficient_quota`. The route catches it AFTER headers are sent and emits
`data: {"error": "..."}` then `res.end()`, so the HTTP request still completes 200
and the client shows a clean error. A real answer requires a **funded** OpenAI
account — "wiring works but answers fail" almost always means quota, not code.
