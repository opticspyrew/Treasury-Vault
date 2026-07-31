import type { NotificationPreferences } from "@workspace/db";

/**
 * Default state for users who have never changed their notification settings:
 * every non-critical email is enabled. Stored as null in the DB and resolved
 * here so existing accounts behave exactly as before this feature shipped.
 */
export const NOTIFICATION_DEFAULTS: NotificationPreferences = {
  kycDecisions: true,
  newSignIn: true,
  recoveryCredits: true,
};

/**
 * Turn the raw (possibly null/partial) jsonb column into a complete, typed
 * preferences object. Any missing key falls back to enabled so a newly added
 * category is opt-out, never silently suppressed.
 */
export function resolveNotificationPreferences(
  raw: NotificationPreferences | null | undefined,
): NotificationPreferences {
  return {
    kycDecisions: raw?.kycDecisions ?? NOTIFICATION_DEFAULTS.kycDecisions,
    newSignIn: raw?.newSignIn ?? NOTIFICATION_DEFAULTS.newSignIn,
    recoveryCredits: raw?.recoveryCredits ?? NOTIFICATION_DEFAULTS.recoveryCredits,
  };
}
