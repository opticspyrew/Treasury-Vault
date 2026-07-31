---
name: Social OAuth test mode
description: How to exercise the Google sign-in/connect flow without real Google credentials.
---

# Social OAuth test mode (api-server)

The Google OAuth flow can run with NO real Google credentials via a fake
in-app provider, gated by `isSocialOAuthTestMode()` =
`SOCIAL_OAUTH_TEST_MODE === "1"` AND `NODE_ENV !== "production"`.

When on: `getGoogleConfig()` returns a stub (so `/api/auth/providers/config`
reports `google:true` and buttons render); `startFlow` redirects to an in-app
fake consent page `GET /api/auth/google/test-authorize` (email/name form);
`handleCallback` builds a verified profile from the submitted email and skips
the real token exchange.

**Why:** the project has no Google client credentials, so the OAuth
round-trip is otherwise untestable in CI or the browser. The prod gate
(`NODE_ENV !== "production"`) means a deployed app ignores the flag — it can
never become a "sign in as anyone" backdoor.

**How to apply:**
- Automated e2e (`tests/social-oauth-e2e.test.mjs`) sets the env var and boots
  the app in-process — self-contained, no external server, CI-safe.
- For a live browser run: set `SOCIAL_OAUTH_TEST_MODE=1` in the *development*
  environment, restart the api-server workflow, then test. Remove it afterward
  so the dev preview returns to normal (Google buttons hidden).
