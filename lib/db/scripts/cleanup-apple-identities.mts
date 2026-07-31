// One-time cleanup: Apple sign-in was removed. Drop leftover identity rows
// so the UI and /providers/linked don't reference an unsupported provider.
// Users whose ONLY sign-in method was Apple (no password, no other provider)
// are SKIPPED to avoid stranding them; a warning is logged instead.
//
// Run from the project root after migrations:
//   pnpm --filter db exec tsx ../../scripts/cleanup-apple-identities.mjs
import { pool } from "../src/index.js";

async function main() {
  const stranded = await pool.query(`
    SELECT pi.user_id, u.email
    FROM provider_identities pi
    JOIN users u ON u.id = pi.user_id
    WHERE pi.provider = 'apple'
      AND u.password_hash IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM provider_identities pi2
        WHERE pi2.user_id = pi.user_id AND pi2.provider <> 'apple'
      );
  `);
  if (stranded.rows.length > 0) {
    console.warn(
      `[apple-cleanup] WARNING: ${stranded.rows.length} user(s) only have Apple sign-in; keeping their rows so they are not locked out. Contact them to set a password or link Google:`,
    );
    for (const r of stranded.rows) {
      console.warn(`  - user_id=${r.user_id} email=${r.email}`);
    }
  }
  const del = await pool.query(`
    DELETE FROM provider_identities
    WHERE provider = 'apple'
      AND (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = provider_identities.user_id AND u.password_hash IS NOT NULL
        )
        OR EXISTS (
          SELECT 1 FROM provider_identities pi2
          WHERE pi2.user_id = provider_identities.user_id AND pi2.provider <> 'apple'
        )
      );
  `);
  console.log(`[apple-cleanup] Removed ${del.rowCount} apple provider_identities row(s).`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("[apple-cleanup] failed:", err);
    pool.end().finally(() => process.exit(1));
  });
