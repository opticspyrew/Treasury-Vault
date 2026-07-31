import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { useCurrency } from "@/lib/currency-context";

const marketData = [
  { rank: 1, name: "Bitcoin", symbol: "BTC", price: "66,421.50", marketCap: "1.31T", volume: "24.8B", change: "+2.41%", up: true, supply: "19.67M" },
  { rank: 2, name: "Ethereum", symbol: "ETH", price: "3,285.40", marketCap: "394.5B", volume: "12.1B", change: "+1.82%", up: true, supply: "120.2M" },
  { rank: 3, name: "Tether", symbol: "USDT", price: "1.00", marketCap: "109.8B", volume: "56.4B", change: "+0.01%", up: true, supply: "109.8B" },
  { rank: 4, name: "BNB", symbol: "BNB", price: "596.30", marketCap: "86.9B", volume: "1.84B", change: "+0.61%", up: true, supply: "145.8M" },
  { rank: 5, name: "Solana", symbol: "SOL", price: "142.86", marketCap: "65.4B", volume: "3.12B", change: "-0.94%", up: false, supply: "457.9M" },
  { rank: 6, name: "XRP", symbol: "XRP", price: "0.5421", marketCap: "58.7B", volume: "2.41B", change: "+3.14%", up: true, supply: "108.3B" },
  { rank: 7, name: "USDC", symbol: "USDC", price: "1.00", marketCap: "43.2B", volume: "7.14B", change: "0.00%", up: true, supply: "43.2B" },
  { rank: 8, name: "Cardano", symbol: "ADA", price: "0.4512", marketCap: "15.9B", volume: "412M", change: "+1.24%", up: true, supply: "35.2B" },
  { rank: 9, name: "Avalanche", symbol: "AVAX", price: "35.84", marketCap: "14.8B", volume: "384M", change: "-2.17%", up: false, supply: "413M" },
  { rank: 10, name: "Dogecoin", symbol: "DOGE", price: "0.1642", marketCap: "23.5B", volume: "1.12B", change: "+5.21%", up: true, supply: "143.2B" },
];

const colorMap: Record<string, string> = {
  BTC: "bg-amber-400", ETH: "bg-blue-400", USDT: "bg-emerald-400", BNB: "bg-yellow-400",
  SOL: "bg-purple-400", XRP: "bg-cyan-400", USDC: "bg-blue-300", ADA: "bg-blue-500",
  AVAX: "bg-red-400", DOGE: "bg-yellow-500",
};

export default function Market() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "change">("rank");
  const { btcPriceUsd, ratesLoading } = useCurrency();

  const livePricedData = marketData.map(c =>
    c.symbol === "BTC" && btcPriceUsd > 0
      ? {
          ...c,
          price: btcPriceUsd.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        }
      : c,
  );

  const filtered = livePricedData
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "change") {
        return parseFloat(b.change) - parseFloat(a.change);
      }
      return a.rank - b.rank;
    });

  const formattedBtcPrice = btcPriceUsd > 0
    ? `$${btcPriceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  return (
    <DashboardLayout activeTab="market">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Market</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Live cryptocurrency prices and market data</p>
          </div>
          <div className="flex items-center gap-3 bg-card border border-card-border rounded-2xl px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">₿</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bitcoin (BTC)</p>
              {!formattedBtcPrice ? (
                <p className="text-base font-bold text-foreground animate-pulse">
                  {ratesLoading ? "Loading…" : "Unavailable"}
                </p>
              ) : (
                <p className="text-base font-bold text-foreground">1 BTC = {formattedBtcPrice}</p>
              )}
            </div>
          </div>
        </div>

        {/* Market summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Global Market Cap", value: "$2.41T", sub: "+2.14% today" },
            { label: "24h Volume", value: "$94.8B", sub: "Across all pairs" },
            { label: "BTC Dominance", value: "54.3%", sub: "Market share" },
            { label: "Active Cryptos", value: "12,400+", sub: "Listed on exchanges" },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-card-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search cryptocurrencies..."
                className="w-full pl-9 pr-4 py-2 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              {(["rank", "change"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors capitalize ${sortBy === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Sort by {s}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground">Asset</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground">24h Change</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground hidden md:table-cell">Market Cap</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">Volume (24h)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(coin => (
                  <tr key={coin.symbol} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="p-4 text-sm text-muted-foreground">{coin.rank}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${colorMap[coin.symbol] || "bg-muted"} flex items-center justify-center`}>
                          <span className="text-white text-xs font-bold">{coin.symbol.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{coin.name}</p>
                          <p className="text-xs text-muted-foreground">{coin.symbol}</p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="p-4 text-right text-sm font-medium text-foreground"
                      data-testid={`market-price-${coin.symbol}`}
                    >
                      {coin.symbol === "BTC" && !formattedBtcPrice ? (
                        <span className="text-muted-foreground animate-pulse">
                          {ratesLoading ? "Loading…" : "Unavailable"}
                        </span>
                      ) : (
                        <>${coin.price}</>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`text-sm font-semibold ${coin.up ? "text-primary" : "text-destructive"}`}>
                        {coin.change}
                      </span>
                    </td>
                    <td className="p-4 text-right text-sm text-muted-foreground hidden md:table-cell">${coin.marketCap}</td>
                    <td className="p-4 text-right text-sm text-muted-foreground hidden lg:table-cell">${coin.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
