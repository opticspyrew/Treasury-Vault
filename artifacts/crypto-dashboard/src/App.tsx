import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { CurrencyProvider } from "@/lib/currency-context";
import { KycProvider } from "@/hooks/use-kyc";
import NotFound from "@/pages/not-found";
import SignIn from "@/pages/sign-in";
import SignUp from "@/pages/sign-up";
import Dashboard from "@/pages/dashboard";
import Trade from "@/pages/trade";
import Convert from "@/pages/convert";
import Market from "@/pages/market";
import Invoice from "@/pages/invoice";
import LinkAccount from "@/pages/link-account";
import Send from "@/pages/send";
import Withdraw from "@/pages/withdraw";
import CashAppGasFee from "@/pages/cashapp-gas-fee";
import ChangePassword from "@/pages/change-password";
import SetPassword from "@/pages/set-password";
import ConnectedAccounts from "@/pages/connected-accounts";
import NotificationSettings from "@/pages/notification-settings";
import ResetPassword from "@/pages/reset-password";
import DevScamThumbs from "@/pages/dev-scam-thumbs";
import RefundsLanding from "@/refunds/pages/landing";
import RefundsBrandGuide from "@/refunds/pages/brand-guide";
import RefundsServices from "@/refunds/pages/services-pricing";
import RefundsCertifications from "@/refunds/pages/certifications";
import RefundsKnowledgeBase from "@/refunds/pages/knowledge-base";
import RefundsSignIn from "@/refunds/pages/sign-in";
import RefundsSignUp from "@/refunds/pages/sign-up";
import RefundsPortal from "@/refunds/pages/portal";
import IntakeModal from "@/components/intake-modal";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, needsIntake } = useAuth();
  if (!isAuthenticated) {
    return <Redirect to="/sign-in" />;
  }
  return (
    <>
      <Component />
      {needsIntake && <IntakeModal />}
    </>
  );
}

function RefundsPendingScreen() {
  const { logout, user } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="refunds-scope min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 -z-10 refunds-vault-bg" />
      <div className="absolute inset-0 -z-10 refunds-grid-bg opacity-40" />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Access pending approval</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Your account (<span className="text-foreground font-medium">{user?.email}</span>) is registered and under review. A Netspy-World Forensics analyst will activate your portal access shortly.
          </p>
        </div>
        <div className="refunds-glass rounded-2xl p-6 space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex-shrink-0 flex items-center justify-center mt-0.5">
              <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>
            </span>
            Account created and registration email sent to our team
          </div>
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/30 flex-shrink-0 flex items-center justify-center mt-0.5">
              <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4l2 2" /></svg>
            </span>
            Analyst review in progress — typically within 24 hours
          </div>
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-muted border border-input flex-shrink-0 flex items-center justify-center mt-0.5">
              <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
            </span>
            Portal unlocked once your case intake is approved
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Questions? Email <span className="text-primary">support@netspy-world.com</span>
        </p>
        <div className="mt-5 flex justify-center">
          <button
            onClick={async () => { await logout(); navigate("/refunds/sign-in"); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function RefundsProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, portalAccess, needsIntake } = useAuth();
  if (!isAuthenticated) {
    return <Redirect to="/refunds/sign-in" />;
  }
  if (!portalAccess) {
    return (
      <>
        <RefundsPendingScreen />
        {needsIntake && <IntakeModal />}
      </>
    );
  }
  return (
    <>
      <Component />
      {needsIntake && <IntakeModal />}
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/sign-in" />} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/trade" component={() => <ProtectedRoute component={Trade} />} />
      <Route path="/convert" component={() => <ProtectedRoute component={Convert} />} />
      <Route path="/market" component={() => <ProtectedRoute component={Market} />} />
      <Route path="/invoice" component={() => <ProtectedRoute component={Invoice} />} />
      <Route path="/link-account" component={() => <ProtectedRoute component={LinkAccount} />} />
      <Route path="/send" component={() => <ProtectedRoute component={Send} />} />
      <Route path="/withdraw" component={() => <ProtectedRoute component={Withdraw} />} />
      <Route path="/cashapp-gas-fee" component={() => <ProtectedRoute component={CashAppGasFee} />} />
      <Route path="/change-password" component={() => <ProtectedRoute component={ChangePassword} />} />
      <Route path="/set-password" component={() => <ProtectedRoute component={SetPassword} />} />
      <Route path="/connected-accounts" component={() => <ProtectedRoute component={ConnectedAccounts} />} />
      <Route path="/notification-settings" component={() => <ProtectedRoute component={NotificationSettings} />} />
      {import.meta.env.DEV && <Route path="/dev/scam-thumbs" component={DevScamThumbs} />}
      <Route path="/refunds" component={RefundsLanding} />
      <Route path="/refunds/brand" component={RefundsBrandGuide} />
      <Route path="/refunds/services" component={RefundsServices} />
      <Route path="/refunds/certifications" component={RefundsCertifications} />
      <Route path="/refunds/knowledge-base" component={RefundsKnowledgeBase} />
      <Route path="/refunds/sign-in" component={RefundsSignIn} />
      <Route path="/refunds/sign-up" component={RefundsSignUp} />
      <Route path="/refunds/portal" component={() => <RefundsProtectedRoute component={RefundsPortal} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <KycProvider>
            <CurrencyProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </CurrencyProvider>
          </KycProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
