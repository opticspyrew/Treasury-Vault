// Single source of truth for the user-facing support contact address.
// Every notification (password emails, login alerts, admin notifications,
// KYC + payment decision emails) resolves the support address from here so
// the value stays consistent and the literal fallback can never drift.
//
// Override with the SUPPORT_EMAIL environment variable; otherwise the
// DEFAULT_SUPPORT_EMAIL literal below is used.
const DEFAULT_SUPPORT_EMAIL = "Opticspycrew@gmail.com";

export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
