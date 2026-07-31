import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { publicApi, type WalletConfig } from "@/lib/api";

const SUPPORTED_COINS = [
  { symbol: "BTC",  name: "Bitcoin",  color: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
  { symbol: "USDT", name: "Tether",   color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  { symbol: "USDC", name: "USD Coin", color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
  { symbol: "ETH",  name: "Ethereum", color: "bg-purple-500/10 border-purple-500/30 text-purple-400" },
  { symbol: "SOL",  name: "Solana",   color: "bg-violet-500/10 border-violet-500/30 text-violet-400" },
  { symbol: "XRP",  name: "XRP",      color: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" },
  { symbol: "BNB",  name: "BNB",      color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" },
];

const PLACEHOLDER_ADDRESS = "CONFIGURE_IN_ADMIN_DASHBOARD";
function isConfigured(address: string): boolean {
  return !!address && address !== PLACEHOLDER_ADDRESS;
}

type Props = {
  open: boolean;
  className?: string;
  onSelectionChange?: (coin: string | null, network: WalletConfig | null) => void;
};

export default function CryptoPaymentPanel({ open, className = "", onSelectionChange }: Props) {
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<WalletConfig | null>(null);
  const [walletConfigs, setWalletConfigs] = useState<WalletConfig[]>([]);
  const [coinOrder, setCoinOrder] = useState<string[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && walletConfigs.length === 0) {
      setWalletLoading(true);
      publicApi.getWalletConfigs()
        .then(({ configs, coinOrder: order }) => {
          setWalletConfigs(configs);
          setCoinOrder(order);
        })
        .finally(() => setWalletLoading(false));
    }
  }, [open, walletConfigs.length]);

  useEffect(() => {
    onSelectionChange?.(selectedCoin, selectedNetwork);
  }, [selectedCoin, selectedNetwork, onSelectionChange]);

  const orderedCoins = (() => {
    if (coinOrder.length === 0) return SUPPORTED_COINS;
    const orderMap = new Map(coinOrder.map((sym, i) => [sym, i]));
    return [...SUPPORTED_COINS].sort((a, b) => {
      const ai = orderMap.has(a.symbol) ? (orderMap.get(a.symbol) as number) : Number.MAX_SAFE_INTEGER;
      const bi = orderMap.has(b.symbol) ? (orderMap.get(b.symbol) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return SUPPORTED_COINS.indexOf(a) - SUPPORTED_COINS.indexOf(b);
    });
  })();

  function networksForCoin(symbol: string): WalletConfig[] {
    return walletConfigs.filter(c => c.symbol === symbol);
  }

  function handleCoinClick(symbol: string) {
    if (selectedCoin === symbol) {
      setSelectedCoin(null);
      setSelectedNetwork(null);
    } else {
      setSelectedCoin(symbol);
      setSelectedNetwork(null);
    }
  }

  function handleCopyAddress() {
    if (!selectedNetwork?.address || !isConfigured(selectedNetwork.address)) return;
    navigator.clipboard.writeText(selectedNetwork.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!open) return null;

  return (
    <div className={`rounded-2xl border border-[#2a3550] bg-[#0f1117] overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-[#1e2738] flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Select Cryptocurrency</p>
        {walletLoading && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading wallets…
          </div>
        )}
      </div>

      {/* Coin grid */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {orderedCoins.map(coin => {
            const hasAddress = walletConfigs.some(c => c.symbol === coin.symbol);
            return (
              <button
                key={coin.symbol}
                onClick={() => handleCoinClick(coin.symbol)}
                disabled={walletLoading}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                  selectedCoin === coin.symbol
                    ? `${coin.color} ring-1 ring-current`
                    : "bg-[#1a2235] border-[#2a3550] hover:border-[#3a4a65] text-slate-400"
                } ${!hasAddress && !walletLoading ? "opacity-50" : ""}`}
              >
                <span className="text-sm font-bold">{coin.symbol}</span>
                <span className="text-[10px] opacity-70">{coin.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Network Selection */}
      {selectedCoin && (() => {
        const networks = networksForCoin(selectedCoin);
        return (
          <div className="border-t border-[#1e2738] px-5 py-4">
            {networks.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400">No wallet configured for {selectedCoin} yet.</p>
                <p className="text-xs text-slate-500 mt-1">Please contact support at billing@cryptovault.io</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Select Network for {selectedCoin}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {networks.map(cfg => (
                    <button
                      key={cfg.id}
                      onClick={() => setSelectedNetwork(selectedNetwork?.id === cfg.id ? null : cfg)}
                      className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                        selectedNetwork?.id === cfg.id
                          ? "bg-emerald-500 border-emerald-400 text-black"
                          : "bg-[#1a2235] border-[#2a3550] text-slate-300 hover:border-emerald-500/40"
                      }`}
                    >
                      {cfg.network}
                      {cfg.label && cfg.label !== cfg.network && (
                        <span className="ml-1.5 opacity-60 text-xs font-normal">({cfg.label})</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Wallet Address + QR */}
            {selectedNetwork && (
              <div className="mt-2">
                {!isConfigured(selectedNetwork.address) ? (
                  <div className="text-center py-8 px-4 bg-[#1a2235] border border-amber-500/20 rounded-xl">
                    <svg className="w-10 h-10 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-semibold text-white mb-1">Wallet address not yet configured</p>
                    <p className="text-xs text-slate-400 leading-relaxed">Please contact support at <span className="text-emerald-400">billing@cryptovault.io</span> to receive payment instructions for {selectedCoin} via {selectedNetwork.network}.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2.5 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl mb-4">
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-xs text-amber-300 leading-relaxed">
                        <strong className="font-semibold">Network Warning:</strong> Send only <strong>{selectedCoin}</strong> via the <strong>{selectedNetwork.network}</strong> network.
                        Sending to the wrong network will result in <strong>permanent loss of funds</strong>.
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      <div className="flex-shrink-0 bg-white rounded-2xl p-4 shadow-lg">
                        <QRCode
                          value={selectedNetwork.address}
                          size={160}
                          bgColor="#ffffff"
                          fgColor="#000000"
                          level="M"
                        />
                      </div>

                      <div className="flex-1 min-w-0 w-full">
                        <div className="mb-2">
                          <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wide">
                            {selectedCoin} Wallet Address ({selectedNetwork.network})
                          </p>
                          <div className="relative">
                            <div className="w-full px-4 py-3 bg-[#1a2235] border border-[#2a3550] rounded-xl text-emerald-300 text-xs font-mono leading-relaxed break-all pr-24">
                              {selectedNetwork.address}
                            </div>
                            <button
                              onClick={handleCopyAddress}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                copied
                                  ? "bg-emerald-500 text-black"
                                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
                              }`}
                            >
                              {copied ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                          Scan the QR code or copy the address above to send <strong className="text-slate-400">{selectedCoin}</strong> payment.
                          Always double-check the network before sending.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {selectedNetwork.network}
                          </span>
                          <span className="text-xs text-slate-500">{selectedCoin}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
