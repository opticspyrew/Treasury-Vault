import type {
  AddressRisk,
  AiMessage,
  BlogArticle,
  CustodyLogEntry,
  EcosystemColumn,
  EvidenceFile,
  FaqEntry,
  InvestigatorAssignment,
  MessageThread,
  OnChainAlert,
  OnChainTx,
  ProcessStep,
  RecoveryCategory,
  RecoveryStat,
  RecoveryTrendPoint,
  RefundsCase,
  SecureMessage,
  TimelineEvent,
  VaultSummary,
} from "./types";

// Realistic-looking but fully synthetic data. No PII, no real addresses.
// Replace these read functions with API calls without touching components.

const CASES: RefundsCase[] = [
  {
    id: "case-2026-0184",
    reference: "RF-2026-0184",
    title: "Counterfeit OTC desk drain (ETH/USDC)",
    status: "investigation",
    severity: "high",
    openedAt: "2026-05-18T09:12:00Z",
    lastUpdate: "2026-05-27T03:41:00Z",
    asset: "USDC",
    chain: "Ethereum",
    reportedLossUsd: 412_500,
    recoveredUsd: 88_200,
    atRiskUsd: 324_300,
    riskScore: 78,
    analyst: { name: "Imani Park", role: "Lead Analyst", initials: "IP" },
    jurisdiction: "US-NY",
  },
  {
    id: "case-2026-0179",
    reference: "RF-2026-0179",
    title: "Romance-scam funnel via mixer relays",
    status: "recovery",
    severity: "medium",
    openedAt: "2026-05-09T14:02:00Z",
    lastUpdate: "2026-05-26T18:20:00Z",
    asset: "BTC",
    chain: "Bitcoin",
    reportedLossUsd: 96_400,
    recoveredUsd: 71_900,
    atRiskUsd: 24_500,
    riskScore: 54,
    analyst: { name: "Daniel Okafor", role: "Recovery Specialist", initials: "DO" },
    jurisdiction: "UK",
  },
  {
    id: "case-2026-0192",
    reference: "RF-2026-0192",
    title: "Fake recovery service double-spend pattern",
    status: "triage",
    severity: "critical",
    openedAt: "2026-05-24T22:38:00Z",
    lastUpdate: "2026-05-27T01:15:00Z",
    asset: "USDT",
    chain: "Tron",
    reportedLossUsd: 215_000,
    recoveredUsd: 0,
    atRiskUsd: 215_000,
    riskScore: 91,
    analyst: { name: "Linnea Holm", role: "Triage Analyst", initials: "LH" },
    jurisdiction: "EU",
  },
  {
    id: "case-2026-0167",
    reference: "RF-2026-0167",
    title: "Compromised seed phrase — staged outflow",
    status: "investigation",
    severity: "high",
    openedAt: "2026-04-30T11:55:00Z",
    lastUpdate: "2026-05-26T09:08:00Z",
    asset: "ETH",
    chain: "Ethereum",
    reportedLossUsd: 178_900,
    recoveredUsd: 42_100,
    atRiskUsd: 136_800,
    riskScore: 67,
    analyst: { name: "Imani Park", role: "Lead Analyst", initials: "IP" },
    jurisdiction: "US-CA",
  },
  {
    id: "case-2026-0155",
    reference: "RF-2026-0155",
    title: "Phishing kit drain via approval exploit",
    status: "closed",
    severity: "low",
    openedAt: "2026-04-12T08:20:00Z",
    lastUpdate: "2026-05-21T14:00:00Z",
    asset: "USDC",
    chain: "Polygon",
    reportedLossUsd: 34_200,
    recoveredUsd: 34_200,
    atRiskUsd: 0,
    riskScore: 12,
    analyst: { name: "Daniel Okafor", role: "Recovery Specialist", initials: "DO" },
    jurisdiction: "CA",
  },
];

