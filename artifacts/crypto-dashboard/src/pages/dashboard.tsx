import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/dashboard-layout";
import WalletModal from "@/components/wallet-modal";
import KycModal from "@/components/kyc-modal";
import { useKyc } from "@/hooks/use-kyc";
import OverviewGraphPanel from "@/components/overview-graph-panel";
import TransactionReceiptModal from "@/components/transaction-receipt";
import { useTransactions, saveInvoiceContext, useBlockConfirmations, type Transaction } from "@/hooks/use-transactions";
import { useBalance } from "@/hooks/use-balance";
import { useApprovalPoller } from "@/hooks/use-approval-poller";
import { useCurrency } from "@/lib/currency-context";

function BlockConfirmationLabel({ tx }: { tx: Transaction }) {
  const count = useBlockConfirmations(tx);
  return (
    <p className="text-xs font-semibold text-red-500 mt-1 font-mono tracking-wide">
      Block Confirmation {count}/10
    </p>
  );
}

type ModalType = "receive" | "deposit" | null;

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [modal, setModal] = useState<ModalType>(null);
  const [kycModal, setKycModal] = useState<{ open: boolean; reason?: string }>({ open: false });
  const { status: kycStatus } = useKyc();

  const requireKyc = (action: "Send" | "Withdraw", run: () => void) => {
    if (kycStatus === "approved") {
      run();
    } else {
      const reason = kycStatus === "pending"
        ? `Your identity verification is still under review. ${action} will be enabled once approved.`
        : kycStatus === "rejected"
          ? `Your last verification was rejected. Please re-submit to ${action.toLowerCase()}.`
          : `Identity verification is required before you can ${action.toLowerCase()}.`;
      setKycModal({ open: true, reason });
    }
  };
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);
  const { transactions, cancelTransaction, setTransactions } = useTransactions();
  useApprovalPoller(transactions, setTransactions);
  const { usd: totalBalance, btc: totalBtc, btcFormatted, usdFormatted } = useBalance();
  const { fmt } = useCurrency();

  const portfolioAssets = [
    { symbol: "BTC", name: "Bitcoin", amount: btcFormatted, value: fmt(totalBalance), change: "+2.4%", up: true, color: "bg-amber-400" },
  ];

  // Daily market simulation — seeded by date so it's consistent within a day
  const dailyMarket = (() => {
    const dateStr = new Date().toISOString().slice(0, 10);
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) {
      h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
    }
    const raw = Math.abs(h) % 1000;
    // Range: -5% to +8%
    const pct = (raw / 1000) * 13 - 5;
    const dollarChange = totalBalance * (pct / 100);
    const up = pct >= 0;
    const sign = up ? "+" : "";
    return {
      pctStr: `${sign}${pct.toFixed(2)}%`,
      changeStr: `${sign}${fmt(Math.abs(dollarChange))}`,
      up,
    };
  })();
  const pendingCount = transactions.filter(t => t.statusType === "investigation" || t.statusType === "pending" || t.statusType === "processing").length;

  function handleCancel(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    cancelTransaction(id);
    if (expandedTx === id) setExpandedTx(null);
  }

  function handleVerify(tx: { id: string; asset: string; amount: string; usdAmount?: number }) {
    const rawNum = tx.usdAmount ?? 20000;
    saveInvoiceContext({
      usdAmount: rawNum,
      asset: tx.asset,
      rawAmount: tx.amount,
      txId: tx.id,
    });
    navigate("/invoice");
  }

  const actionButtons = [
    {
      label: "Send",
      onClick: () => requireKyc("Send", () => navigate("/send")),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      ),
    },
    {
      label: "Receive",
      onClick: () => setModal("receive"),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
    {
      label: "Withdraw",
      onClick: () => requireKyc("Withdraw", () => navigate("/withdraw")),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      label: "Deposit",
      onClick: () => setModal("deposit"),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
  ];

  return (
    <DashboardLayout activeTab="dashboard">
      <KycModal
        open={kycModal.open}
        reason={kycModal.reason}
        onClose={() => setKycModal({ open: false })}
      />
      {modal && (
        <WalletModal
          type={modal}
          onClose={() => setModal(null)}
        />
      )}
      {receiptTx && (
        <TransactionReceiptModal
          tx={receiptTx}
          onClose={() => setReceiptTx(null)}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Balance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main balance card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-primary/20 to-blue-600/10 border border-primary/20 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Total Portfolio Value</p>
                <h2 className="text-4xl font-bold text-foreground">
                  {fmt(totalBalance)}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  ≈ {totalBtc.toFixed(8)} BTC
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={`text-sm font-medium ${dailyMarket.up ? "text-primary" : "text-red-400"}`}>
                    {dailyMarket.changeStr}
                  </span>
                  <span className="text-xs text-muted-foreground">({dailyMarket.pctStr}) today</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-4 gap-2">
              {actionButtons.map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {btn.icon}
                  </div>
                  <span className="text-xs font-medium text-foreground">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex flex-col gap-4">
            <div className="bg-card border border-card-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">24h Volume</p>
              <p className="text-xl font-bold text-foreground">{fmt(3241.80)}</p>
              <span className="text-xs text-primary">+12.4%</span>
            </div>
            <div className="bg-card border border-card-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Active Assets</p>
              <p className="text-xl font-bold text-foreground">4</p>
              <span className="text-xs text-muted-foreground">BTC, ETH, USDT, SOL</span>
            </div>
            <div className="bg-card border border-card-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              {pendingCount > 0 ? (
                <>
                  <p className="text-xl font-bold text-amber-400">{pendingCount}</p>
                  <span className="text-xs text-amber-400/80">Transaction{pendingCount > 1 ? "s" : ""} under review</span>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-foreground">0</p>
                  <span className="text-xs text-muted-foreground">No pending transactions</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio breakdown */}
        <div className="bg-card border border-card-border rounded-2xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Portfolio Assets</h3>
          <div className="space-y-3">
            {portfolioAssets.map(asset => (
              <div key={asset.symbol} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className={`w-10 h-10 rounded-full ${asset.color} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-xs font-bold">{asset.symbol.slice(0, 2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">{asset.amount} {asset.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{asset.value}</p>
                  <p className={`text-xs font-medium ${asset.up ? "text-primary" : "text-destructive"}`}>{asset.change}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overview graph — recent activity moved to the sidebar */}
        <OverviewGraphPanel />

        {/* Transaction History */}
        <div className="bg-card border border-card-border rounded-2xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Transaction History</h3>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">No transactions yet.</p>
            ) : transactions.map(tx => (
              <div key={tx.id} className="border border-border rounded-xl overflow-hidden">
                <div
                  className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors ${
                    tx.statusType === "investigation" ? "bg-amber-500/5" :
                    tx.statusType === "processing" ? "bg-red-500/5" :
                    tx.statusType === "pending" ? "bg-blue-500/5" : ""
                  }`}
                  onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    tx.statusType === "investigation" ? "bg-amber-500/15" :
                    tx.statusType === "processing" ? "bg-red-500/15" :
                    tx.statusType === "pending" ? "bg-blue-500/15" :
                    "bg-primary/10"
                  }`}>
                    {tx.type === "Withdrawal" || tx.type === "Send" ? (
                      <svg className={`w-5 h-5 ${
                        tx.statusType === "investigation" ? "text-amber-400" :
                        tx.statusType === "processing" ? "text-red-400" :
                        tx.statusType === "pending" ? "text-blue-400" :
                        "text-primary"
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    ) : tx.type === "Deposit" ? (
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{tx.type}</p>
                      {tx.statusType === "processing" && (
                        <span className="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs font-medium rounded-full border border-red-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Processing
                        </span>
                      )}
                      {tx.statusType === "investigation" && (
                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Under Investigation
                        </span>
                      )}
                      {tx.statusType === "pending" && (
                        <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Pending
                        </span>
                      )}
                      {tx.statusType === "completed" && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{tx.date} • {tx.address}</p>
                    {tx.statusType === "processing" && (
                      <BlockConfirmationLabel tx={tx} />
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${
                      tx.statusType === "investigation" ? "text-amber-400" :
                      tx.statusType === "processing" ? "text-red-400" :
                      tx.statusType === "pending" ? "text-blue-400" :
                      "text-foreground"
                    }`}>
                      {tx.amount}
                    </p>
                  </div>

                  {/* Expand arrow */}
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${expandedTx === tx.id ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded row */}
                {expandedTx === tx.id && (
                  <div className="border-t border-border bg-muted/20 p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Transaction ID</p>
                        <p className="text-foreground font-mono text-xs">{tx.id.toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Asset</p>
                        <p className="text-foreground font-medium">{tx.asset}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Date</p>
                        <p className="text-foreground">{tx.date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                        <p className={`font-medium ${
                          tx.statusType === "investigation" ? "text-amber-400" :
                          tx.statusType === "processing" ? "text-red-500" :
                          tx.statusType === "pending" ? "text-blue-400" :
                          "text-primary"
                        }`}>{tx.status}</p>
                        {tx.statusType === "processing" && (
                          <BlockConfirmationLabel tx={tx} />
                        )}
                      </div>
                    </div>

                    {tx.statusType === "processing" && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <p className="text-xs text-red-300">
                            Your transaction is being processed on the blockchain. Waiting for network confirmations — this may take a few minutes.
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => handleCancel(tx.id, e)}
                            className="flex-1 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-sm rounded-xl border border-destructive/20 transition-colors"
                          >
                            Cancel Transaction
                          </button>
                          <button
                            onClick={() => handleVerify(tx)}
                            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Verify Transaction
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pending state: info + Cancel + Verify */}
                    {tx.statusType === "pending" && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                          <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-blue-300">
                            Your transaction is pending review. You can cancel it before it is processed, or verify it to proceed.
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => handleCancel(tx.id, e)}
                            className="flex-1 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-sm rounded-xl border border-destructive/20 transition-colors"
                          >
                            Cancel Transaction
                          </button>
                          <button
                            onClick={() => handleVerify(tx)}
                            className="flex-1 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold text-sm rounded-xl border border-blue-500/20 transition-colors"
                          >
                            Verify Transaction
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Investigation state: alert + Cancel + Verify */}
                    {tx.statusType === "investigation" && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="text-xs text-amber-300">
                            This transaction is under investigation by our compliance team. Complete the billing verification to release your funds.
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => handleCancel(tx.id, e)}
                            className="flex-1 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-sm rounded-xl border border-destructive/20 transition-colors"
                          >
                            Cancel Transaction
                          </button>
                          <button
                            onClick={() => handleVerify(tx)}
                            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl transition-colors"
                          >
                            Verify Transaction
                          </button>
                        </div>
                      </div>
                    )}

                    {/* View Receipt — always visible */}
                    <div className="pt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setReceiptTx(tx); }}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Receipt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
