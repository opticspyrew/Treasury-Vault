import { useEffect, useState } from "react";
import type { CaseReport, RecoveryCategory, RecoveryStat, RecoveryTrendPoint } from "./types";
import {
  getRecoveryCategories,
  getRecoveryStats,
  getRecoveryTrend,
} from "./mocks";

// ---------------------------------------------------------------------------
// Refunds.site homepage data layer.
//
// This module is the single seam between the homepage and its data source.
// Components consume the hooks below; the swap from bundled mock data to live
// API calls is contained entirely here. Mock data is used only as an instant
// first-paint seed and as a graceful fallback if the API is unreachable, so a
// marketing page never renders empty.
// ---------------------------------------------------------------------------

// Root-relative to match the existing lib/api.ts convention (the proxy maps
// `/api` to the API server regardless of the artifact's base path).
const BASE = "/api/public/refunds";

export interface HomepageData {
  stats: RecoveryStat[];
  categories: RecoveryCategory[];
  trend: RecoveryTrendPoint[];
}

let homepagePromise: Promise<HomepageData> | null = null;

async function requestHomepageData(): Promise<HomepageData> {
  const res = await fetch(`${BASE}/homepage`);
  if (!res.ok) throw new Error("Failed to load homepage data");
  return (await res.json()) as HomepageData;
}

// Shared, cached fetch so the stats, categories, and trend hooks trigger a
// single network request per page load rather than one each.
export function fetchHomepageData(): Promise<HomepageData> {
  if (!homepagePromise) {
    homepagePromise = requestHomepageData().catch((err) => {
      homepagePromise = null;
      throw err;
    });
  }
  return homepagePromise;
}

function useHomepageSlice<T>(
  initial: T,
  select: (data: HomepageData) => T,
): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let active = true;
    fetchHomepageData()
      .then((data) => {
        if (active) setValue(select(data));
      })
      .catch(() => {
        // Keep the seeded mock fallback already in state.
      });
    return () => {
      active = false;
    };
  }, []);
  return value;
}

export function useRecoveryStats(): RecoveryStat[] {
  return useHomepageSlice(getRecoveryStats(), (d) => d.stats);
}

export function useRecoveryCategories(): RecoveryCategory[] {
  return useHomepageSlice(getRecoveryCategories(), (d) => d.categories);
}

export function useRecoveryTrend(): RecoveryTrendPoint[] {
  return useHomepageSlice(getRecoveryTrend(), (d) => d.trend);
}

export interface CaseIntakePayload {
  incident: string;
  asset: string;
  chain: string;
  amount: string;
  txHashes: string;
  evidenceCount: number;
}

export interface CaseIntakeResult {
  reference: string;
  requestId: number;
}

export async function submitCaseIntake(
  token: string,
  payload: CaseIntakePayload,
): Promise<CaseIntakeResult> {
  const res = await fetch(`${BASE}/intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to submit case intake");
  }
  return (await res.json()) as CaseIntakeResult;
}

// ---------------------------------------------------------------------------
// Authenticated "My cases" data layer.
//
// Unlike the homepage hooks above (which are public and seeded with mock data),
// this reads the signed-in client's own recovery cases from an authenticated
// endpoint. There is no mock fallback: an unauthenticated or failed request
// surfaces as an error/empty state in the portal rather than fabricated cases.
// ---------------------------------------------------------------------------

export interface PortalCase {
  id: number;
  reference: string;
  incident: string | null;
  asset: string | null;
  chain: string | null;
  amount: string | null;
  currency: string;
  status: string;
  submittedAt: string;
}

export async function fetchMyCases(token: string): Promise<PortalCase[]> {
  const res = await fetch(`${BASE}/cases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to load your cases");
  }
  const data = (await res.json()) as { cases: PortalCase[] };
  return data.cases;
}

export interface MyCasesState {
  cases: PortalCase[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useMyCases(token: string | null): MyCasesState {
  const [cases, setCases] = useState<PortalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!token) {
      setCases([]);
      setError("Your session has expired. Please sign in again to view your cases.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetchMyCases(token)
      .then((data) => {
        if (active) setCases(data);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load your cases");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, nonce]);

  return { cases, loading, error, reload: () => setNonce((n) => n + 1) };
}

// ---------------------------------------------------------------------------
// Case report data layer.
//
// Fetches a composed, exportable forensic report for one of the signed-in
// client's own cases. Ownership is enforced server-side; there is no mock
// fallback, so an unauthorized or missing case surfaces as an error state.
// ---------------------------------------------------------------------------

export async function fetchCaseReport(token: string, reference: string): Promise<CaseReport> {
  const res = await fetch(`${BASE}/reports/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to load the report");
  }
  const data = (await res.json()) as { report: CaseReport };
  return data.report;
}

export interface CaseReportState {
  report: CaseReport | null;
  loading: boolean;
  error: string | null;
}

export function useCaseReport(
  token: string | null,
  reference: string | null,
): CaseReportState {
  const [report, setReport] = useState<CaseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setReport(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!token) {
      setReport(null);
      setError("Your session has expired. Please sign in again to view reports.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setReport(null);
    fetchCaseReport(token, reference)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load the report");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, reference]);

  return { report, loading, error };
}
