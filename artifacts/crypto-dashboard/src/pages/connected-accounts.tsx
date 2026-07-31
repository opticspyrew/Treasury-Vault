import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import {
  socialAuthApi,
  type LinkedProvider,
  type ProvidersConfig,
  type SocialProvider,
} from "@/lib/api";

const STATUS_MESSAGES: Record<string, { kind: "success" | "error"; text: string }> = {
  connected: { kind: "success", text: "Account connected." },
  cancelled: { kind: "error", text: "Connecting was cancelled." },
  missing_state: { kind: "error", text: "Your link session expired. Please try again." },
  exchange_failed: { kind: "error", text: "We couldn't verify your sign-in with the provider." },
  email_unverified: { kind: "error", text: "That provider account has no verified email." },
  already_linked: { kind: "error", text: "That account is already connected." },
  in_use_elsewhere: { kind: "error", text: "That provider account is connected to a different CryptoVault user." },
  google_not_configured: { kind: "error", text: "Google sign-in isn't available right now." },
  start_failed: { kind: "error", text: "We couldn't start the link flow. Please try again." },
};

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
};

export default function ConnectedAccounts() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [config, setConfig] = useState<ProvidersConfig | null>(null);
  const [linked, setLinked] = useState<LinkedProvider[]>([]);
  const [hasPassword, setHasPassword] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // One-shot read of ?status= set by the OAuth callback redirect.
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status) {
      setStatusBanner(STATUS_MESSAGES[status] ?? { kind: "error", text: "Something went wrong." });
      params.delete("status");
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      window.history.replaceState(null, "", url);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await socialAuthApi.linked(token);
      setConfig(data.providers);
      setLinked(data.linked);
      setHasPassword(data.hasPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connected accounts.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConnect = (provider: SocialProvider) => {
    if (!token) return;
    window.location.href = socialAuthApi.connectUrl(provider, token);
  };

  const handleDisconnect = async (provider: SocialProvider) => {
    if (!token) return;
    setBusy(provider);
    setStatusBanner(null);
    try {
      await socialAuthApi.disconnect(token, provider);
      setStatusBanner({ kind: "success", text: `Disconnected ${PROVIDER_LABELS[provider]}.` });
      await refresh();
    } catch (err) {
      setStatusBanner({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to disconnect.",
      });
    } finally {
      setBusy(null);
    }
  };

  const providers: SocialProvider[] = ["google"];

  return (
    <DashboardLayout activeTab="connected-accounts">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Connected accounts</h1>
          <p className="text-muted-foreground text-sm">
            Sign in faster by linking external providers. You can disconnect any provider as long as you have another way to sign in.
          </p>
        </div>

        {statusBanner && (
          <div
            data-testid="connected-accounts-status"
            className={
              "mb-4 p-3 rounded-xl text-sm " +
              (statusBanner.kind === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-destructive/10 border border-destructive/20 text-destructive")
            }
          >
            {statusBanner.text}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="bg-card border border-card-border rounded-2xl divide-y divide-card-border overflow-hidden">
          {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
          {!loading && providers.map((p) => {
            const isConfigured = !!config?.[p];
            const link = linked.find((l) => l.provider === p);
            const isLinked = !!link;
            const otherLinkedCount = linked.filter((l) => l.provider !== p).length;
            const wouldStrandUser = !hasPassword && otherLinkedCount === 0;
            const disconnectBlocked = isLinked && wouldStrandUser;

            return (
              <div key={p} className="p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground capitalize">{PROVIDER_LABELS[p]}</div>
                  {isLinked ? (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      Connected{link?.email ? ` as ${link.email}` : ""} •{" "}
                      {new Date(link!.linkedAt).toLocaleDateString()}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isConfigured ? "Not connected" : "Not available"}
                    </div>
                  )}
                </div>
                {isLinked ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(p)}
                    disabled={busy === p || disconnectBlocked}
                    title={disconnectBlocked ? "Set a password or connect another provider first." : undefined}
                    data-testid={`disconnect-${p}`}
                    className="px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold hover:bg-destructive/15 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy === p ? "Disconnecting…" : "Disconnect"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnect(p)}
                    disabled={!isConfigured}
                    data-testid={`connect-${p}`}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!hasPassword && (
          <p className="mt-4 text-xs text-muted-foreground">
            You signed up with a provider, so your account has no password. You can{" "}
            <button
              onClick={() => navigate("/set-password")}
              className="text-primary hover:underline font-medium"
            >
              set a password
            </button>{" "}
            to keep a backup sign-in method.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
