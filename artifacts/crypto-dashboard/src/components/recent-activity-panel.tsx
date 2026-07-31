import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authApi, type AuthSessionRecord } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";

  let os = "Unknown OS";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod|iOS/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome|Chromium/i.test(ua)) browser = "Safari";

  return `${browser} on ${os}`;
}

function describeIp(ip: string | null): string {
  if (!ip) return "IP unknown";
  // Strip IPv4-mapped IPv6 prefix for cleaner display.
  return ip.replace(/^::ffff:/, "");
}

function describeLocation(
  location: string | null,
  ip: string | null,
): string {
  // Prefer the resolved "City, CC" / "Country" label. Fall back to the raw
  // IP so we always show *something* recognizable, and finally to a clear
  // "Location unknown" when neither is available.
  if (location && location.trim() !== "") return location;
  if (ip && ip.trim() !== "") return describeIp(ip);
  return "Location unknown";
}

/**
 * Convert an ISO 3166-1 alpha-2 country code (e.g. "US") into a flag emoji
 * by mapping each letter to its Regional Indicator Symbol (U+1F1E6 + offset).
 * Returns null for anything that isn't a valid 2-letter code so we never
 * render a broken/placeholder glyph.
 */
function flagEmojiFromCountryCode(code: string | null): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  const base = 0x1f1e6 - "A".charCodeAt(0);
  return String.fromCodePoint(
    normalized.charCodeAt(0) + base,
    normalized.charCodeAt(1) + base,
  );
}

