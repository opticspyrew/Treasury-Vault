import HeroSection from "../components/homepage/hero-section";
import TrustIndicators from "../components/homepage/trust-indicators";
import RecoveryProcess from "../components/homepage/recovery-process";
import RecoveryCategories from "../components/homepage/recovery-categories";
import BlockchainIntelligence from "../components/homepage/blockchain-intelligence";
import SecureVault from "../components/homepage/secure-vault";
import AiAssistantSection from "../components/homepage/ai-assistant-section";
import CaseIntakeSection from "../components/homepage/case-intake-section";
import InvestigationOps from "../components/homepage/investigation-ops";
import ComplianceLegal from "../components/homepage/compliance-legal";
import DashboardPreview from "../components/homepage/dashboard-preview";
import RecoveryStats from "../components/homepage/recovery-stats";
import EducationSection from "../components/homepage/education-section";
import FaqSection from "../components/homepage/faq-section";
import RefundsPublicLayout from "../components/refunds-public-layout";

export default function RefundsLanding() {
  return (
    <RefundsPublicLayout>
      <HeroSection />
      <TrustIndicators />
      <RecoveryProcess />
      <RecoveryCategories />
      <BlockchainIntelligence />
      <SecureVault />
      <AiAssistantSection />
      <CaseIntakeSection />
      <InvestigationOps />
      <ComplianceLegal />
      <DashboardPreview />
      <RecoveryStats />
      <EducationSection />
      <FaqSection />
    </RefundsPublicLayout>
  );
}
