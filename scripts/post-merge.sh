#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push-force
pnpm --filter db run seed-wallets

# One-time cleanup: Apple sign-in was removed; drop any leftover identity rows
# so the UI and /providers/linked don't reference an unsupported provider.
# Users whose ONLY sign-in method was Apple (no password, no other provider)
# are skipped to avoid stranding them — a warning is logged instead.
if [ -n "$DATABASE_URL" ]; then
  pnpm --filter db exec tsx scripts/cleanup-apple-identities.mts \
    || echo "[post-merge] apple cleanup skipped (non-fatal)"
fi