const TRANSACTIONS: OnChainTx[] = [
  {
    id: "tx-001",
    hash: "0x7f3c9d2a4b8e1c5f6a9d2e3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
    chain: "Ethereum",
    asset: "USDC",
    amount: "82,400.00",
    amountUsd: 82_400,
    direction: "out",
    counterparty: "0x9a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    counterpartyLabel: "Tornado Cash relay",
    riskScore: 92,
    observedAt: "2026-05-26T22:14:00Z",
  },
  {
    id: "tx-002",
    hash: "0x4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c",
    chain: "Ethereum",
    asset: "USDC",
    amount: "44,000.00",
    amountUsd: 44_000,
    direction: "out",
    counterparty: "0x3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    counterpartyLabel: "Unhosted wallet cluster A",
    riskScore: 71,
    observedAt: "2026-05-26T22:31:00Z",
  },
  {
    id: "tx-003",
    hash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    chain: "Ethereum",
    asset: "USDC",
    amount: "88,200.00",
    amountUsd: 88_200,
    direction: "in",
    counterparty: "0xExchangeColdReserve",
    counterpartyLabel: "Regulated exchange — recovered",
    riskScore: 4,
    observedAt: "2026-05-25T10:02:00Z",
  },
  {
    id: "tx-004",
    hash: "0x8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
    chain: "Ethereum",
    asset: "ETH",
    amount: "18.412",
    amountUsd: 53_140,
    direction: "out",
    counterparty: "0x7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e",
    counterpartyLabel: "Bridge contract — Arbitrum",
    riskScore: 58,
    observedAt: "2026-05-26T18:47:00Z",
  },
];

const ADDRESSES: AddressRisk[] = [
  {
    address: "0x9a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    label: "Tornado Cash relay",
    chain: "Ethereum",
    riskScore: 92,
    flags: ["Sanctioned mixer", "High velocity", "Linked to RF-2026-0192"],
    firstSeen: "2025-11-04T00:00:00Z",
    lastSeen: "2026-05-26T22:14:00Z",
    exposureUsd: 82_400,
  },
  {
    address: "0x3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    label: "Unhosted wallet cluster A",
    chain: "Ethereum",
    riskScore: 71,
    flags: ["No KYC", "Bridged to 3 chains"],
    firstSeen: "2026-02-19T00:00:00Z",
    lastSeen: "2026-05-26T22:31:00Z",
    exposureUsd: 44_000,
  },
  {
    address: "0x7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e",
    label: "Arbitrum bridge contract",
    chain: "Ethereum",
    riskScore: 32,
    flags: ["Whitelisted protocol", "Standard bridge flow"],
    firstSeen: "2025-08-01T00:00:00Z",
    lastSeen: "2026-05-26T18:47:00Z",
    exposureUsd: 53_140,
  },
];

const ALERTS: OnChainAlert[] = [
  {
    id: "alert-001",
    caseRef: "RF-2026-0184",
    title: "New outflow from monitored cluster",
    detail: "44,000 USDC moved to unhosted wallet cluster A on Ethereum.",
    severity: "critical",
    observedAt: "2026-05-26T22:31:00Z",
  },
  {
    id: "alert-002",
    caseRef: "RF-2026-0179",
    title: "Counterparty exchange opened recovery review",
    detail: "Regulated exchange acknowledged freeze request on linked deposit.",
    severity: "info",
    observedAt: "2026-05-26T17:05:00Z",
  },
  {
    id: "alert-003",
    caseRef: "RF-2026-0192",
    title: "Pattern match — known recovery-service decoy",
    detail: "Address sequence matches 3 previously flagged decoy services.",
    severity: "warning",
    observedAt: "2026-05-26T09:48:00Z",
  },
];

const THREADS: MessageThread[] = [
  {
    id: "thread-184",
    caseRef: "RF-2026-0184",
    subject: "Evidence package — exchange correspondence",
    lastActivity: "2026-05-27T02:41:00Z",
    unread: 1,
    encryption: "E2EE-AES-256",
  },
  {
    id: "thread-179",
    caseRef: "RF-2026-0179",
    subject: "Recovery disbursement — wire instructions",
    lastActivity: "2026-05-26T16:00:00Z",
    unread: 0,
    encryption: "E2EE-AES-256",
  },
  {
    id: "thread-192",
    caseRef: "RF-2026-0192",
    subject: "Initial intake follow-up",
    lastActivity: "2026-05-26T11:20:00Z",
    unread: 2,
    encryption: "E2EE-AES-256",
  },
];

