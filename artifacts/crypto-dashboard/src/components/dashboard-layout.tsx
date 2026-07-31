import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useCurrency, CURRENCIES, type CurrencyCode } from "@/lib/currency-context";
import { useRecoveryOverview } from "@/hooks/use-recovery-overview";
import { ScamThumb } from "@/lib/scam-thumbnail";
import { authApi, type AuthSessionRecord } from "@/lib/api";

/** Compact "Recent activity" list shown in the sidebar next to the brand. */
function SidebarRecentActivity() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<AuthSessionRecord[] | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .sessions(token)
      .then((res) => {
        if (!cancelled) setSessions(res.sessions.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => { cancelled = true; };
  }, [token]);

  const [, navigate] = useLocation();

  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-sidebar-border" data-testid="sidebar-recent-activity">
      <div className="flex items-center justify-between px-4 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Recent activity
        </p>
        <button
          type="button"
          onClick={() => navigate("/connected-accounts")}
          className="text-[10px] font-semibold text-primary hover:underline"
          data-testid="sidebar-recent-activity-manage"
        >
          Manage
        </button>
      </div>
      <ul className="space-y-1">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 px-4 py-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.current ? "bg-primary" : "bg-muted-foreground/40"}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-foreground truncate">
                {s.current ? "This device" : "Sign-in"}
              </span>
              <span className="block text-[10px] text-muted-foreground truncate">
                {new Date(s.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {s.location ? ` • ${s.location}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab?: string;
}

const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: "trade",
    label: "Trade",
    path: "/trade",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    id: "convert",
    label: "Convert",
    path: "/convert",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    id: "market",
    label: "Market",
    path: "/market",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "link-account",
    label: "Link Account",
    path: "/link-account",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    badge: true,
  },
];

export default function DashboardLayout({ children, activeTab }: LayoutProps) {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { currency, setCurrency, btcPriceUsd, ratesLoading } = useCurrency();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { scammedVia } = useRecoveryOverview();

  // Hidden gesture: tapping the logo 4 times in quick succession opens the
  // Refunds Portal (replaces the old visible sidebar button).
  const logoTaps = useRef<{ count: number; timer: number | null }>({ count: 0, timer: null });
  useEffect(() => {
    // Clear any pending tap-reset timer when the layout unmounts.
    const state = logoTaps.current;
    return () => {
      if (state.timer) window.clearTimeout(state.timer);
    };
  }, []);
  const handleLogoTap = () => {
    const state = logoTaps.current;
    state.count += 1;
    if (state.timer) window.clearTimeout(state.timer);
    if (state.count >= 4) {
      state.count = 0;
      state.timer = null;
      setSidebarOpen(false);
      navigate("/refunds/portal");
      return;
    }
    state.timer = window.setTimeout(() => {
      state.count = 0;
      state.timer = null;
    }, 1500);
  };

  const handleLogout = () => {
    logout();
    navigate("/sign-in");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand area: logo (tap 4x for Refunds Portal) + name + Overview */}
        <div className="px-4 py-3 border-b border-sidebar-border space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogoTap}
              aria-label="Treasury Vault"
              data-testid="brand-logo"
              className="flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg select-none"
            >
              <img
                src="/treasury-vault-logo.jpg"
                alt="Treasury Vault"
                draggable={false}
                className="h-10 w-auto rounded-lg bg-white object-contain pointer-events-none"
              />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight">Treasury Vault</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Secure custody</p>
            </div>
          </div>

          {/* Prominent Overview button — always first, bold, with the
              documented scam asset/payment method as its thumbnail */}
          <button
            type="button"
            onClick={() => { navigate("/dashboard"); setSidebarOpen(false); }}
            data-testid="nav-overview"
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
              activeTab === "dashboard"
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-primary/[0.06] text-foreground border-primary/20 hover:bg-primary/10 hover:border-primary/40"
            }`}
          >
            {scammedVia ? (
              <ScamThumb label={scammedVia} size="sm" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            )}
            <span className="flex-1 text-left">Overview</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <span className={activeTab === item.id ? "text-primary" : ""}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {"badge" in item && item.badge && (
                <span className="px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold rounded-md">
                  NEW
                </span>
              )}
            </button>
          ))}

          {/* Refunds Portal is intentionally hidden from the nav — it opens
              by tapping the Treasury Vault logo four times. */}
          <SidebarRecentActivity />
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-accent transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-sm font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
              </div>
              <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-card-border rounded-xl shadow-lg overflow-hidden">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/change-password");
                  }}
                  data-testid="user-menu-change-password"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-b border-card-border"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Change password
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/connected-accounts");
                  }}
                  data-testid="user-menu-connected-accounts"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-b border-card-border"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 015.656 0l1.414 1.414a4 4 0 010 5.656l-2.828 2.828a4 4 0 01-5.656 0l-1.414-1.414M10.172 13.828a4 4 0 01-5.656 0L3.1 12.414a4 4 0 010-5.656l2.828-2.828a4 4 0 015.656 0l1.414 1.414" />
                  </svg>
                  Connected accounts
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/notification-settings");
                  }}
                  data-testid="user-menu-notification-settings"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-b border-card-border"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Notification preferences
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 h-16 bg-card border-b border-card-border flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {/* Live BTC price */}
            <div
              data-testid="header-btc-price"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-muted border border-card-border rounded-full"
              title="Live BTC price (USD)"
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                ₿
              </span>
              {btcPriceUsd > 0 ? (
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  ${btcPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </span>
              ) : (
                <span className="text-xs font-medium text-muted-foreground animate-pulse">
                  {ratesLoading ? "…" : "—"}
                </span>
              )}
            </div>

            {/* Currency Selector */}
            <select
              value={currency.code}
              onChange={e => setCurrency(e.target.value as CurrencyCode)}
              aria-label="Select currency"
              className="px-3 py-1.5 bg-muted border border-input rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">Live</span>
            </div>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors relative">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
