import { useState, useEffect, useRef } from "react";
import { authApi } from "@/lib/api";

export type StatusType = "investigation" | "completed" | "pending" | "processing";

export interface Transaction {
  id: string;
  type: string;
  asset: string;
  amount: string;
  usdAmount?: number;
  date: string;
  status: string;
  statusType: StatusType;
  address: string;
  blockConfirmations?: number;
  blockConfirmStart?: number;
}

export function useBlockConfirmations(tx: Transaction) {
  const [count, setCount] = useState(tx.blockConfirmations ?? 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallTarget = useRef(Math.random() < 0.6 ? 7 : 8);

  useEffect(() => {
    if (tx.statusType !== "processing") return;

    const startFrom = tx.blockConfirmations ?? 0;
    setCount(startFrom);

    if (startFrom >= stallTarget.current) return;

    intervalRef.current = setInterval(() => {
      setCount(prev => {
        const next = prev + 1;
        if (next >= stallTarget.current) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return stallTarget.current;
        }
        return next;
      });
    }, 3500 + Math.random() * 2500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tx.id, tx.statusType]);

  return count;
}

const INVOICE_CTX_KEY = "cryptovault_invoice_ctx";

export function saveInvoiceContext(tx: { usdAmount: number; asset: string; rawAmount: string; txId: string }) {
  try {
    localStorage.setItem(INVOICE_CTX_KEY, JSON.stringify(tx));
  } catch {}
}

export function loadInvoiceContext(): { usdAmount: number; asset: string; rawAmount: string; txId: string } | null {
  try {
    const raw = localStorage.getItem(INVOICE_CTX_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const PAYMENT_CONFIRMATION_KEY_PREFIX = "cryptovault_payment_confirmation:";
const PAYMENT_CONFIRMATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PaymentConfirmationRecord {
  txId: string;
  publicToken: string;
  approvedHandled?: boolean;
  savedAt?: number;
}

function paymentConfirmationKey(txId: string): string | null {
  if (!txId) return null;
  return `${PAYMENT_CONFIRMATION_KEY_PREFIX}${txId}`;
}

export function savePaymentConfirmation(rec: PaymentConfirmationRecord) {
  const key = paymentConfirmationKey(rec.txId);
  if (!key) return;
  try {
    const withTs: PaymentConfirmationRecord = { ...rec, savedAt: rec.savedAt ?? Date.now() };
    localStorage.setItem(key, JSON.stringify(withTs));
  } catch {}
}

export function loadPaymentConfirmation(txId: string): PaymentConfirmationRecord | null {
  const key = paymentConfirmationKey(txId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PaymentConfirmationRecord;
    if (!parsed?.txId || !parsed?.publicToken || parsed.txId !== txId) {
      localStorage.removeItem(key);
      return null;
    }
    // Treat missing/invalid `savedAt` (legacy records) as stale.
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > PAYMENT_CONFIRMATION_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPaymentConfirmation(txId: string) {
  const key = paymentConfirmationKey(txId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

const STORAGE_KEY = "cryptovault_transactions";

const seedTransactions: Transaction[] = [
  {
    id: "txn-002",
    type: "Deposit",
    asset: "BTC",
    amount: "+0.1500 BTC",
    date: "Apr 05, 2026",
    status: "Completed",
    statusType: "completed",
    address: "External Wallet",
  },
  {
    id: "txn-003",
    type: "Trade",
    asset: "ETH",
    amount: "+1.20 ETH",
    date: "Apr 02, 2026",
    status: "Completed",
    statusType: "completed",
    address: "BTC → ETH",
  },
  {
    id: "txn-004",
    type: "Deposit",
    asset: "USDT",
    amount: "+5,000 USDT",
    date: "Mar 29, 2026",
    status: "Completed",
    statusType: "completed",
    address: "Bank Transfer",
  },
];

function loadFromStorage(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveToStorage(seedTransactions);
      return seedTransactions;
    }
    const parsed = JSON.parse(raw) as Transaction[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveToStorage(seedTransactions);
      return seedTransactions;
    }
    // Migration: remove the old hard-coded incomplete seed transaction
    const migrated = parsed.filter(tx => tx.id !== "txn-001");
    if (migrated.length !== parsed.length) {
      saveToStorage(migrated);
      return migrated;
    }
    return parsed;
  } catch {
    saveToStorage(seedTransactions);
    return seedTransactions;
  }
}

function saveToStorage(txns: Transaction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(TXNS_EVENT));
    }
  } catch {
  }
}

const TXNS_EVENT = "cryptovault:transactions-changed";

export function pushTransaction(
  tx: Omit<Transaction, "id" | "date" | "status" | "statusType"> &
    Partial<Pick<Transaction, "id" | "status" | "statusType" | "date">>,
): string {
  const now = new Date();
  const dateStr = tx.date ?? now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const newTx: Transaction = {
    id: tx.id ?? `txn-${Date.now()}`,
    date: dateStr,
    status: tx.status ?? "Completed",
    statusType: tx.statusType ?? "completed",
    type: tx.type,
    asset: tx.asset,
    amount: tx.amount,
    address: tx.address,
    usdAmount: tx.usdAmount,
    blockConfirmations: tx.blockConfirmations,
    blockConfirmStart: tx.blockConfirmStart,
  };
  const current = loadFromStorage();
  saveToStorage([newTx, ...current]);
  return newTx.id;
}

function escalateStatuses(txns: Transaction[]): { txns: Transaction[]; changed: boolean } {
  let changed = false;
  const updated = txns.map(tx => {
    if (tx.statusType === "pending") {
      changed = true;
      return {
        ...tx,
        statusType: "processing" as StatusType,
        status: "Processing",
        blockConfirmations: 0,
        blockConfirmStart: Date.now(),
      };
    }
    if (tx.statusType === "processing") {
      const elapsed = Date.now() - (tx.blockConfirmStart ?? Date.now());
      if (elapsed > 90000) {
        changed = true;
        return { ...tx, statusType: "investigation" as StatusType, status: "Under Investigation" };
      }
    }
    return tx;
  });
  return { txns: updated, changed };
}

export function useTransactions() {
  const [transactions, setTransactionsState] = useState<Transaction[]>(() => {
    const loaded = loadFromStorage();
    const { txns, changed } = escalateStatuses(loaded);
    if (changed) saveToStorage(txns);
    return txns;
  });

  function setTransactions(updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) {
    setTransactionsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveToStorage(next);
      return next;
    });
  }

  function addTransaction(tx: Omit<Transaction, "id" | "date" | "status" | "statusType"> & Partial<Pick<Transaction, "status" | "statusType">>) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    const newTx: Transaction = {
      id: `txn-${Date.now()}`,
      date: dateStr,
      status: tx.status ?? "Pending",
      statusType: tx.statusType ?? "pending",
      ...tx,
    };
    setTransactions(prev => [newTx, ...prev]);
    return newTx.id;
  }

  async function cancelTransaction(id: string, token: string): Promise<void> {
    // Do not erase a transaction locally unless the server confirms cancellation.
    await authApi.cancelPendingTransaction(token, id);
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  }

  return { transactions, addTransaction, cancelTransaction, setTransactions };
}
