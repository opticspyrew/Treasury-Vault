import { db, loginThrottleAttempts } from "@workspace/db";
import { and, eq, gte, lt, min, sql } from "drizzle-orm";
import { logger } from "./logger";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES_PER_ACCOUNT = 10;
const LOGIN_MAX_ATTEMPTS_PER_IP = 20;

const ACCOUNT_SCOPE = "account";
const IP_SCOPE = "ip";

export type LoginThrottleResult =
  | { allowed: true }
  | { allowed: false; reason: "account" | "ip"; retryAfterMs: number };

async function countAndOldest(
  scope: string,
  key: string,
  cutoff: Date,
): Promise<{ count: number; oldest: Date | null }> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      oldest: min(loginThrottleAttempts.occurredAt),
    })
    .from(loginThrottleAttempts)
    .where(
      and(
        eq(loginThrottleAttempts.scope, scope),
        eq(loginThrottleAttempts.key, key),
        gte(loginThrottleAttempts.occurredAt, cutoff),
      ),
    );
  return {
    count: row?.count ?? 0,
    oldest: (row?.oldest as Date | null | undefined) ?? null,
  };
}

export async function checkLoginThrottle(
  email: string,
  ip: string,
  now: number = Date.now(),
): Promise<LoginThrottleResult> {
  const cutoff = new Date(now - LOGIN_WINDOW_MS);

  const account = await countAndOldest(ACCOUNT_SCOPE, email, cutoff);
  if (account.count >= LOGIN_MAX_FAILURES_PER_ACCOUNT) {
    const oldestMs = account.oldest ? account.oldest.getTime() : now;
    return {
      allowed: false,
      reason: "account",
      retryAfterMs: Math.max(0, oldestMs + LOGIN_WINDOW_MS - now),
    };
  }

  const ipBucket = await countAndOldest(IP_SCOPE, ip, cutoff);
  if (ipBucket.count >= LOGIN_MAX_ATTEMPTS_PER_IP) {
    const oldestMs = ipBucket.oldest ? ipBucket.oldest.getTime() : now;
    return {
      allowed: false,
      reason: "ip",
      retryAfterMs: Math.max(0, oldestMs + LOGIN_WINDOW_MS - now),
    };
  }

  // Record this attempt against the IP bucket so repeated calls — even from
  // many different (possibly nonexistent) accounts — eventually trip the
  // per-IP limit.
  await db.insert(loginThrottleAttempts).values({
    scope: IP_SCOPE,
    key: ip,
    occurredAt: new Date(now),
  });

  return { allowed: true };
}

export interface LoginThrottleStatus {
  failureCount: number;
  locked: boolean;
  retryAfterMs: number;
  maxFailures: number;
  windowMs: number;
}

/**
 * Read-only inspection of the per-account failure bucket for `email`.
 * Returns the current failure count within the rolling window, whether the
 * account is currently locked out, and how long until the oldest failure
 * ages out. Does NOT record an attempt. Safe to call from admin endpoints.
 */
export async function getAccountThrottleStatus(
  email: string,
  now: number = Date.now(),
): Promise<LoginThrottleStatus> {
  const cutoff = new Date(now - LOGIN_WINDOW_MS);
  const account = await countAndOldest(ACCOUNT_SCOPE, email, cutoff);
  const locked = account.count >= LOGIN_MAX_FAILURES_PER_ACCOUNT;
  const retryAfterMs = locked && account.oldest
    ? Math.max(0, account.oldest.getTime() + LOGIN_WINDOW_MS - now)
    : 0;
  return {
    failureCount: account.count,
    locked,
    retryAfterMs,
    maxFailures: LOGIN_MAX_FAILURES_PER_ACCOUNT,
    windowMs: LOGIN_WINDOW_MS,
  };
}

export interface RecordLoginFailureResult {
  failureCount: number;
  maxFailures: number;
  /**
   * True iff this particular failed attempt crossed the lockout threshold for
   * the first time in the current rolling window. Once an account is locked,
   * subsequent attempts are rejected by `checkLoginThrottle` before they ever
   * reach `recordLoginFailure`, so this transition fires exactly once per
   * lockout window — making it a safe trigger for one-shot admin alerts.
   */
  justLocked: boolean;
}

export async function recordLoginFailure(
  email: string,
  now: number = Date.now(),
): Promise<RecordLoginFailureResult> {
  await db.insert(loginThrottleAttempts).values({
    scope: ACCOUNT_SCOPE,
    key: email,
    occurredAt: new Date(now),
  });
  const cutoff = new Date(now - LOGIN_WINDOW_MS);
  const { count } = await countAndOldest(ACCOUNT_SCOPE, email, cutoff);
  return {
    failureCount: count,
    maxFailures: LOGIN_MAX_FAILURES_PER_ACCOUNT,
    justLocked: count === LOGIN_MAX_FAILURES_PER_ACCOUNT,
  };
}

export async function clearLoginFailures(email: string): Promise<void> {
  await db
    .delete(loginThrottleAttempts)
    .where(
      and(
        eq(loginThrottleAttempts.scope, ACCOUNT_SCOPE),
        eq(loginThrottleAttempts.key, email),
      ),
    );
}

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer: NodeJS.Timeout | null = null;

async function pruneExpiredAttempts(now: number = Date.now()): Promise<void> {
  const cutoff = new Date(now - LOGIN_WINDOW_MS);
  try {
    await db
      .delete(loginThrottleAttempts)
      .where(lt(loginThrottleAttempts.occurredAt, cutoff));
  } catch (err) {
    logger.error({ err }, "Failed to prune expired login-throttle attempts");
  }
}

export function startLoginThrottleCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    void pruneExpiredAttempts();
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}