const MESSAGES: Record<string, SecureMessage[]> = {
  "thread-184": [
    {
      id: "m-1",
      threadId: "thread-184",
      author: "analyst",
      authorName: "Imani Park",
      body: "We received the exchange's response and have queued the freeze acknowledgement. Please upload the wallet activity export referenced in section 3.",
      sentAt: "2026-05-26T20:11:00Z",
    },
    {
      id: "m-2",
      threadId: "thread-184",
      author: "client",
      authorName: "You",
      body: "Uploaded — exporting the second wallet now.",
      sentAt: "2026-05-26T20:34:00Z",
    },
    {
      id: "m-3",
      threadId: "thread-184",
      author: "system",
      authorName: "System",
      body: "Evidence file activity-may.csv verified (SHA-256 match).",
      sentAt: "2026-05-26T20:36:00Z",
    },
    {
      id: "m-4",
      threadId: "thread-184",
      author: "analyst",
      authorName: "Imani Park",
      body: "Thank you. We have asked counsel to confirm the jurisdictional scope before we file the formal request.",
      sentAt: "2026-05-27T02:41:00Z",
    },
  ],
  "thread-179": [
    {
      id: "m-5",
      threadId: "thread-179",
      author: "analyst",
      authorName: "Daniel Okafor",
      body: "Disbursement of 71,900 USD is queued for the wire instructions on file. Estimated settlement: 1–2 business days.",
      sentAt: "2026-05-26T16:00:00Z",
    },
  ],
  "thread-192": [
    {
      id: "m-6",
      threadId: "thread-192",
      author: "analyst",
      authorName: "Linnea Holm",
      body: "Welcome. Please confirm the wallet addresses you control so we can scope the analysis.",
      sentAt: "2026-05-26T09:14:00Z",
    },
    {
      id: "m-7",
      threadId: "thread-192",
      author: "system",
      authorName: "System",
      body: "Reminder: never share seed phrases or private keys. We will never ask for them.",
      sentAt: "2026-05-26T09:14:00Z",
    },
  ],
};

const EVIDENCE: EvidenceFile[] = [
  {
    id: "ev-1",
    caseRef: "RF-2026-0184",
    name: "exchange-correspondence.pdf",
    sizeBytes: 482_104,
    sha256: "a3f4c9d2b1e8f7a6c5d4e3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2",
    uploadedBy: "You",
    uploadedAt: "2026-05-26T19:02:00Z",
    status: "verified",
  },
  {
    id: "ev-2",
    caseRef: "RF-2026-0184",
    name: "activity-may.csv",
    sizeBytes: 91_244,
    sha256: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
    uploadedBy: "You",
    uploadedAt: "2026-05-26T20:34:00Z",
    status: "verified",
  },
  {
    id: "ev-3",
    caseRef: "RF-2026-0184",
    name: "wallet-screenshots.zip",
    sizeBytes: 2_104_882,
    sha256: "c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
    uploadedBy: "You",
    uploadedAt: "2026-05-27T01:08:00Z",
    status: "verifying",
  },
];

const CUSTODY: CustodyLogEntry[] = [
  { id: "c-1", evidenceId: "ev-1", actor: "Client (You)", action: "Uploaded over E2EE channel", at: "2026-05-26T19:02:00Z" },
  { id: "c-2", evidenceId: "ev-1", actor: "System", action: "Hashed (SHA-256) and sealed", at: "2026-05-26T19:02:00Z" },
  { id: "c-3", evidenceId: "ev-1", actor: "Imani Park (Lead Analyst)", action: "Accessed for review", at: "2026-05-26T19:48:00Z" },
  { id: "c-4", evidenceId: "ev-2", actor: "Client (You)", action: "Uploaded over E2EE channel", at: "2026-05-26T20:34:00Z" },
  { id: "c-5", evidenceId: "ev-2", actor: "System", action: "Hashed and sealed", at: "2026-05-26T20:34:00Z" },
  { id: "c-6", evidenceId: "ev-3", actor: "Client (You)", action: "Uploaded over E2EE channel", at: "2026-05-27T01:08:00Z" },
];

