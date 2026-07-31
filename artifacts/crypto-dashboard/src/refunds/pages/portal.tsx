import { useState } from "react";
import RefundsShell, { type PortalSectionId } from "../components/refunds-shell";
import VaultOverview from "../components/portal-sections/vault-overview";
import CaseIntake from "../components/portal-sections/case-intake";
import MyCases from "../components/portal-sections/my-cases";
import InvestigatorPanel from "../components/portal-sections/investigator-panel";
import BlockchainWidgets from "../components/portal-sections/blockchain-widgets";
import AiAssistant from "../components/portal-sections/ai-assistant";
import SecureMessaging from "../components/portal-sections/secure-messaging";
import EvidenceUpload from "../components/portal-sections/evidence-upload";
import RecoveryTimeline from "../components/portal-sections/recovery-timeline";
import ReportGeneration from "../components/portal-sections/reports";
import OsintToolkit from "../components/portal-sections/osint-toolkit";
import LegalCoordination from "../components/portal-sections/legal-coordination";

const VALID_SECTIONS: PortalSectionId[] = [
  "overview",
  "intake",
  "cases",
  "investigator",
  "chain",
  "ai",
  "messages",
  "evidence",
  "timeline",
  "reports",
  "osint",
  "legal",
];

function readHashSection(): PortalSectionId {
  if (typeof window === "undefined") return "overview";
  const raw = window.location.hash.replace(/^#/, "") as PortalSectionId;
  return VALID_SECTIONS.includes(raw) ? raw : "overview";
}

export default function RefundsPortal() {
  const [section, setSection] = useState<PortalSectionId>(() => readHashSection());

  const handleChange = (next: PortalSectionId) => {
    setSection(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}#${next}`);
    }
  };

  return (
    <RefundsShell active={section} onSectionChange={handleChange}>
      {section === "overview" && <VaultOverview />}
      {section === "intake" && <CaseIntake />}
      {section === "cases" && <MyCases />}
      {section === "investigator" && <InvestigatorPanel />}
      {section === "chain" && <BlockchainWidgets />}
      {section === "ai" && <AiAssistant />}
      {section === "messages" && <SecureMessaging />}
      {section === "evidence" && <EvidenceUpload />}
      {section === "timeline" && <RecoveryTimeline />}
      {section === "reports" && <ReportGeneration />}
      {section === "osint" && <OsintToolkit />}
      {section === "legal" && <LegalCoordination />}
    </RefundsShell>
  );
}
