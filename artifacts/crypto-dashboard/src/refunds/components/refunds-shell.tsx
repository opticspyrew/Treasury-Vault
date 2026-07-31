import { Fragment, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  FileCheck2,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LineChart,
  Lock,
  LogOut,
  Menu,
  MessageSquareLock,
  Network,
  ScanLine,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import RefundsLogo from "./refunds-logo";

export type PortalSectionId =
  | "overview"
  | "intake"
  | "cases"
  | "investigator"
  | "chain"
  | "ai"
  | "messages"
  | "evidence"
  | "timeline"
  | "reports"
  | "osint"
  | "legal";

export const PORTAL_SECTIONS: ReadonlyArray<{
  id: PortalSectionId;
  label: string;
  group: string;
  icon: ReactNode;
}> = [
  { id: "overview", label: "Dashboard", group: "Workspace", icon: <LayoutDashboard className="w-4.5 h-4.5" /> },
  { id: "intake", label: "Case Intake", group: "Investigations", icon: <Inbox className="w-4.5 h-4.5" /> },
  { id: "cases", label: "Cases & Recoveries", group: "Investigations", icon: <FolderOpen className="w-4.5 h-4.5" /> },
  { id: "investigator", label: "Investigator", group: "Investigations", icon: <ShieldCheck className="w-4.5 h-4.5" /> },
  { id: "evidence", label: "Evidence Vault", group: "Investigations", icon: <FileCheck2 className="w-4.5 h-4.5" /> },
  { id: "timeline", label: "Investigation Timeline", group: "Investigations", icon: <Activity className="w-4.5 h-4.5" /> },
  { id: "chain", label: "Blockchain Intelligence", group: "Intelligence", icon: <Network className="w-4.5 h-4.5" /> },
  { id: "osint", label: "OSINT Toolkit", group: "Intelligence", icon: <Search className="w-4.5 h-4.5" /> },
  { id: "ai", label: "AI Assistant", group: "Intelligence", icon: <Sparkles className="w-4.5 h-4.5" /> },
  { id: "reports", label: "Report Generation", group: "Reporting", icon: <FileText className="w-4.5 h-4.5" /> },
  { id: "legal", label: "Legal Coordination", group: "Reporting", icon: <Scale className="w-4.5 h-4.5" /> },
  { id: "messages", label: "Secure Messaging", group: "Client", icon: <MessageSquareLock className="w-4.5 h-4.5" /> },
];

interface RefundsShellProps {
  active: PortalSectionId;
  onSectionChange: (id: PortalSectionId) => void;
  children: ReactNode;
}

export default function RefundsShell({ active, onSectionChange, children }: RefundsShellProps) {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeLabel = PORTAL_SECTIONS.find((s) => s.id === active)?.label ?? "Dashboard";

  const handleLogout = async () => {
    await logout();
    navigate("/refunds/sign-in");
  };

  return (
    <div className="refunds-scope flex min-h-screen w-full overflow-hidden">
      <div className="fixed inset-0 -z-10 refunds-radial pointer-events-none" />
      <div className="fixed inset-0 -z-10 refunds-grid-bg opacity-40 pointer-events-none" />

      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-sidebar/95 border-r border-sidebar-border backdrop-blur-xl flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 pt-6 pb-4 border-b border-sidebar-border">
          <button
            onClick={() => navigate("/refunds")}
            className="flex items-center gap-3 group"
            aria-label="Netspy-World Forensics home"
          >
            <RefundsLogo size={36} />
          </button>
          <div className="mt-4 flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20">
            <span className="relative w-2 h-2 rounded-full bg-primary refunds-pulse-ring" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-primary">
              SOC monitoring • live
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {PORTAL_SECTIONS.map((s, i) => {
            const isActive = s.id === active;
            const showGroup = i === 0 || PORTAL_SECTIONS[i - 1].group !== s.group;
            return (
              <Fragment key={s.id}>
                {showGroup && (
                  <p
                    className={`px-3 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold ${
                      i === 0 ? "pt-1" : "pt-4"
                    }`}
                  >
                    {s.group}
                  </p>
                )}
                <button
                  onClick={() => {
                    onSectionChange(s.id);
                    setSidebarOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  data-testid={`refunds-nav-${s.id}`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                  }`}
                >
                  <span className={isActive ? "text-primary" : "text-muted-foreground"}>{s.icon}</span>
                  <span className="flex-1 text-left">{s.label}</span>
                </button>
              </Fragment>
            );
          })}

          <div className="my-4 refunds-divider" />

          <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold">
            Compliance
          </p>
          <div className="px-3 py-2 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-primary/80" />
              <span>SOC 2 Type II — in scope</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-primary/80" />
              <span>ISO 27001 — controls active</span>
            </div>
            <div className="flex items-center gap-2">
              <LineChart className="w-3.5 h-3.5 text-primary/80" />
              <span>AML/KYC review enforced</span>
            </div>
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg refunds-glass-soft">
            <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-sm font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name || "Client"}</p>
              <p className="text-[11px] text-muted-foreground truncate font-mono">
                {user?.email || "client@netspyworld.com"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              data-testid="refunds-signout"
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16 bg-card/60 backdrop-blur-xl border-b border-card-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Netspy-World Forensics • Investigation Console
              </p>
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{activeLabel}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full refunds-glass-soft">
              <ScanLine className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                Session • E2EE-AES-256
              </span>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              data-testid="refunds-to-dashboard"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-sm font-medium text-foreground refunds-glass-soft hover:bg-muted transition-colors"
              aria-label="Open crypto dashboard"
            >
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">Crypto Dashboard</span>
            </button>
            <button
              aria-label="Notifications"
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[hsl(var(--refunds-alert))] refunds-pulse-alert" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
