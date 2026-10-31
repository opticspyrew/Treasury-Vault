import { db } from "@workspace/db";
import { cryptoWalletConfigs } from "@workspace/db";
import { count } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_WALLET_STUBS = [
  { symbol: "BTC",  network: "Bitcoin",    sortOrder: 10 },
  { symbol: "USDT", network: "TRC20",      sortOrder: 20 },
  { symbol: "USDT", network: "ERC20",      sortOrder: 21 },
  { symbol: "USDC", network: "ERC20",      sortOrder: 30 },
  { symbol: "USDC", network: "SOL",        sortOrder: 31 },
  { symbol: "ETH",  network: "ERC20",      sortOrder: 40 },
  { symbol: "SOL",  network: "Solana",     sortOrder: 50 },
  { symbol: "XRP",  network: "XRP Ledger", sortOrder: 60 },
  { symbol: "BNB",  network: "BEP20",      sortOrder: 70 },
];

export const PLACEHOLDER_ADDRESS = "CONFIGURE_IN_ADMIN_DASHBOARD";

export async function seedDefaultWallets(): Promise<void> {
  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(cryptoWalletConfigs);
    if (Number(existing) > 0) {
      logger.info({ existing }, "Wallet configs already seeded — skipping");
      return;
    }
    await db.insert(cryptoWalletConfigs).values(
      DEFAULT_WALLET_STUBS.map(w => ({
        symbol: w.symbol,
        network: w.network,
        address: PLACEHOLDER_ADDRESS,
        label: "⚠ Admin: replace with real address",
        isActive: false,
        sortOrder: w.sortOrder,
      }))
    );
    logger.info({ count: DEFAULT_WALLET_STUBS.length }, "Seeded default wallet config stubs — admin must update addresses before going live");
  } catch (err) {
    logger.warn({ err }, "seedDefaultWallets: non-fatal error seeding wallet stubs");
  }
}
