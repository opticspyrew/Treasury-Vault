const STORAGE_KEY = "cryptovault.login_attempts";
const EVENT = "cryptovault:login-throttle-changed";

export const FREE_ATTEMPTS = 4;
export const BASE_LOCKOUT_MS = 30_000;
export const MAX_LOCKOUT_MS = 15 * 60_000;

type AttemptRecord = {
  failures: number;
  lockedUntil: number;
};

type AttemptMap = Record<string, AttemptRecord>;

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function loadAll(): AttemptMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: AttemptMap = {};
      for (const [email, rec] of Object.entries(parsed as Record<string, unknown>)) {
        if (
          rec &&
          typeof rec === "object" &&
          typeof (rec as AttemptRecord).failures === "number" &&
          typeof (rec as AttemptRecord).lockedUntil === "number"
        ) {
          out[email] = {
            failures: Math.max(0, Math.floor((rec as AttemptRecord).failures)),
            lockedUntil: Math.max(0, (rec as AttemptRecord).lockedUntil),
          };
        }
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

function saveAll(map: AttemptMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore
  }
}

export function lockoutMsForFailures(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  const overflow = failures - FREE_ATTEMPTS - 1;
  const ms = BASE_LOCKOUT_MS * Math.pow(2, overflow);
  return Math.min(ms, MAX_LOCKOUT_MS);
}

export function getLockoutState(email: string): {
  locked: boolean;
  msRemaining: number;
  failures: number;
  lockedUntil: number;
} {
  const key = normalize(email);
  if (!key) return { locked: false, msRemaining: 0, failures: 0, lockedUntil: 0 };
  const map = loadAll();
  const rec = map[key];
  if (!rec) return { locked: false, msRemaining: 0, failures: 0, lockedUntil: 0 };
  const now = Date.now();
  const msRemaining = Math.max(0, rec.lockedUntil - now);
  return {
    locked: msRemaining > 0,
    msRemaining,
    failures: rec.failures,
    lockedUntil: rec.lockedUntil,
  };
}

export function recordFailure(email: string): {
  locked: boolean;
  msRemaining: number;
  failures: number;
} {
  const key = normalize(email);
  if (!key) return { locked: false, msRemaining: 0, failures: 0 };
  const map = loadAll();
  const prev = map[key] ?? { failures: 0, lockedUntil: 0 };
  const failures = prev.failures + 1;
  const lockoutMs = lockoutMsForFailures(failures);
  const lockedUntil = lockoutMs > 0 ? Date.now() + lockoutMs : 0;
  map[key] = { failures, lockedUntil };
  saveAll(map);
  return { locked: lockoutMs > 0, msRemaining: lockoutMs, failures };
}

export function recordSuccess(email: string): void {
  const key = normalize(email);
  if (!key) return;
  const map = loadAll();
  if (key in map) {
    delete map[key];
    saveAll(map);
  }
}

/**
 * Clear any failure/lockout state tracked for `email` on this device.
 * Equivalent in effect to recordSuccess; exposed under a dedicated name so
 * callers that need to express "admin unlocked this account" intent can do
 * so without implying the user actually signed in successfully here.
 *
 * Note: this only clears the per-browser localStorage record on the device
 * it runs in. The authoritative throttle for sign-in lives on the server
 * (see api-server's login-throttle.ts → clearLoginFailures), which is what
 * the admin "Unlock sign-in" action targets via the API.
 */
export function clearLockout(email: string): void {
  recordSuccess(email);
}

export function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function formatRemaining(msRemaining: number): string {
  const totalSeconds = Math.ceil(msRemaining / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes}m ${seconds}s`;
}

export class LoginLockoutError extends Error {
  msRemaining: number;
  failures: number;
  constructor(msRemaining: number, failures: number) {
    super(
      `Too many failed sign-in attempts. Please wait ${formatRemaining(msRemaining)} and try again.`,
    );
    this.name = "LoginLockoutError";
    this.msRemaining = msRemaining;
    this.failures = failures;
  }
}
