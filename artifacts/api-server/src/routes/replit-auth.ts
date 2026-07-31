import { Router, type IRouter, type Request, type Response } from "express";
import * as client from "openid-client";
import { db, users, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession, normalizeEmail } from "../lib/auth";
import { getCallbackUrl, getOidcConfig } from "../lib/replit-oidc";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const STATE_COOKIE = "cv_replit_state";
const VERIFIER_COOKIE = "cv_replit_verifier";
const NONCE_COOKIE = "cv_replit_nonce";
const COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

const APP_LANDING_URL = "/dashboard";
const SIGN_IN_PATH = "/sign-in";

function setShortCookie(res: Response, name: string, value: string) {
  const isProd = process.env["NODE_ENV"] === "production";
  res.cookie(name, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/api/auth/replit",
  });
}

function clearShortCookie(res: Response, name: string) {
  res.clearCookie(name, { path: "/api/auth/replit" });
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = val;
  }
  return out;
}

function getRequestIp(req: Request): string | null {
  const ip = req.ip;
  return typeof ip === "string" && ip.length > 0 ? ip : null;
}

function getRequestUserAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" && ua.length > 0 ? ua : null;
}

function redirectToError(res: Response, code: string) {
  const target = `${SIGN_IN_PATH}?replit_error=${encodeURIComponent(code)}`;
  res.redirect(target);
}

router.get("/login", async (_req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

    setShortCookie(res, STATE_COOKIE, state);
    setShortCookie(res, NONCE_COOKIE, nonce);
    setShortCookie(res, VERIFIER_COOKIE, codeVerifier);

    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: getCallbackUrl(),
      scope: "openid profile email",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "login",
    });

    res.redirect(authUrl.toString());
  } catch (err) {
    logger.error({ err }, "replit-auth: failed to start login");
    redirectToError(res, "start_failed");
  }
});

interface ReplitClaims {
  sub: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

router.get("/callback", async (req: Request, res: Response) => {
  const cookies = parseCookieHeader(req.headers["cookie"]);
  const state = cookies[STATE_COOKIE];
  const nonce = cookies[NONCE_COOKIE];
  const codeVerifier = cookies[VERIFIER_COOKIE];

  clearShortCookie(res, STATE_COOKIE);
  clearShortCookie(res, NONCE_COOKIE);
  clearShortCookie(res, VERIFIER_COOKIE);

  if (!state || !nonce || !codeVerifier) {
    logger.warn("replit-auth: missing PKCE cookies in callback");
    redirectToError(res, "missing_state");
    return;
  }

  let claims: ReplitClaims;
  try {
    const config = await getOidcConfig();
    const currentUrl = new URL(
      req.originalUrl,
      `https://${req.headers["host"] ?? "localhost"}`,
    );
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
      expectedNonce: nonce,
      idTokenExpected: true,
    });
    const rawClaims = tokens.claims();
    if (!rawClaims || typeof rawClaims["sub"] !== "string") {
      throw new Error("Missing sub in id_token claims");
    }
    claims = rawClaims as unknown as ReplitClaims;
  } catch (err) {
    logger.error({ err }, "replit-auth: token exchange failed");
    redirectToError(res, "exchange_failed");
    return;
  }

  const email = typeof claims.email === "string" ? normalizeEmail(claims.email) : null;
  if (!email) {
    logger.warn({ sub: claims.sub }, "replit-auth: no email in claims");
    redirectToError(res, "no_email");
    return;
  }

  const displayName =
    (typeof claims.name === "string" && claims.name.trim()) ||
    [claims.first_name, claims.last_name].filter((v) => typeof v === "string" && v.trim().length > 0).join(" ").trim() ||
    (typeof claims.username === "string" && claims.username.trim()) ||
    email.split("@")[0];

  let user: User | undefined;

  // 1) Try to find by replit_sub (already linked).
  const [bySub] = await db.select().from(users).where(eq(users.replitSub, claims.sub)).limit(1);
  if (bySub) {
    user = bySub;
  } else {
    // 2) Try to find by email (auto-link).
    const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (byEmail) {
      // Refuse to relink an existing account that was already linked to a
      // different Replit subject — that would be an account takeover vector.
      if (byEmail.replitSub && byEmail.replitSub !== claims.sub) {
        logger.warn(
          { userId: byEmail.id, existingSub: byEmail.replitSub, incomingSub: claims.sub },
          "replit-auth: refused to relink account already bound to a different Replit subject",
        );
        redirectToError(res, "link_conflict");
        return;
      }
      const [linked] = await db
        .update(users)
        .set({ replitSub: claims.sub, updatedAt: new Date() })
        .where(eq(users.id, byEmail.id))
        .returning();
      user = linked ?? byEmail;
    } else {
      // 3) Create a new account with no password (Replit-only).
      const [created] = await db
        .insert(users)
        .values({
          email,
          name: displayName,
          replitSub: claims.sub,
        })
        .returning();
      user = created;
    }
  }

  if (!user) {
    logger.error("replit-auth: failed to resolve user after callback");
    redirectToError(res, "user_resolve_failed");
    return;
  }

  let token: string;
  try {
    const session = await createSession(user.id, {
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
    });
    token = session.token;
  } catch (err) {
    logger.error({ err }, "replit-auth: failed to create session");
    redirectToError(res, "session_failed");
    return;
  }

  // Hand off to the SPA via URL fragment (not sent to servers / not logged).
  const target = `${APP_LANDING_URL}#replit_token=${encodeURIComponent(token)}`;
  res.redirect(target);
});

export default router;
