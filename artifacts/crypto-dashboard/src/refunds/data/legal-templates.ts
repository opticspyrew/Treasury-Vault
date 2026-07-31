// ---------------------------------------------------------------------------
// Legal coordination templates.
//
// Pure functions that turn a server-composed CaseReport into formatted legal
// correspondence (freeze requests, law-enforcement referrals, VASP information
// requests, preservation notices). The CaseReport is fetched from the
// ownership-enforced /reports endpoint, so these documents are "backend-backed"
// — the firm and case facts they cite come from our datastore, not the client.
// ---------------------------------------------------------------------------

import type { CaseReport } from "./types";

export type LegalDocType =
  | "exchange_freeze"
  | "law_enforcement"
  | "vasp_compliance"
  | "asset_preservation";

export interface LegalDoc {
  type: LegalDocType;
  label: string;
  recipient: string;
  title: string;
  body: string;
}

export const LEGAL_DOC_TYPES: ReadonlyArray<{
  type: LegalDocType;
  label: string;
  description: string;
}> = [
  {
    type: "exchange_freeze",
    label: "Exchange Freeze Request",
    description:
      "Ask a VASP/exchange compliance team to preserve and freeze funds tied to the case.",
  },
  {
    type: "law_enforcement",
    label: "Law Enforcement Referral",
    description:
      "A referral packet summarizing the incident for a cybercrime unit (IC3, Action Fraud, local police).",
  },
  {
    type: "vasp_compliance",
    label: "VASP Information Request",
    description: "A Travel-Rule / KYC information request to a virtual asset service provider.",
  },
  {
    type: "asset_preservation",
    label: "Asset Preservation Notice",
    description: "Puts a custodian on notice to preserve assets pending legal process.",
  },
];

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtAmount(report: CaseReport): string {
  const { amount, currency } = report.case;
  if (!amount) return "an undisclosed amount of digital assets";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "USD" ? `$${formatted} USD` : `${formatted} ${currency}`;
}

function hashesBlock(report: CaseReport): string {
  if (report.case.txHashes.length === 0) {
    return "  (no transaction hashes were provided with this case)";
  }
  return report.case.txHashes.map((h) => `  • ${h}`).join("\n");
}

function signature(report: CaseReport): string {
  return [
    "Respectfully,",
    "",
    "Investigations Desk",
    report.firm.brand,
    report.firm.legalName,
    "Digital Asset Recovery & Blockchain Forensics",
  ].join("\n");
}

function caseFacts(report: CaseReport): string {
  return [
    `Case reference:   ${report.reference}`,
    `Incident type:    ${report.case.incident ?? "Digital asset loss"}`,
    `Asset:            ${report.case.asset ?? "Not specified"}`,
    `Network / chain:  ${report.case.chain ?? "Not specified"}`,
    `Reported loss:    ${fmtAmount(report)}`,
    `Reported on:      ${fmtDate(report.case.submittedAt)}`,
  ].join("\n");
}

