export type SocialProvider = "google";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * When set, the social OAuth flow runs against an in-app fake provider instead
 * of real Google. This lets the sign-in/connect journey be exercised
 * end-to-end (including in a browser) without configuring real credentials.
 *
 * Gated to non-production so it can never become a "sign in as anyone"
 * backdoor on a deployed app: even if the env var leaks into production, it is
 * ignored there.
 */
export function isSocialOAuthTestMode(): boolean {
  return (
    process.env.SOCIAL_OAUTH_TEST_MODE === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

export function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (clientId && clientSecret) return { clientId, clientSecret };
  // In test mode, report a stub config so the provider counts as "configured"
  // (buttons render, /providers/config returns google:true). The actual token
  // exchange is bypassed in the callback, so these values are never sent
  // anywhere.
  if (isSocialOAuthTestMode()) {
    return { clientId: "test-google-client", clientSecret: "test-google-secret" };
  }
  return null;
}

export function isProviderConfigured(provider: SocialProvider): boolean {
  return provider === "google" ? !!getGoogleConfig() : false;
}