const TIMELINE: TimelineEvent[] = [
  {
    id: "t-1",
    caseRef: "RF-2026-0184",
    kind: "intake",
    title: "Case opened",
    detail: "Intake form received and routed to triage analyst.",
    at: "2026-05-18T09:12:00Z",
    status: "complete",
  },
  {
    id: "t-2",
    caseRef: "RF-2026-0184",
    kind: "triage",
    title: "Triage complete",
    detail: "Severity assessed as high. Lead analyst assigned.",
    at: "2026-05-18T14:30:00Z",
    status: "complete",
  },
  {
    id: "t-3",
    caseRef: "RF-2026-0184",
    kind: "evidence",
    title: "Evidence package received",
    detail: "Exchange correspondence and wallet activity export verified.",
    at: "2026-05-26T20:36:00Z",
    status: "complete",
  },
  {
    id: "t-4",
    caseRef: "RF-2026-0184",
    kind: "investigation",
    title: "On-chain analysis in progress",
    detail: "Two outflows under live monitoring; one alert pending review.",
    at: "2026-05-27T02:00:00Z",
    status: "active",
  },
  {
    id: "t-5",
    caseRef: "RF-2026-0184",
    kind: "coordination",
    title: "Counsel review of jurisdictional scope",
    detail: "Pending confirmation before a formal freeze request can be filed.",
    at: "2026-05-27T02:41:00Z",
    status: "pending",
  },
  {
    id: "t-6",
    caseRef: "RF-2026-0184",
    kind: "recovery",
    title: "Coordinated recovery request",
    detail: "Filed with regulated exchanges identified in the path of funds.",
    at: "",
    status: "pending",
  },
];

const ASSIGNMENTS: InvestigatorAssignment[] = [
  {
    caseRef: "RF-2026-0184",
    analyst: { name: "Imani Park", role: "Lead Analyst", initials: "IP" },
    nextAction: "Confirm jurisdictional scope with counsel",
    nextActionDue: "2026-05-27T18:00:00Z",
    workload: 6,
  },
  {
    caseRef: "RF-2026-0179",
    analyst: { name: "Daniel Okafor", role: "Recovery Specialist", initials: "DO" },
    nextAction: "Settle approved disbursement",
    nextActionDue: "2026-05-28T15:00:00Z",
    workload: 4,
  },
  {
    caseRef: "RF-2026-0192",
    analyst: { name: "Linnea Holm", role: "Triage Analyst", initials: "LH" },
    nextAction: "Verify controlled wallet ownership",
    nextActionDue: "2026-05-27T22:00:00Z",
    workload: 9,
  },
];

