const API_ORIGIN = (
  import.meta.env.VITE_API_ORIGIN || ""
).replace(/\/$/, "");

export interface CryptoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
}

export interface CryptoMarketResponse {
  data: CryptoMarketCoin[];
  updatedAt: string;
  stale: boolean;
}

export async function getCryptoMarkets(
  signal?: AbortSignal
): Promise<CryptoMarketResponse> {
  const response = await fetch(
    `${API_ORIGIN}/api/public/crypto-markets`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(
      `Crypto market unavailable: ${response.status}`
    );
  }

  const result = await response.json();

  if (!Array.isArray(result.data)) {
    throw new Error("Invalid crypto market response");
  }

  return result as CryptoMarketResponse;
}
