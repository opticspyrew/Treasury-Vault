import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authApi, type RecoveryMetrics } from "@/lib/api";

/**
 * Loads the signed-in user's documented recovery overview: the metrics
 * (reported loss, recovered, at-risk, risk score) plus the "scammed via"
 * selection made in the scam report (signup form or post-Google-signup
 * intake). Used by the dashboard overview graph, the sidebar Overview
 * button thumbnail, and anywhere the selected asset should be replicated.
 */
export function useRecoveryOverview() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<RecoveryMetrics | null>(null);
  const [scammedVia, setScammedVia] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .recoveryMetrics(token)
      .then((res) => {
        if (cancelled) return;
        setMetrics(res.metrics);
        setScammedVia(res.scammedVia);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { metrics, scammedVia, loading: !metrics && !error, error };
}
