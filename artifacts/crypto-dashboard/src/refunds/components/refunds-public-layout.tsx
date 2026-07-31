import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import HomeNav from "./homepage/home-nav";
import FooterEcosystem from "./homepage/footer-ecosystem";

// Shared chrome for every public Refunds.site page (landing + marketing
// sub-pages). Keeps the cyber-intelligence theme isolated under
// `.refunds-scope` so the CryptoVault identity is never touched.
export default function RefundsPublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="refunds-scope min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 -z-10 refunds-radial" />
        <div className="absolute inset-0 -z-10 refunds-grid-bg opacity-50" />

        <HomeNav />
        <main>{children}</main>
        <FooterEcosystem />
      </div>
    </MotionConfig>
  );
}
