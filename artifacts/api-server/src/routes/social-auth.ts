import { Router, type IRouter, type Request, type Response } from "express";
import { db, users, providerIdentities } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  createSession,
  extractBearerToken,
  findSessionWithUser,
  hasSeenSessionMetadata,
} from "../lib/auth";
import {
  buildGoogleAuthUrl,
  clearStateCookie,
  exchangeGoogleCode,
  getProviderConfigStatus,
  pkceChallengeFromVerifier,
  randomToken,
  readStateCookie,
  resolveUserForProviderProfile,
  attachProviderToExistingUser,
  setStateCookie,
  verifyGoogleIdToken,
  type OAuthStatePayload,
  type ProviderProfile,
} from "../lib/social-oauth";
import {
  getGoogleConfig,
  isProviderConfigured,
  isSocialOAuthTestMode,
  type SocialProvider,
} from "../lib/social-providers";
import { normalizeEmail } from "../lib/auth";
import {
  captureSessionMetadata,
  getTrustedAppOrigin,
  notifyNewSignIn,
} from "../lib/login-notifications";
import { resolveNotificationPreferences } from "../lib/notification-preferences";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const APP_LANDING_PATH = "/dashboard";
const SIGN_IN_PATH = "/sign-in";
const CONNECTED_ACCOUNTS_PATH = "/connected-accounts";

function callbackUrl(req: Request, provider: SocialProvider): string {
  const origin = getTrustedAppOrigin(req);
  if (!origin) {
    throw new Error("Cannot resolve callback URL: no app origin");
  }
  return `${origin}/api/auth/${provider}/callback`;
}

function redirectToSignInError(res: Response, code: string) {
  res.redirect(`${SIGN_IN_PATH}?social_error=${encodeURIComponent(code)}`);
}

function redirectToConnectedAccounts(res: Response, status: string) {
  res.redirect(`${CONNECTED_ACCOUNTS_PATH}?status=${encodeURIComponent(status)}`);
}

async function startFlow(
  req: Request,
  res: Response,
  provider: SocialProvider,
  opts: { linkUserId?: number } = {},
): Promise<void> {
  if (!isProviderConfigured(provider)) {
    if (opts.linkUserId) {
      redirectToConnectedAccounts(res, `${provider}_not_configured`);
    } else {
      redirectToSignInError(res, `${provider}_not_configured`);
    }
    return;
  }
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken(64);
  const payload: OAuthStatePayload = { state, nonce, codeVerifier };
  if (opts.linkUserId) payload.linkUserId = opts.linkUserId;
  setStateCookie(res, provider, payload);

  // Test mode: skip the real provider and hand off to the in-app fake consent
  // page, carrying the same `state` so the callback's CSRF check still passes.
  if (isSocialOAuthTestMode()) {
    res.redirect(`/api/auth/${provider}/test-authorize?state=${encodeURIComponent(state)}`);
    return;
  }

  try {
    const redirectUri = callbackUrl(req, provider);
    const cfg = getGoogleConfig()!;
    const codeChallenge = await pkceChallengeFromVerifier(codeVerifier);
    const url = buildGoogleAuthUrl({
      clientId: cfg.clientId,
      redirectUri,
      state,
      nonce,
      codeChallenge,
    });
    res.redirect(url);
  } catch (err) {
    logger.error({ err, provider }, "social-auth: failed to start flow");
    clearStateCookie(res, provider);
    if (opts.linkUserId) {
      redirectToConnectedAccounts(res, "start_failed");
    } else {
      redirectToSignInError(res, "start_failed");
    }
  }
}

async function loadAuthedUserId(req: Request): Promise<number | null> {
  // Allow either bearer token (when called from the SPA) or a `?token=` query
  // param on the /connect redirect endpoints, since the SPA can't set the
  // Authorization header on a top-level navigation.
  const bearer = extractBearerToken(req);
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
  const token = bearer ?? queryToken;
  if (!token) return null;
  const row = await findSessionWithUser(token);
  return row?.user.id ?? null;
}

// --- Public config: which providers are enabled ----------------------------

router.get("/providers/config", (_req, res) => {
  res.json({ providers: getProviderConfigStatus() });
});

// --- Authenticated: list & disconnect connected providers ------------------

router.get("/providers/linked", async (req, res) => {
  try {
    const userId = await loadAuthedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const rows = await db
      .select({
        provider: providerIdentities.provider,
        emailAtLink: providerIdentities.emailAtLink,
        linkedAt: providerIdentities.linkedAt,
      })
      .from(providerIdentities)
      .where(eq(providerIdentities.userId, userId));
    res.json({
      providers: getProviderConfigStatus(),
      // Only return links for providers we still support. Stale rows for
      // removed providers (e.g. apple) are hidden from the UI.
      linked: rows
        .filter((r) => r.provider === "google")
        .map((r) => ({
          provider: r.provider as SocialProvider,
          email: r.emailAtLink,
          linkedAt: r.linkedAt.toISOString(),
        })),
      hasPassword: !!user.passwordHash,
    });
  } catch (err) {
    logger.error({ err }, "social-auth: failed to list linked providers");
    res.status(500).json({ error: "Failed to load connected accounts." });
  }
});