export default function RecentActivityPanel() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<AuthSessionRecord[] | null>(null);
  // User-level count of currently-pending withdrawal requests. Surfaced in
  // the "Sign out all other devices" confirmation so a power user who has a
  // withdrawal flow open on another device (e.g. hardware-wallet
  // confirmation) gets a heads-up before revoking that session.
  const [pendingWithdrawalCount, setPendingWithdrawalCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Tracks which session is currently being revoked. The active row shows
  // a "Signing out…" label, and ALL revoke buttons are disabled while a
  // request is in flight — this prevents accidental double-clicks across
  // rows during the brief optimistic-update window.
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  // State for the "Sign out all other devices" flow: confirmation dialog
  // visibility, in-flight indicator, and the success message that doubles
  // as the on-screen "toast" confirming how many sessions were ended.
  const [confirmAllOpen, setConfirmAllOpen] = useState<boolean>(false);
  const [revokingAll, setRevokingAll] = useState<boolean>(false);
  const [revokeAllSuccess, setRevokeAllSuccess] = useState<string | null>(null);

  const loadSessions = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const { sessions: rows, pendingWithdrawalCount: count } =
          await authApi.sessions(token);
        if (!signal?.cancelled) {
          setSessions(rows);
          setPendingWithdrawalCount(count);
        }
      } catch (err: unknown) {
        if (!signal?.cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load recent activity.",
          );
        }
      } finally {
        if (!signal?.cancelled) {
          setLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void loadSessions(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadSessions]);

  const handleRevokeAllOthers = useCallback(async () => {
    if (!token) return;
    setRevokingAll(true);
    setRevokeError(null);
    setRevokeAllSuccess(null);
    try {
      const { revoked } = await authApi.revokeAllOtherSessions(token);
      setConfirmAllOpen(false);
      // Optimistically drop every non-current row, then re-fetch to stay
      // in sync with the server.
      setSessions((prev) => (prev ? prev.filter((s) => s.current) : prev));
      await loadSessions();
      setRevokeAllSuccess(
        revoked === 0
          ? "No other devices were signed in."
          : revoked === 1
            ? "Signed out 1 other device."
            : `Signed out ${revoked} other devices.`,
      );
    } catch (err: unknown) {
      setRevokeError(
        err instanceof Error
          ? err.message
          : "Failed to sign out other devices.",
      );
    } finally {
      setRevokingAll(false);
    }
  }, [token, loadSessions]);

  // Auto-dismiss the success message after a few seconds so it behaves like
  // a toast.
  useEffect(() => {
    if (!revokeAllSuccess) return;
    const t = setTimeout(() => setRevokeAllSuccess(null), 5000);
    return () => clearTimeout(t);
  }, [revokeAllSuccess]);

  const handleRevoke = useCallback(
    async (sessionId: number) => {
      if (!token) return;
      setRevokingId(sessionId);
      setRevokeError(null);
      try {
        await authApi.revokeSession(token, sessionId);
        // Optimistically remove the row so the user sees instant feedback,
        // then re-fetch to stay in sync with the server (handles edge
        // cases like the row already being expired/cleaned up).
        setSessions((prev) =>
          prev ? prev.filter((s) => s.id !== sessionId) : prev,
        );
        await loadSessions();
      } catch (err: unknown) {
        setRevokeError(
          err instanceof Error ? err.message : "Failed to sign out that device.",
        );
      } finally {
        setRevokingId(null);
      }
    },
    [token, loadSessions],
  );

  return (
    <div
      className="bg-card border border-card-border rounded-2xl p-6"
      data-testid="recent-activity-panel"
    >
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-foreground">Recent activity</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Recent sign-ins to your account. If you see anything you don't
            recognize, change your password right away.
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground py-4" data-testid="recent-activity-loading">
          Loading recent sign-ins…
        </p>
      )}

      {error && !loading && (
        <p className="text-sm text-destructive py-4" data-testid="recent-activity-error">
          {error}
        </p>
      )}

      {!loading && !error && sessions && sessions.length === 0 && (
        <p className="text-sm text-muted-foreground py-4" data-testid="recent-activity-empty">
          No recent sign-ins to show.
        </p>
      )}

      {revokeError && (
        <p
          className="text-sm text-destructive pb-3"
          data-testid="recent-activity-revoke-error"
        >
          {revokeError}
        </p>
      )}

      {revokeAllSuccess && (
        <p
          className="text-sm text-primary pb-3"
          role="status"
          data-testid="recent-activity-revoke-all-success"
        >
          {revokeAllSuccess}
        </p>
      )}

      {!loading && !error && sessions && sessions.length > 0 && (
        <ul className="divide-y divide-border" data-testid="recent-activity-list">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
              data-testid={`recent-activity-item-${s.id}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  s.current ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M9 17v-2a4 4 0 014-4h3m-7-7a4 4 0 110 8 4 4 0 010-8z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">
                    {describeUserAgent(s.userAgent)}
                  </p>
                  {s.current && (
                    <span
                      className="px-2 py-0.5 bg-primary/15 text-primary text-[10px] font-bold rounded-full border border-primary/20"
                      data-testid={`recent-activity-current-${s.id}`}
                    >
                      THIS DEVICE
                    </span>
                  )}
                </div>
                <p
                  className="text-xs text-muted-foreground mt-0.5"
                  data-testid={`recent-activity-location-${s.id}`}
                >
                  {formatTimestamp(s.createdAt)} •{" "}
                  {(() => {
                    // Only render a flag when the row has a *resolved*
                    // location (not an IP fallback or "Location unknown")
                    // AND we have a valid 2-letter country code. This
                    // matches the task's accessibility requirement: rows
                    // without geo data simply omit the flag.
                    const flag =
                      s.location && s.location.trim() !== ""
                        ? flagEmojiFromCountryCode(s.countryCode)
                        : null;
                    return (
                      <>
                        {flag && (
                          <span
                            aria-hidden="true"
                            // Bump above the surrounding `text-xs` so the flag
                            // lands at the ~16px size the task calls for, and
                            // nudge baseline alignment so the emoji sits on
                            // the same line as the timestamp/location text.
                            className="mr-1 text-base leading-none align-middle"
                            data-testid={`recent-activity-flag-${s.id}`}
                          >
                            {flag}
                          </span>
                        )}
                        {describeLocation(s.location, s.ipAddress)}
                      </>
                    );
                  })()}
                </p>
              </div>
              {!s.current && (
                <button
                  type="button"
                  onClick={() => void handleRevoke(s.id)}
                  disabled={revokingId !== null}
                  className="text-xs font-semibold text-destructive hover:text-destructive/80 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded-md border border-destructive/30 hover:border-destructive/50 transition-colors flex-shrink-0"
                  data-testid={`recent-activity-revoke-${s.id}`}
                >
                  {revokingId === s.id ? "Signing out…" : "Sign out this device"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && sessions && sessions.some((s) => !s.current) && (
        <div className="mt-4 pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={() => {
              setRevokeError(null);
              setRevokeAllSuccess(null);
              setConfirmAllOpen(true);
            }}
            disabled={revokingAll || revokingId !== null}
            className="text-xs font-semibold text-destructive hover:text-destructive/80 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-md border border-destructive/30 hover:border-destructive/50 transition-colors"
            data-testid="recent-activity-revoke-all-button"
          >
            Sign out all other devices
          </button>
        </div>
      )}

      <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <AlertDialogContent data-testid="recent-activity-revoke-all-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out all other devices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out of every device except this one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingWithdrawalCount > 0 && (
            <div
              className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-3"
              role="alert"
              data-testid="recent-activity-revoke-all-pending-warning"
            >
              <p className="text-sm font-semibold text-destructive">
                Heads up:{" "}
                <span data-testid="recent-activity-revoke-all-pending-count">
                  {pendingWithdrawalCount === 1
                    ? "1 withdrawal request"
                    : `${pendingWithdrawalCount} withdrawal requests`}
                </span>{" "}
                still pending.
              </p>
              <p className="text-xs text-destructive/90 mt-1">
                Signing out other devices may interrupt a withdrawal flow in
                progress (for example, a hardware-wallet confirmation). You can
                still proceed if you want to.
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Prevent the dialog from auto-closing before the request
                // finishes so we can show an error if it fails.
                e.preventDefault();
                void handleRevokeAllOthers();
              }}
              disabled={revokingAll}
              data-testid="recent-activity-revoke-all-confirm"
            >
              {revokingAll ? "Signing out…" : "Sign out other devices"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
