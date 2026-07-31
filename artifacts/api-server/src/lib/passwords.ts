import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

export const PBKDF2_ITERATIONS = 210_000;
export const PBKDF2_KEY_LENGTH = 32;
export const PBKDF2_DIGEST = "sha256";
const SALT_BYTES = 16;

export interface HashedPassword {
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}

export async function hashPassword(password: string): Promise<HashedPassword> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await pbkdf2Async(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST,
  );
  return {
    passwordHash: derived.toString("base64"),
    passwordSalt: salt.toString("base64"),
    passwordIterations: PBKDF2_ITERATIONS,
  };
}

export interface MaybeHashedPassword {
  passwordHash: string | null;
  passwordSalt: string | null;
  passwordIterations: number | null;
}

export async function verifyPassword(
  password: string,
  stored: MaybeHashedPassword,
): Promise<boolean> {
  if (
    !stored.passwordHash ||
    !stored.passwordSalt ||
    !stored.passwordIterations
  ) {
    return false;
  }
  try {
    const salt = Buffer.from(stored.passwordSalt, "base64");
    const expected = Buffer.from(stored.passwordHash, "base64");
    const candidate = await pbkdf2Async(
      password,
      salt,
      stored.passwordIterations,
      expected.length,
      PBKDF2_DIGEST,
    );
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
