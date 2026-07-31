import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { authApi, type NotificationPreferences } from "@/lib/api";

type ToggleKey = keyof NotificationPreferences;

interface Category {
  key: ToggleKey;
  title: string;
  description: string;
}

const CATEGORIES: Category[] = [
  {
    key: "kycDecisions",
    title: "Identity verification decisions",
    description:
      "Get an email when your identity verification is approved or needs changes.",
  },
  {
    key: "newSignIn",
    title: "New sign-in alerts",
    description:
      "Get an email when your account is accessed from a new device or location.",
  },
  {
    key: "recoveryCredits",
    title: "Recovery credits",
    description:
      "Get an email the moment a recovery is credited to your vault.",
  },
];

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60 " +
        (checked ? "bg-primary" : "bg-muted-foreground/30")
      }
    >
      <span
        className={
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform " +
          (checked ? "translate-x-6" : "translate-x-1")
        }
      />
    </button>
  );
}

export default function NotificationSettings() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ToggleKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.getNotificationPreferences(token);
      setPrefs(data.preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preferences.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (key: ToggleKey, next: boolean) => {
    if (!token || !prefs) return;
    setError(null);
    setSaved(false);
    setSavingKey(key);
    // Optimistic update; revert on failure.
    const previous = prefs;
    setPrefs({ ...prefs, [key]: next });
    try {
      const data = await authApi.updateNotificationPreferences(token, { [key]: next });
      setPrefs(data.preferences);
      setSaved(true);
    } catch (err) {
      setPrefs(previous);
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <DashboardLayout activeTab="notification-settings">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Notification preferences</h1>
          <p className="text-muted-foreground text-sm">
            Choose which emails you'd like to receive. Security-critical alerts are
            always sent and can't be turned off.
          </p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-2 sm:p-3">
          {loading ? (
            <div
              className="p-6 text-sm text-muted-foreground"
              data-testid="notification-settings-loading"
            >
              Loading your preferences…
            </div>
          ) : (
            <ul className="divide-y divide-card-border">
              {CATEGORIES.map((category) => {
                const checked = prefs?.[category.key] ?? true;
                return (
                  <li
                    key={category.key}
                    className="flex items-start justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{category.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {category.description}
                      </p>
                    </div>
                    <div className="pt-0.5">
                      <Toggle
                        label={category.title}
                        checked={checked}
                        disabled={savingKey === category.key}
                        onChange={(next) => handleToggle(category.key, next)}
                      />
                    </div>
                  </li>
                );
              })}

              {/* Mandatory, non-togglable security alert. */}
              <li className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Password changed alerts
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get an email whenever your password is changed or reset. This
                    security alert is always on.
                  </p>
                </div>
                <div className="pt-0.5 flex items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Always on
                  </span>
                  <Toggle
                    label="Password changed alerts (always on)"
                    checked
                    disabled
                    onChange={() => {}}
                  />
                </div>
              </li>
            </ul>
          )}
        </div>

        {saved && !error && (
          <p
            data-testid="notification-settings-saved"
            className="mt-3 text-xs text-emerald-500"
          >
            Preferences saved.
          </p>
        )}
        {error && (
          <p
            data-testid="notification-settings-error"
            className="mt-3 text-xs text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="py-2.5 px-5 bg-muted text-foreground rounded-xl font-semibold text-sm hover:bg-muted/80 transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