router.post("/providers/:provider/disconnect", async (req, res) => {
  try {
    const provider = req.params.provider;
    if (provider !== "google") {
      res.status(400).json({ error: "Unknown provider." });
      return;
    }
    const userId = await loadAuthedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }

    // Don't allow disconnect if it would leave the user with no sign-in method.
    // IMPORTANT: only count providers we currently SUPPORT (i.e. "google").
    // Stale rows from removed providers (e.g. apple) must NOT be treated as a
    // valid fallback, or a no-password user with google+stale-apple could
    // disconnect google and be left with only unusable apple rows.
    const allLinks = await db
      .select({ provider: providerIdentities.provider })
      .from(providerIdentities)
      .where(eq(providerIdentities.userId, userId));
    const SUPPORTED_PROVIDERS: ReadonlySet<string> = new Set(["google"]);
    const otherProviders = allLinks.filter(
      (l) => l.provider !== provider && SUPPORTED_PROVIDERS.has(l.provider),
    ).length;
    const hasPassword = !!user.passwordHash;
    if (!hasPassword && otherProviders === 0) {
      res.status(400).json({
        error:
          "You can't disconnect your only sign-in method. Set a password first, or connect another provider.",
      });
      return;
    }

    await db
      .delete(providerIdentities)
      .where(
        and(
          eq(providerIdentities.userId, userId),
          eq(providerIdentities.provider, provider),
        ),
      );
    logger.info({ userId, provider }, "social-auth: provider disconnected");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "social-auth: failed to disconnect provider");
    res.status(500).json({ error: "Failed to disconnect provider." });
  }
});

// --- Start / callback for Google -------------------------------------------

router.get("/google/login", (req, res) => {
  void startFlow(req, res, "google");
});

router.get("/google/connect", async (req, res) => {
  const userId = await loadAuthedUserId(req);
  if (!userId) {
    redirectToSignInError(res, "auth_required");
    return;
  }
  void startFlow(req, res, "google", { linkUserId: userId });
});

router.get("/google/callback", async (req, res) => {
  await handleCallback(req, res, "google");
});

