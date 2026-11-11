import { useEffect, useState } from "react";
import {
  getCryptoMarkets,
  type CryptoMarketResponse,
} from "./crypto-market";

export function useCryptoMarkets() {
  const [market, setMarket] =
    useState<CryptoMarketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function refresh() {
      try {
        const result = await getCryptoMarkets(
          controller.signal
        );

        if (!active) return;

        setMarket(result);
        setError(null);
      } catch {
        if (!active) return;
        setError("Live market data unavailable");
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return { market, loading, error };
}
