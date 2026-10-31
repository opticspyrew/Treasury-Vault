export function isConfiguredWalletAddress(
  address: unknown
): address is string {
  if (typeof address !== "string") return false;

  const value = address.trim();

  if (!value || value.length < 20 || value.length > 256) {
    return false;
  }

  const blocked = [
    "CONFIGURE_IN_ADMIN_DASHBOARD",
    "PLACEHOLDER",
    "REPLACE_WITH_REAL_ADDRESS",
    "YOUR_WALLET_ADDRESS",
  ];

  if (blocked.some(word =>
    value.toUpperCase().includes(word)
  )) {
    return false;
  }

  return /^[a-zA-Z0-9:_-]+$/.test(value);
}
