import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Request, Response } from "express";
import { db, users, providerIdentities, type User } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger";
import { normalizeEmail } from "./auth";
import {
  getGoogleConfig,
  type SocialProvider,
} from "./social-providers";

const STATE_COOKIE_PREFIX = "cv_oauth_";
const COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

export function stateCookieName(provider: SocialProvider): string {
  return `${STATE_COOKIE_PREFIX}${provider}`;
}

export interface OAuthStatePayload {
  state: string;
  nonce: string;
  codeVerifier: string;
  /** When set, this flow is a "link to existing account" rather than sign-in. */
  linkUserId?: number;
}

export function setStateCookie(res: Response, provider: SocialProvider, payload: OAuthStatePayload) {
  const isProd = process.env["NODE_ENV"] === "production";
  res.cookie(stateCookieName(provider), JSON.stringify(payload), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/api/auth",
  });
}

export function clearStateCookie(res: Response, provider: SocialProvider) {
  res.clearCookie(stateCookieName(provider), { path: "/api/auth" });
}

export function readStateCookie(req: Request, provider: SocialProvider): OAuthStatePayload | null {
  const header = req.headers["cookie"];
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key !== stateCookieName(provider)) continue;
    try {
      const raw = decodeURIComponent(part.slice(eq + 1).trim());
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.state === "string" &&
        typeof parsed.nonce === "string" &&
        typeof parsed.codeVerifier === "string"
      ) {
        return parsed as OAuthStatePayload;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function pkceChallengeFromVerifier(verifier: string): Promise<string> {
  return createHash("sha256").update(verifier).digest("base64url");
}

export interface ProviderProfile {
  provider: SocialProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Resolve a provider profile to a User row, applying the link/return/create logic:
 *   1. If a provider_identities row exists for (provider, providerUserId), return that user.
 *   2. Else if a user exists with the same verified email, attach a new provider_identities
 *      row to them (auto-link) and return that user.
 *   3. Else create a brand-new user and a provider_identities row.
 */
export async function resolveUserForProviderProfile(
  profile: ProviderProfile,
): Promise<User> {
  const normalizedEmail = normalizeEmail(profile.email);

  // 1. Already linked?
  const [existingLink] = await db
    .select()
    .from(providerIdentities)
    .where(
      and(
        eq(providerIdentities.provider, profile.provider),
        eq(providerIdentities.providerUserId, profile.providerUserId),
      ),
    )
    .limit(1);
  if (existingLink) {
    const [user] = await db.select().from(users).where(eq(users.id, existingLink.userId)).limit(1);
    if (user) return user;
    logger.warn(
      { linkId: existingLink.id, userId: existingLink.userId },
      "social-oauth: orphaned provider identity (user missing); will fall through",
    );
  }

  // 2. Email match? (only if provider says the email is verified)
  if (profile.emailVerified) {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (byEmail) {
      await db.insert(providerIdentities).values({
        userId: byEmail.id,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        emailAtLink: normalizedEmail,
      });
      logger.info(
        { userId: byEmail.id, provider: profile.provider },
        "social-oauth: linked provider identity to existing email-matched account",
      );
      return byEmail;
    }
  }

  // 3. Create.
  const displayName = profile.name?.trim() || normalizedEmail.split("@")[0];
  const [created] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name: displayName,
    })
    .returning();
  await db.insert(providerIdentities).values({
    userId: created.id,
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    emailAtLink: normalizedEmail,
  });
  logger.info(
    { userId: created.id, provider: profile.provider },
    "social-oauth: created new account for first-time social sign-in",
  );
  return created;
}

export async function attachProviderToExistingUser(
  userId: number,
  profile: ProviderProfile,
): Promise<{ ok: true } | { ok: false; reason: "already_linked_to_other" | "already_linked_to_self" }> {
  const [existing] = await db
    .select()
    .from(providerIdentities)
    .where(
      and(
        eq(providerIdentities.provider, profile.provider),
        eq(providerIdentities.providerUserId, profile.providerUserId),
      ),
    )
    .limit(1);
  if (existing) {
    if (existing.userId === userId) return { ok: false, reason: "already_linked_to_self" };
    return { ok: false, reason: "already_linked_to_other" };
  }
  await db.insert(providerIdentities).values({
    userId,
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    emailAtLink: normalizeEmail(profile.email),
  });
  return { ok: true };
}

// --- Google ----------------------------------------------------------------

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const qs = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: "openid email profile",
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${qs.toString()}`;
}

export async function exchangeGoogleCode(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ idToken: string }> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code_verifier: params.codeVerifier,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("Google token response missing id_token");
  return { idToken: data.id_token };
}

export async function verifyGoogleIdToken(params: {
  idToken: string;
  clientId: string;
  expectedNonce: string;
}): Promise<ProviderProfile> {
  const { payload } = await jwtVerify(params.idToken, GOOGLE_JWKS, {
    audience: params.clientId,
    issuer: GOOGLE_ISSUERS,
  });
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Google id_token missing sub");
  }
  if (typeof payload.nonce !== "string" || payload.nonce !== params.expectedNonce) {
    throw new Error("Google id_token nonce mismatch");
  }
  const email = typeof payload.email === "string" ? payload.email : "";
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  if (!email || !emailVerified) {
    throw new Error("Google id_token email missing or unverified");
  }
  const name =
    (typeof payload.name === "string" && payload.name) ||
    [payload.given_name, payload.family_name]
      .filter((v) => typeof v === "string" && v)
      .join(" ")
      .trim() ||
    null;
  return {
    provider: "google",
    providerUserId: payload.sub,
    email,
    emailVerified: true,
    name,
  };
}

export function getProviderConfigStatus(): Record<SocialProvider, boolean> {
  return {
    google: !!getGoogleConfig(),
  };
}