const AI_MESSAGES: AiMessage[] = [
  {
    id: "ai-1",
    role: "assistant",
    body: "I have summarized the current path of funds for case RF-2026-0184. Two outflows from the compromised address went to a sanctioned mixer relay and an unhosted cluster. One inflow of 88,200 USDC has been classified as recovered via a regulated exchange.",
    at: "2026-05-27T03:01:00Z",
    citations: ["tx-001", "tx-002", "tx-003"],
  },
  {
    id: "ai-2",
    role: "user",
    body: "What should the analyst prioritize next?",
    at: "2026-05-27T03:02:00Z",
  },
  {
    id: "ai-3",
    role: "assistant",
    body: "The 44,000 USDC outflow to cluster A is still attributable and has not yet been bridged. Filing a freeze request with the regulated counterparties downstream of that cluster would have the highest expected recovery value. I cannot file requests on my own — an analyst must review and authorize.",
    at: "2026-05-27T03:02:00Z",
    citations: ["tx-002"],
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function computeVaultSummary(cases: RefundsCase[]): VaultSummary {
  const active = cases.filter((c) => c.status !== "closed");
  const reportedLossUsd = cases.reduce((sum, c) => sum + c.reportedLossUsd, 0);
  const recoveredUsd = cases.reduce((sum, c) => sum + c.recoveredUsd, 0);
  const atRiskUsd = cases.reduce((sum, c) => sum + c.atRiskUsd, 0);
  return {
    totalCases: cases.length,
    activeCases: active.length,
    reportedLossUsd,
    recoveredUsd,
    atRiskUsd,
    recoveryRatePct: reportedLossUsd === 0 ? 0 : Math.round((recoveredUsd / reportedLossUsd) * 100),
    averageResolutionDays: 18,
    liveAlerts: ALERTS.filter((a) => a.severity !== "info").length,
  };
}

export function getVaultSummary(): VaultSummary {
  return computeVaultSummary(CASES);
}
export function getCases(): RefundsCase[] {
  return clone(CASES);
}
export function getCase(reference: string): RefundsCase | undefined {
  const found = CASES.find((c) => c.reference === reference);
  return found ? clone(found) : undefined;
}
export function getTransactions(): OnChainTx[] {
  return clone(TRANSACTIONS);
}
export function getAddressRisk(): AddressRisk[] {
  return clone(ADDRESSES);
}
export function getAlerts(): OnChainAlert[] {
  return clone(ALERTS);
}
export function getThreads(): MessageThread[] {
  return clone(THREADS);
}
export function getMessages(threadId: string): SecureMessage[] {
  return clone(MESSAGES[threadId] ?? []);
}
export function getEvidence(): EvidenceFile[] {
  return clone(EVIDENCE);
}
export function getCustodyLog(): CustodyLogEntry[] {
  return clone(CUSTODY);
}
export function getTimeline(caseRef: string): TimelineEvent[] {
  return clone(TIMELINE.filter((t) => t.caseRef === caseRef));
}
export function getInvestigatorAssignments(): InvestigatorAssignment[] {
  return clone(ASSIGNMENTS);
}
export function getAiThread(): AiMessage[] {
  return clone(AI_MESSAGES);
}

// ----------------------------------------------------------------------------
// Homepage marketing content (synthetic, swappable via these read functions).
// ----------------------------------------------------------------------------

const RECOVERY_CATEGORIES: RecoveryCategory[] = [
  {
    id: "phishing",
    name: "Phishing & approval drains",
    icon: "ScanLine",
    summary:
      "Malicious signature requests and token-approval exploits that silently drain wallets after a single interaction.",
    signals: ["Unlimited approvals", "Drainer contracts", "Spoofed dApps"],
  },
  {
    id: "wallet-compromise",
    name: "Wallet compromise",
    icon: "KeyRound",
    summary:
      "Leaked seed phrases, malware, and SIM-swap takeovers leading to unauthorized transfers from self-custody wallets.",
    signals: ["Seed exposure", "Clipboard malware", "SIM swap"],
  },
  {
    id: "investment-fraud",
    name: "Investment & romance fraud",
    icon: "HeartCrack",
    summary:
      "Long-con schemes routing victim deposits through layered wallets and fraudulent trading platforms.",
    signals: ["Fake platforms", "Pig-butchering", "Layered deposits"],
  },
  {
    id: "contract-exploit",
    name: "Smart contract exploit",
    icon: "Bug",
    summary:
      "Protocol-level exploits — reentrancy, oracle manipulation, and bridge attacks — that move pooled funds at scale.",
    signals: ["Reentrancy", "Oracle abuse", "Bridge attack"],
  },
  {
    id: "exchange-incident",
    name: "Exchange & custodian incident",
    icon: "Building2",
    summary:
      "Frozen, misdirected, or withheld balances at centralized venues requiring documented counterparty engagement.",
    signals: ["Frozen funds", "Wrong network", "Withdrawal holds"],
  },
  {
    id: "business-email",
    name: "Business payment redirection",
    icon: "Mailbox",
    summary:
      "Compromised invoicing and payment instructions that redirect corporate crypto settlements to attacker wallets.",
    signals: ["Invoice fraud", "Vendor spoof", "Treasury loss"],
  },
];

const PROCESS_STEPS: ProcessStep[] = [
  {
    index: 1,
    key: "intake",
    title: "Secure intake",
    detail:
      "You submit the incident, affected assets, and transaction hashes through an encrypted case file. Nothing is shared without authorization.",
    duration: "Day 0",
  },
  {
    index: 2,
    key: "triage",
    title: "Forensic triage",
    detail:
      "Analysts validate the loss, score recoverability, and map the initial path of funds across chains and counterparties.",
    duration: "< 6 hours",
  },
  {
    index: 3,
    key: "investigation",
    title: "Investigation",
    detail:
      "Continuous on-chain monitoring, attribution, and evidence collection build an auditable, chain-of-custody record.",
    duration: "Days 1–14",
  },
  {
    index: 4,
    key: "coordination",
    title: "Coordination",
    detail:
      "With your written authorization we engage regulated venues, custodians, counsel, and law-enforcement liaisons.",
    duration: "Ongoing",
  },
  {
    index: 5,
    key: "resolution",
    title: "Resolution & reporting",
    detail:
      "Outcomes are documented in evidence-grade reports. Recovery depends on jurisdiction and counterparty cooperation.",
    duration: "Case-dependent",
  },
];

const RECOVERY_STATS: RecoveryStat[] = [
  {
    id: "assets-traced",
    label: "Assets traced",
    value: 482,
    prefix: "$",
    suffix: "M",
    caption: "Cumulative value mapped on-chain across active and closed cases.",
  },
  {
    id: "chains",
    label: "Chains analyzed",
    value: 17,
    caption: "Networks under continuous monitoring and path analysis.",
  },
  {
    id: "cases",
    label: "Cases investigated",
    value: 1240,
    suffix: "+",
    caption: "Forensic investigations opened since platform inception.",
  },
  {
    id: "triage",
    label: "Median triage",
    value: 5.8,
    decimals: 1,
    suffix: "h",
    caption: "Time from intake to a scored recoverability assessment.",
  },
];

const RECOVERY_TREND: RecoveryTrendPoint[] = [
  { month: "Jan", recoveredUsd: 2.1, casesOpened: 64 },
  { month: "Feb", recoveredUsd: 3.4, casesOpened: 71 },
  { month: "Mar", recoveredUsd: 2.9, casesOpened: 83 },
  { month: "Apr", recoveredUsd: 4.6, casesOpened: 96 },
  { month: "May", recoveredUsd: 5.2, casesOpened: 102 },
  { month: "Jun", recoveredUsd: 6.8, casesOpened: 118 },
  { month: "Jul", recoveredUsd: 6.1, casesOpened: 109 },
  { month: "Aug", recoveredUsd: 7.9, casesOpened: 124 },
];

const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: "approval-drains",
    category: "Threat intel",
    title: "How approval drainers empty a wallet in a single signature",
    excerpt:
      "A breakdown of the token-approval pattern behind the year's most common self-custody losses — and the on-chain signals that expose it.",
    readMinutes: 7,
    publishedAt: "2026-05-28",
  },
  {
    id: "chain-of-custody",
    category: "Compliance",
    title: "Building evidence that holds up: chain-of-custody for digital assets",
    excerpt:
      "What separates a screenshot from admissible forensic evidence, and how hashing and sealing preserve integrity end to end.",
    readMinutes: 9,
    publishedAt: "2026-05-12",
  },
  {
    id: "bridge-tracing",
    category: "Investigations",
    title: "Following funds across bridges without losing the trail",
    excerpt:
      "Cross-chain laundering is designed to break attribution. Here is how analysts re-stitch the path of funds after a bridge hop.",
    readMinutes: 8,
    publishedAt: "2026-04-30",
  },
  {
    id: "pig-butchering",
    category: "Fraud",
    title: "Anatomy of a pig-butchering deposit funnel",
    excerpt:
      "Layered deposit wallets, fake trading dashboards, and the recovery windows that close fast — what victims should preserve first.",
    readMinutes: 6,
    publishedAt: "2026-04-15",
  },
];

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "guarantee",
    question: "Can you guarantee my funds will be recovered?",
    answer:
      "No. No legitimate recovery service can guarantee an outcome. Recovery depends on jurisdiction, counterparty cooperation, the asset involved, and how quickly funds are traced. We provide an honest recoverability assessment after triage.",
  },
  {
    id: "reverse",
    question: "Can you reverse a blockchain transaction?",
    answer:
      "On-chain transactions are final and cannot be reversed. Our work focuses on tracing assets, building evidence, and coordinating with regulated venues and counsel where funds can lawfully be frozen or returned.",
  },
  {
    id: "custody",
    question: "Do you take custody of my assets or wallet keys?",
    answer:
      "Never. Netspy-World Forensics does not custody assets and does not request your private keys or seed phrase. Investigations are read-only on-chain unless you provide explicit written authorization for a specific action.",
  },
  {
    id: "data",
    question: "How is my case data protected?",
    answer:
      "Case files are encrypted in transit and at rest, handled under SOC 2 controls, and access is scoped to your assigned analysts. Evidence is hashed and logged to a tamper-evident chain of custody.",
  },
  {
    id: "law-enforcement",
    question: "Do you work with law enforcement?",
    answer:
      "When appropriate and with your authorization, we prepare evidence packages for counsel and act as a liaison to law-enforcement and regulated counterparties. We do not act unilaterally on your behalf.",
  },
  {
    id: "cost",
    question: "How quickly should I start a case?",
    answer:
      "As soon as possible. Recovery windows narrow as funds move and settle. Early tracing and counterparty engagement materially improve the chances of a favorable outcome.",
  },
];

