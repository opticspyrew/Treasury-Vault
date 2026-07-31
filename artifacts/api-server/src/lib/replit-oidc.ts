import * as client from "openid-client";

const ISSUER_URL = "https://replit.com/oidc";

let configPromise: Promise<client.Configuration> | null = null;

export function getReplId(): string {
  const id = process.env["REPL_ID"];
  if (!id) {
    throw new Error("REPL_ID environment variable is required for Replit Auth");
  }
  return id;
}

export function getReplitDomain(): string {
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (!domain) {
    throw new Error("REPLIT_DEV_DOMAIN or REPLIT_DOMAINS must be set for Replit Auth");
  }
  return domain;
}

export async function getOidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    configPromise = client.discovery(new URL(ISSUER_URL), getReplId()).catch((err) => {
      configPromise = null;
      throw err;
    });
  }
  return configPromise;
}

export function getCallbackUrl(): string {
  return `https://${getReplitDomain()}/api/auth/replit/callback`;
}