export function buildLegalDoc(type: LegalDocType, report: CaseReport): LegalDoc {
  const header = [
    report.firm.legalName,
    `${report.firm.brand} — Digital Asset Recovery & Blockchain Forensics`,
    "",
    `Date: ${fmtDate(report.generatedAt)}`,
  ].join("\n");

  const meta = LEGAL_DOC_TYPES.find((d) => d.type === type)!;

  if (type === "exchange_freeze") {
    const title = "Virtual Asset Freeze & Preservation Request";
    const body = [
      header,
      "",
      "To: Compliance / Law Enforcement Liaison Team",
      "Re: Urgent request to preserve and freeze proceeds of suspected fraud",
      "",
      `On behalf of our client, ${report.client.name}, ${report.firm.brand} is conducting a`,
      "blockchain forensic investigation into the misappropriation of digital assets.",
      "We have traced funds connected to the following case to wallets and/or deposit",
      "addresses understood to be under your platform's control.",
      "",
      caseFacts(report),
      "",
      "Transaction hashes under investigation:",
      hashesBlock(report),
      "",
      `We respectfully request that you (1) preserve all account records and on-chain`,
      "activity associated with the addresses above, and (2) place an administrative hold",
      "on any associated balances to prevent further dissipation, pending formal legal",
      "process. We are prepared to support a corresponding law-enforcement request and to",
      "provide our full tracing report under appropriate legal authority.",
      "",
      "This notice does not constitute a legal demand on its own; please advise of your",
      "platform's required process for emergency preservation.",
      "",
      signature(report),
    ].join("\n");
    return { type, label: meta.label, recipient: "Exchange / VASP Compliance Team", title, body };
  }

  if (type === "law_enforcement") {
    const title = "Law Enforcement Referral — Suspected Digital Asset Theft";
    const body = [
      header,
      "",
      "To: Cybercrime / Financial Crimes Unit",
      "Re: Referral of a suspected cryptocurrency theft for investigation",
      "",
      `This packet is submitted in support of a complaint by ${report.client.name}, who`,
      `reports the loss of ${fmtAmount(report)} through a suspected fraudulent scheme.`,
      `${report.firm.brand} has performed an independent blockchain forensic review.`,
      "",
      caseFacts(report),
      "",
      "On-chain transaction references:",
      hashesBlock(report),
      "",
      "We are able to provide: a full transaction tracing report, attribution notes for",
      "intermediary and destination wallets, identified off-ramps / exchange deposits, and",
      "a chain-of-custody record for all evidence. We respectfully request that this matter",
      "be assigned for investigation and that preservation letters be issued to the relevant",
      "virtual asset service providers without delay.",
      "",
      "The complainant consents to this referral and to the sharing of the underlying",
      "evidence with law enforcement.",
      "",
      signature(report),
    ].join("\n");
    return { type, label: meta.label, recipient: "Cybercrime / Financial Crimes Unit", title, body };
  }

  if (type === "vasp_compliance") {
    const title = "Virtual Asset Service Provider — Information Request";
    const body = [
      header,
      "",
      "To: Compliance Officer / MLRO",
      "Re: Travel Rule / KYC information request in support of a fraud investigation",
      "",
      `${report.firm.brand} is investigating the misappropriation of digital assets`,
      `belonging to our client, ${report.client.name}. Tracing indicates that proceeds`,
      "passed through deposit addresses associated with your service.",
      "",
      caseFacts(report),
      "",
      "Addresses / transactions in scope:",
      hashesBlock(report),
      "",
      "Pursuant to your AML/CFT obligations and applicable Travel Rule requirements, we",
      "request confirmation of whether the above addresses correspond to accounts on your",
      "platform and, subject to your legal process, the preservation of associated KYC",
      "records, originator/beneficiary information, and transaction logs.",
      "",
      "We will follow this request with appropriate legal authority. Please advise of the",
      "process and point of contact for such disclosures.",
      "",
      signature(report),
    ].join("\n");
    return { type, label: meta.label, recipient: "VASP Compliance Officer / MLRO", title, body };
  }

  const title = "Asset Preservation Notice";
  const body = [
    header,
    "",
    "To: Custodian / Account Provider",
    "Re: Notice to preserve assets and records pending legal process",
    "",
    `Please be advised that ${report.firm.brand}, on behalf of ${report.client.name}, is`,
    "investigating the loss of digital assets connected to the matter described below.",
    "This letter places you on formal notice to preserve all relevant assets and records.",
    "",
    caseFacts(report),
    "",
    "Relevant on-chain references:",
    hashesBlock(report),
    "",
    "You are requested to retain — and to refrain from deleting, altering, or transferring",
    "— all account balances, transaction history, communications, and identity records",
    "associated with the addresses above. Destruction or dissipation of this material may",
    "prejudice an ongoing investigation and subsequent legal proceedings.",
    "",
    "Formal legal process will follow. Please confirm receipt and your preservation steps.",
    "",
    signature(report),
  ].join("\n");
  return { type, label: meta.label, recipient: "Custodian / Account Provider", title, body };
}