const ECOSYSTEM_MAP: EcosystemColumn[] = [
  {
    heading: "Platform",
    links: [
      { label: "Secure portal", href: "/refunds/sign-in" },
      { label: "Open a case", href: "/refunds/sign-up" },
      { label: "Recovery vault", href: "/refunds/portal" },
      { label: "Services & pricing", href: "/refunds/services" },
      { label: "Brand system", href: "/refunds/brand" },
    ],
  },
  {
    heading: "Capabilities",
    links: [
      { label: "Blockchain intelligence", href: "#intelligence" },
      { label: "Investigation operations", href: "#operations" },
      { label: "AI recovery assistant", href: "#assistant" },
      { label: "Recovery statistics", href: "#statistics" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Knowledge base", href: "/refunds/knowledge-base" },
      { label: "Recovery process", href: "#process" },
      { label: "FAQ", href: "#faq" },
      { label: "Recovery categories", href: "#categories" },
    ],
  },
  {
    heading: "Trust & legal",
    links: [
      { label: "Certifications", href: "/refunds/certifications" },
      { label: "Compliance posture", href: "#compliance" },
      { label: "Privacy by design", href: "#compliance" },
      { label: "Terms of engagement", href: "#compliance" },
    ],
  },
];

export function getRecoveryCategories(): RecoveryCategory[] {
  return clone(RECOVERY_CATEGORIES);
}
export function getProcessSteps(): ProcessStep[] {
  return clone(PROCESS_STEPS);
}
export function getRecoveryStats(): RecoveryStat[] {
  return clone(RECOVERY_STATS);
}
export function getRecoveryTrend(): RecoveryTrendPoint[] {
  return clone(RECOVERY_TREND);
}
export function getBlogArticles(): BlogArticle[] {
  return clone(BLOG_ARTICLES);
}
export function getFaqEntries(): FaqEntry[] {
  return clone(FAQ_ENTRIES);
}
export function getEcosystemMap(): EcosystemColumn[] {
  return clone(ECOSYSTEM_MAP);
}