// --- Test-mode fake consent screen -----------------------------------------
// Only mounted/served when SOCIAL_OAUTH_TEST_MODE is on (and not in
// production). Stands in for the real Google account chooser so the full
// sign-in / connect journey can be driven in a browser without credentials.

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTestAuthorizeHtml(provider: SocialProvider, state: string): string {
  const safeState = escapeHtmlAttr(state);
  const callback = `/api/auth/${provider}/callback`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Test sign-in (${provider})</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 24rem; margin: 4rem auto; padding: 0 1rem;">
<h1 style="font-size: 1.25rem;">Test ${provider} sign-in</h1>
<p style="color:#555; font-size: 0.9rem;">Fake provider consent screen (test mode only).</p>
<form method="GET" action="${callback}" data-testid="test-authorize-form">
  <input type="hidden" name="state" value="${safeState}" />
  <label style="display:block; margin-bottom:0.75rem;">
    Email
    <input type="email" name="email" required data-testid="test-authorize-email"
      style="display:block; width:100%; padding:0.5rem; margin-top:0.25rem;" />
  </label>
  <label style="display:block; margin-bottom:0.75rem;">
    Name
    <input type="text" name="name" data-testid="test-authorize-name"
      style="display:block; width:100%; padding:0.5rem; margin-top:0.25rem;" />
  </label>
  <button type="submit" data-testid="test-authorize-continue"
    style="padding:0.5rem 1rem; cursor:pointer;">Continue</button>
</form>
<form method="GET" action="${callback}" style="margin-top:1rem;">
  <input type="hidden" name="state" value="${safeState}" />
  <input type="hidden" name="error" value="user_cancelled_authorize" />
  <button type="submit" data-testid="test-authorize-cancel"
    style="padding:0.5rem 1rem; cursor:pointer; background:none; border:1px solid #ccc;">Cancel</button>
</form>
</body>
</html>`;
}

router.get("/google/test-authorize", (req, res) => {
  if (!isSocialOAuthTestMode()) {
    res.status(404).send("Not found");
    return;
  }
  const state = typeof req.query.state === "string" ? req.query.state : "";
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(renderTestAuthorizeHtml("google", state));
});

// --- Shared callback handler -----------------------------------------------

async function handleCallback(
  req: Request,
  res: Response,
  provider: SocialProvider,
): Promise<void> {
  const stored = readStateCookie(req, provider);
  clearStateCookie(res, provider);

  const testMode = isSocialOAuthTestMode();
  const params = req.method === "POST" ? req.body : req.query;
  const queryError = typeof params?.error === "string" ? params.error : null;
  const state = typeof params?.state === "string" ? params.state : null;
  const code = typeof params?.code === "string" ? params.code : null;
  const testEmail = typeof params?.email === "string" ? params.email : null;
  const linking = !!stored?.linkUserId;

  if (queryError) {
    logger.warn({ provider, error: queryError }, "social-auth: provider returned error");
    if (linking) {
      redirectToConnectedAccounts(res, "cancelled");
    } else {
      redirectToSignInError(res, queryError === "user_cancelled_authorize" ? "cancelled" : "provider_error");
    }
    return;
  }
  // In test mode the fake consent screen returns an `email` rather than a real
  // authorization `code`; everything else (state/CSRF check) is unchanged.
  const hasCredential = testMode ? !!testEmail : !!code;
  if (!stored || !state || !hasCredential || stored.state !== state) {
    logger.warn({ provider }, "social-auth: missing or mismatched state in callback");
    if (linking) {
      redirectToConnectedAccounts(res, "missing_state");
    } else {
      redirectToSignInError(res, "missing_state");
    }
    return;
  }
  if (!isProviderConfigured(provider)) {
    if (linking) {
      redirectToConnectedAccounts(res, `${provider}_not_configured`);
    } else {
      redirectToSignInError(res, `${provider}_not_configured`);
    }
    return;
  }

  let profile: ProviderProfile;
  if (testMode) {
    // Build a verified profile straight from the fake consent input. No network
    // exchange happens; the provider user id is derived from the email so the
    // same test identity is stable across logins (link/return logic applies).
    const email = normalizeEmail(testEmail!);
    const rawName = typeof params?.name === "string" ? params.name.trim() : "";
    profile = {
      provider,
      providerUserId: `test|${provider}|${email}`,
      email,
      emailVerified: true,
      name: rawName || null,
    };
  } else {
    try {
      const redirectUri = callbackUrl(req, provider);
      const cfg = getGoogleConfig()!;
      const { idToken } = await exchangeGoogleCode({
        code: code!,
        redirectUri,
        codeVerifier: stored.codeVerifier,
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
      });
      profile = await verifyGoogleIdToken({
        idToken,
        clientId: cfg.clientId,
        expectedNonce: stored.nonce,
      });
    } catch (err) {
      logger.error({ err, provider }, "social-auth: token exchange or verify failed");
      if (linking) {
        redirectToConnectedAccounts(res, "exchange_failed");
      } else {
        redirectToSignInError(res, "exchange_failed");
      }
      return;
    }
  }

  if (!profile.emailVerified || !profile.email) {
    if (linking) {
      redirectToConnectedAccounts(res, "email_unverified");
    } else {
      redirectToSignInError(res, "email_unverified");
    }
    return;
  }

  // Linking flow: attach the provider identity to the already-logged-in user.
  if (stored.linkUserId) {
    const result = await attachProviderToExistingUser(stored.linkUserId, profile);
    if (!result.ok) {
      redirectToConnectedAccounts(
        res,
        result.reason === "already_linked_to_self" ? "already_linked" : "in_use_elsewhere",
      );
      return;
    }
    redirectToConnectedAccounts(res, "connected");
    return;
  }

  // Sign-in / sign-up flow.
  let user;
  try {
    user = await resolveUserForProviderProfile(profile);
  } catch (err) {
    logger.error({ err, provider }, "social-auth: failed to resolve user");
    redirectToSignInError(res, "user_resolve_failed");
    return;
  }

  const metadata = captureSessionMetadata(req);
  let historicallySeen = true;
  try {
    historicallySeen = await hasSeenSessionMetadata({
      userId: user.id,
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
    });
  } catch (err) {
    logger.error({ err }, "social-auth: hasSeenSessionMetadata failed");
  }

  let token: string;
  try {
    const session = await createSession(user.id, metadata);
    token = session.token;
  } catch (err) {
    logger.error({ err, provider }, "social-auth: failed to create session");
    redirectToSignInError(res, "session_failed");
    return;
  }

  if (!historicallySeen && resolveNotificationPreferences(user.notificationPreferences).newSignIn) {
    void notifyNewSignIn({ name: user.name, email: user.email }, metadata, req);
  }

  // Hand off to the SPA via URL fragment (same mechanism as Replit OIDC).
  const target = `${APP_LANDING_PATH}#social_token=${encodeURIComponent(token)}&provider=${encodeURIComponent(provider)}`;
  res.redirect(target);
}

export default router;
