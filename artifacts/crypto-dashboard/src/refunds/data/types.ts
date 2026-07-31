export type CaseStatus =
  | "intake"
  | "triage"
  | "investigation"
  | "recovery"
  | "closed";

export type CaseSeverity = "low" | "medium" | "high" | "critical";

export interface RefundsCase {
  id: string;
  reference: string;
  title: string;
  status: CaseStatus;
  severity: CaseSeverity;
  openedAt: string;
  lastUpdate: string;
  asset: string;
  chain: string;
  reportedLossUsd: number;
  recoveredUsd: number;
  atRiskUsd: number;
  riskScore: number;
  analyst: { name: string; role: string; initials: string };
  jurisdiction: string;
}

export interface VaultSummary {
  totalCases: number;
  activeCases: number;
  reportedLossUsd: number;
  recoveredUsd: number;
  atRiskUsd: number;
  recoveryRatePct: number;
  averageResolutionDays: number;
  liveAlerts: number;
}

export type TxDirection = "in" | "out";

export interface OnChainTx {
  id: string;
  hash: string;
  chain: string;
  asset: string;
  amount: string;
  amountUsd: number;
  direction: TxDirection;
  counterparty: string;
  counterpartyLabel?: string;
  riskScore: number;
  observedAt: string;
}

export interface AddressRisk {
  address: string;
  label: string;
  chain: string;
  riskScore: number;
  flags: string[];
  firstSeen: string;
  lastSeen: string;
  exposureUsd: number;
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface OnChainAlert {
  id: string;
  caseRef: string;
  title: string;
  detail: string;
  severity: AlertSeverity;
  observedAt: string;
}

export type MessageAuthor = "client" | "analyst" | "system";

export interface SecureMessage {
  id: string;
  threadId: string;
  author: MessageAuthor;
  authorName: string;
  body: string;
  sentAt: string;
}

export interface MessageThread {
  id: string;
  caseRef: string;
  subject: string;
  lastActivity: string;
  unread: number;
  encryption: "E2EE-AES-256";
}

export type EvidenceStatus = "uploaded" | "verifying" | "verified" | "flagged";

export interface EvidenceFile {
  id: string;
  caseRef: string;
  name: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
  status: EvidenceStatus;
}

export interface CustodyLogEntry {
  id: string;
  evidenceId: string;
  actor: string;
  action: string;
  at: string;
}

export type TimelineKind =
  | "intake"
  | "triage"
  | "evidence"
  | "investigation"
  | "coordination"
  | "recovery"
  | "closed";

export interface TimelineEvent {
  id: string;
  caseRef: string;
  kind: TimelineKind;
  title: string;
  detail: string;
  at: string;
  status: "complete" | "active" | "pending";
}

export type AiRole = "user" | "assistant";

export interface AiMessage {
  id: string;
  role: AiRole;
  body: string;
  at: string;
  citations?: string[];
}

export interface InvestigatorAssignment {
  caseRef: string;
  analyst: { name: string; role: string; initials: string };
  nextAction: string;
  nextActionDue: string;
  workload: number;
}

export interface RecoveryCategory {
  id: string;
  name: string;
  icon: string;
  summary: string;
  signals: string[];
}

export interface ProcessStep {
  index: number;
  key: string;
  title: string;
  detail: string;
  duration: string;
}

export interface RecoveryStat {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  caption: string;
}

export interface RecoveryTrendPoint {
  month: string;
  recoveredUsd: number;
  casesOpened: number;
}

export interface BlogArticle {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  readMinutes: number;
  publishedAt: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface EcosystemLink {
  label: string;
  href: string;
}

export interface EcosystemColumn {
  heading: string;
  links: EcosystemLink[];
}

export interface ReportActivityEntry {
  at: string;
  eventType: string;
  description: string;
}

export interface CaseReport {
  reference: string;
  generatedAt: string;
  firm: {
    legalName: string;
    brand: string;
    jurisdictionNote: string;
  };
  client: {
    name: string;
    email: string;
  };
  case: {
    id: number;
    reference: string;
    incident: string | null;
    asset: string | null;
    chain: string | null;
    amount: string | null;
    currency: string;
    status: string;
    submittedAt: string;
    txHashes: string[];
  };
  activity: ReportActivityEntry[];
}
