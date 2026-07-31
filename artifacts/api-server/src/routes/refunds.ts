import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { db, pool, type User } from "@workspace/db";
import { adminClients, adminServiceRequests, adminActivityLog } from "@workspace/db";
import { eq, and, or, isNull, notInArray, desc } from "drizzle-orm";
import { extractBearerToken, findUserBySessionToken } from "../lib/auth";
import { sendAdminEmail, newServiceRequestEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { enqueueOutboundCaseCreate } from "../lib/manus/outbound-hooks";
import {
  getOpenAIClient,
  isOpenAIConfigured,
  OPENAI_MODEL,
  OPENAI_MAX_COMPLETION_TOKENS,
} from "../lib/openai";

const router = Router();

// ---------------------------------------------------------------------------
// Refunds.site homepage content.
//
// The marketing homepage used to render from hard-coded mock data shipped in
// the frontend bundle. These endpoints make it render from the backend
// instead: the recovery statistics and the trend chart are computed from real
// service-request rows, while the recovery categories are content the backend
// owns as the source of truth.
// ---------------------------------------------------------------------------

interface RecoveryStat {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  caption: string;
}

interface RecoveryCategory {
  id: string;
  name: string;
  icon: string;
  summary: string;
  signals: string[];
}

interface RecoveryTrendPoint {
  month: string;
  recoveredUsd: number;
  casesOpened: number;
}

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

const HOMEPAGE_CACHE_TTL_MS = 30_000;
let homepageCache: {
  payload: { stats: RecoveryStat[]; categories: RecoveryCategory[]; trend: RecoveryTrendPoint[] };
  fetchedAt: number;
} | null = null;

async function computeStats(): Promise<RecoveryStat[]> {
  const { rows } = await pool.query<{
    total_cases: string;
    reported_usd: string;
    recovered_usd: string;
    avg_resolution_hours: string | null;
  }>(`
    SELECT
      COUNT(*)::text AS total_cases,
      COALESCE(SUM(amount), 0)::text AS reported_usd,
      COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::text AS recovered_usd,
      ROUND(
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)
          FILTER (WHERE status IN ('approved', 'processing')),
        1
      )::text AS avg_resolution_hours
    FROM admin_service_requests
  `);

  const r = rows[0];
  const totalCases = Number(r?.total_cases ?? 0);
  const reportedUsd = Math.round(Number(r?.reported_usd ?? 0));
  const recoveredUsd = Math.round(Number(r?.recovered_usd ?? 0));
  const avgHours = r?.avg_resolution_hours != null ? Number(r.avg_resolution_hours) : 0;

  return [
    {
      id: "assets-traced",
      label: "Assets traced",
      value: reportedUsd,
      prefix: "$",
      caption: "Cumulative reported value across every intake case on the platform.",
    },
    {
      id: "funds-recovered",
      label: "Funds recovered",
      value: recoveredUsd,
      prefix: "$",
      caption: "Value released on cases that reached an approved recovery outcome.",
    },
    {
      id: "cases",
      label: "Cases investigated",
      value: totalCases,
      caption: "Forensic intake cases opened and worked since platform inception.",
    },
    {
      id: "resolution",
      label: "Avg. resolution",
      value: avgHours,
      decimals: 1,
      suffix: "h",
      caption: "Average time from intake to a scored recoverability decision.",
    },
  ];
}

async function computeTrend(): Promise<RecoveryTrendPoint[]> {
  const { rows } = await pool.query<{
    month: string;
    cases_opened: string;
    recovered_usd: string;
  }>(`
    WITH months AS (
      SELECT date_trunc('month', (now() - (n || ' month')::interval)) AS m
      FROM generate_series(7, 0, -1) AS n
    )
    SELECT
      to_char(months.m, 'Mon') AS month,
      COALESCE(COUNT(r.id), 0)::text AS cases_opened,
      COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'approved'), 0)::text AS recovered_usd
    FROM months
    LEFT JOIN admin_service_requests r
      ON date_trunc('month', r.created_at) = months.m
    GROUP BY months.m
    ORDER BY months.m
  `);

  return rows.map((row) => ({
    month: row.month,
    casesOpened: Number(row.cases_opened),
    recoveredUsd: Math.round(Number(row.recovered_usd)),
  }));
}

router.get("/homepage", async (_req: Request, res: Response): Promise<void> => {
  const now = Date.now();
  if (homepageCache && now - homepageCache.fetchedAt < HOMEPAGE_CACHE_TTL_MS) {
    res.json(homepageCache.payload);
    return;
  }

  try {
    const [stats, trend] = await Promise.all([computeStats(), computeTrend()]);
    const payload = { stats, categories: RECOVERY_CATEGORIES, trend };
    homepageCache = { payload, fetchedAt: now };
    res.json(payload);
  } catch (err) {
    logger.error({ err }, "Failed to build refunds homepage payload");
    res.status(500).json({ error: "Failed to load homepage data" });
  }
});

// ---------------------------------------------------------------------------
// Case intake submission.
//
// The portal's multi-step intake form used to be a no-op that flipped a local
// "submitted" flag. This endpoint persists the intake as a real service
// request for the signed-in user and returns a human-readable case reference.
// ---------------------------------------------------------------------------

const intakeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, "Refunds intake rate limit exceeded");
    res.status(429).json({ error: "Too many requests, please try again in a minute." });
  },
});

function caseReference(id: number, createdAt: Date): string {
  return `RF-${createdAt.getUTCFullYear()}-${String(id).padStart(4, "0")}`;
}

// The intake handler stores the structured incident/asset/chain values inside
// the free-text `notes` column. Parse them back out so the client-facing case
// list can present them as discrete fields without a schema change.
function parseIntakeNotes(notes: string | null): {
  incident: string | null;
  asset: string | null;
  chain: string | null;
} {
  if (!notes) return { incident: null, asset: null, chain: null };
  const incident = notes.match(/^Incident type:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const assetChain = notes.match(/^Asset \/ chain:\s*(.+?)\s+on\s+(.+)$/m);
  return {
    incident,
    asset: assetChain?.[1]?.trim() ?? null,
    chain: assetChain?.[2]?.trim() ?? null,
  };
}

router.post("/intake", intakeLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    const user = token ? await findUserBySessionToken(token) : undefined;
    if (!user) {
      res.status(401).json({ error: "Sign in required to submit a case." });
      return;
    }

    const { incident, asset, chain, amount, txHashes, evidenceCount } = req.body as {
      incident?: string;
      asset?: string;
      chain?: string;
      amount?: string;
      txHashes?: string;
      evidenceCount?: number;
    };

    if (!incident || !asset || !chain) {
      res.status(400).json({ error: "Incident type, asset, and chain are required." });
      return;
    }

    // `amount` is optional, but when present it must be a real, non-negative
    // number that fits the numeric(14, 2) column (max 999,999,999,999.99).
    // Otherwise a malformed value like "1.2.3" — or a non-string JSON payload
    // (number/object/array) that would throw on string ops — reaches Postgres
    // as a cast and surfaces as a 500 instead of a clean 400.
    const amountInvalid = () => {
      res.status(400).json({
        error: "Loss amount must be a valid non-negative number.",
      });
    };

    if (amount != null && typeof amount !== "string") {
      amountInvalid();
      return;
    }

    const normalizedAmount = amount ? amount.replace(/,/g, "").trim() : "";
    if (normalizedAmount) {
      const AMOUNT_UPPER_BOUND = 1_000_000_000_000; // exclusive; numeric(14, 2) caps at 12 integer digits
      const parsedAmount = Number(normalizedAmount);
      const isWellFormed = /^\d+(\.\d+)?$/.test(normalizedAmount);
      if (
        !isWellFormed ||
        !Number.isFinite(parsedAmount) ||
        parsedAmount < 0 ||
        parsedAmount >= AMOUNT_UPPER_BOUND
      ) {
        amountInvalid();
        return;
      }
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    let [client] = await db
      .select()
      .from(adminClients)
      .where(eq(adminClients.email, normalizedEmail));

    if (!client) {
      const [newClient] = await db
        .insert(adminClients)
        .values({
          name: user.name?.trim() || normalizedEmail.split("@")[0],
          email: normalizedEmail,
          status: "pending",
        })
        .returning();
      client = newClient;

      await db.insert(adminActivityLog).values({
        eventType: "client_registered",
        clientId: client.id,
        description: `Client auto-created from case intake: ${client.name} (${client.email})`,
        metadata: { name: client.name, email: client.email },
      });
    }

    const noteLines = [
      `Incident type: ${incident}`,
      `Asset / chain: ${asset} on ${chain}`,
      evidenceCount ? `Evidence files attached: ${evidenceCount}` : null,
      txHashes?.trim() ? `Transaction hashes:\n${txHashes.trim()}` : null,
    ].filter(Boolean);

    const [request] = await db
      .insert(adminServiceRequests)
      .values({
        clientId: client.id,
        type: "recovery_case",
        amount: normalizedAmount ? normalizedAmount : null,
        currency: "USD",
        notes: noteLines.join("\n"),
        status: "pending",
      })
      .returning();

    await db.insert(adminActivityLog).values({
      eventType: "service_request_submitted",
      clientId: client.id,
      serviceRequestId: request.id,
      description: `Recovery case intake from ${client.name}: ${incident} (${asset}/${chain})`,
      metadata: { type: "recovery_case", incident, asset, chain, amount: normalizedAmount || null },
    });

    const reference = caseReference(request.id, request.createdAt as Date);

    const { subject, html } = newServiceRequestEmail({
      client: { name: client.name, email: client.email },
      request: { ...request, type: "Recovery Case Intake", createdAt: request.createdAt as Date },
    });
    const emailSent = await sendAdminEmail(subject, html);

    // A new intake changes the homepage aggregates, so drop the cache.
    homepageCache = null;

    logger.info(
      { clientId: client.id, requestId: request.id, emailSent },
      "Recovery case intake submitted",
    );

    // Best-effort push to Netspy. Inert unless outbound sync is enabled and
    // configured; never blocks or fails the intake response.
    enqueueOutboundCaseCreate({
      caseId: request.id,
      reference,
      clientEmail: client.email,
      clientName: client.name,
      amount: normalizedAmount ? normalizedAmount : null,
      description: `${incident} (${asset}/${chain})`,
      chains: [chain],
      transactionHashes: txHashes?.trim() ? txHashes.trim().split(/\s+/) : undefined,
    });

    res.status(201).json({ reference, requestId: request.id });
  } catch (err) {
    logger.error({ err }, "Failed to submit recovery case intake");
    res.status(500).json({ error: "Failed to submit case intake" });
  }
});

// ---------------------------------------------------------------------------
// "My cases" — authenticated case list.
//
// Returns only the recovery cases belonging to the signed-in user, resolved
// from their email to an admin_clients row. Other request types and other
// clients' cases are never returned.
// ---------------------------------------------------------------------------

router.get("/cases", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    const user = token ? await findUserBySessionToken(token) : undefined;
    if (!user) {
      res.status(401).json({ error: "Sign in required to view your cases." });
      return;
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    const [client] = await db
      .select()
      .from(adminClients)
      .where(eq(adminClients.email, normalizedEmail));

    // No client row means the user has never filed a case.
    if (!client) {
      res.json({ cases: [] });
      return;
    }

    const rows = await db
      .select()
      .from(adminServiceRequests)
      .where(
        and(
          eq(adminServiceRequests.clientId, client.id),
          eq(adminServiceRequests.type, "recovery_case"),
        ),
      )
      .orderBy(desc(adminServiceRequests.createdAt));

    const cases = rows.map((row) => {
      const { incident, asset, chain } = parseIntakeNotes(row.notes);
      const createdAt = row.createdAt as Date;
      return {
        id: row.id,
        reference: caseReference(row.id, createdAt),
        incident,
        asset,
        chain,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        submittedAt: createdAt.toISOString(),
      };
    });

    res.json({ cases });
  } catch (err) {
    logger.error({ err }, "Failed to load client recovery cases");
    res.status(500).json({ error: "Failed to load your cases" });
  }
});

// ---------------------------------------------------------------------------
// Case report — composed forensic report for a single owned case.
//
// Builds a structured, exportable report from the signed-in client's own case
// record and their investigation activity. Ownership is enforced: the case must
// resolve to the caller's client row, so one client can never read another's
// report. This reads from our own datastore today; when the Manus integration
// lands, the backend sync populates these same tables, so this endpoint and the
// frontend that consumes it stay unchanged.
// ---------------------------------------------------------------------------

function referenceToId(reference: string): number | null {
  const match = /^RF-\d{4}-(\d+)$/.exec(reference.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseTxHashes(notes: string | null): string[] {
  if (!notes) return [];
  const block = notes.match(/Transaction hashes:\s*\n([\s\S]*)$/);
  if (!block) return [];
  return block[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

interface CaseReport {
  reference: string;
  generatedAt: string;
  firm: { legalName: string; brand: string; jurisdictionNote: string };
  client: { name: string; email: string };
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
  activity: { at: string; eventType: string; description: string }[];
}

type LoadReportResult =
  | { ok: true; report: CaseReport }
  | { ok: false; status: number; error: string };

// Activity event types that belong to a specific case rather than the client as
// a whole. When such an event has no owning case (serviceRequestId IS NULL) we
// cannot attribute it, so a case report excludes it rather than show it on every
// case. Keep this in sync with the inserts that set serviceRequestId.
const CASE_SPECIFIC_EVENT_TYPES = ["service_request_submitted", "request_status_changed"];

// Resolve and build a case report for the signed-in user, enforcing ownership.
// Shared by the structured report endpoint and the AI narrative endpoint so the
// ownership check and report shape live in exactly one place.
async function loadCaseReportForUser(
  user: User,
  referenceRaw: string,
): Promise<LoadReportResult> {
  const reference = (referenceRaw ?? "").trim();
  const id = referenceToId(reference);
  if (!id) return { ok: false, status: 400, error: "Invalid case reference." };

  const normalizedEmail = user.email.toLowerCase().trim();
  const [client] = await db
    .select()
    .from(adminClients)
    .where(eq(adminClients.email, normalizedEmail));

  if (!client) return { ok: false, status: 404, error: "Case not found." };

  const [row] = await db
    .select()
    .from(adminServiceRequests)
    .where(
      and(
        eq(adminServiceRequests.id, id),
        eq(adminServiceRequests.clientId, client.id),
        eq(adminServiceRequests.type, "recovery_case"),
      ),
    );

  if (!row) return { ok: false, status: 404, error: "Case not found." };

  const createdAt = row.createdAt as Date;
  if (caseReference(row.id, createdAt) !== reference) {
    return { ok: false, status: 404, error: "Case not found." };
  }

  const { incident, asset, chain } = parseIntakeNotes(row.notes);

  // Scope activity to this case. Include events explicitly tagged to it, plus
  // genuinely client-level events (serviceRequestId IS NULL and NOT a
  // case-specific event type, e.g. registration/KYC). Two classes are excluded:
  // events tagged to a *different* case, and untagged case-specific events
  // (legacy rows from before this column existed, or rows nulled when a sibling
  // case was deleted) — those cannot be attributed to a case, so they are never
  // shown rather than risk leaking one case's timeline into another's report.
  const activityRows = await db
    .select()
    .from(adminActivityLog)
    .where(
      and(
        eq(adminActivityLog.clientId, client.id),
        or(
          eq(adminActivityLog.serviceRequestId, row.id),
          and(
            isNull(adminActivityLog.serviceRequestId),
            notInArray(adminActivityLog.eventType, CASE_SPECIFIC_EVENT_TYPES),
          ),
        ),
      ),
    )
    .orderBy(desc(adminActivityLog.createdAt))
    .limit(50);

  const report: CaseReport = {
    reference: caseReference(row.id, createdAt),
    generatedAt: new Date().toISOString(),
    firm: {
      legalName: "NETSPYWORLD FORENSICS LTD",
      brand: "Netspy-World Forensics",
      jurisdictionNote:
        "Findings are based on information available at time of generation. Outcomes depend on jurisdiction, counterparty cooperation, and the underlying asset — recovery is never guaranteed.",
    },
    client: { name: client.name, email: client.email },
    case: {
      id: row.id,
      reference: caseReference(row.id, createdAt),
      incident,
      asset,
      chain,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      submittedAt: createdAt.toISOString(),
      txHashes: parseTxHashes(row.notes),
    },
    activity: activityRows.map((a) => ({
      at: (a.createdAt as Date).toISOString(),
      eventType: a.eventType,
      description: a.description,
    })),
  };

  return { ok: true, report };
}

router.get("/reports/:reference", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractBearerToken(req);
    const user = token ? await findUserBySessionToken(token) : undefined;
    if (!user) {
      res.status(401).json({ error: "Sign in required to view reports." });
      return;
    }

    const referenceParam = Array.isArray(req.params.reference)
      ? req.params.reference[0]
      : req.params.reference;

    const result = await loadCaseReportForUser(user, referenceParam ?? "");
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ report: result.report });
  } catch (err) {
    logger.error({ err }, "Failed to build case report");
    res.status(500).json({ error: "Failed to build report" });
  }
});

// ---------------------------------------------------------------------------
// AI assistant.
//
// Two authenticated, rate-limited endpoints back the portal's forensics
// assistant. Both are stateless — no conversation is persisted server-side;
// the client owns the transcript and replays it on each turn. The assistant
// operates under strict guardrails baked into the system prompt: it never
// guarantees recovery, never gives legal advice, and never offers to act on
// the chain or contact counterparties.
// ---------------------------------------------------------------------------

type AiMode = "recovery" | "forensics";

interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

const AI_MAX_MESSAGES = 24;
const AI_MAX_CHARS_PER_MESSAGE = 4000;
const AI_MAX_TOTAL_CHARS = 16000;

// The AI endpoints are the only places that spend OpenAI credits, so they get a
// layered guard: a coarse IP limiter to blunt anonymous floods before any DB or
// OpenAI work, then authentication, then per-user limiters for fair access and a
// hard daily ceiling on spend. Resolving the user up front (requireRefundsUser)
// lets the per-user limiters key on the account rather than the IP, which is what
// makes them accurate behind shared NATs/proxies.
interface AuthedAiRequest extends Request {
  refundsUser?: User;
}

async function requireRefundsUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    const user = token ? await findUserBySessionToken(token) : undefined;
    if (!user) {
      res.status(401).json({ error: "Sign in required to use the assistant." });
      return;
    }
    (req as AuthedAiRequest).refundsUser = user;
    next();
  } catch (err) {
    logger.error({ err }, "Failed to authenticate AI request");
    res.status(500).json({ error: "Failed to verify your session." });
  }
}

function aiRateLimitHandler(scope: string) {
  return (req: Request, res: Response): void => {
    logger.warn({ ip: req.ip, path: req.path, scope }, "Refunds AI rate limit exceeded");
    res.status(429).json({ error: "Too many requests, please slow down and try again shortly." });
  };
}

// Keyed on the authenticated user when present (set by requireRefundsUser), with
// an IP fallback for safety. Used by the per-user limiters that run after auth.
function aiUserKey(req: Request): string {
  const user = (req as AuthedAiRequest).refundsUser;
  return user ? `refunds-ai-user:${user.id}` : ipKeyGenerator(req.ip ?? "");
}

const aiIpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  handler: aiRateLimitHandler("ip"),
});

const aiUserLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: aiUserKey,
  handler: aiRateLimitHandler("user-minute"),
});

const aiUserDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60_000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: aiUserKey,
  handler: aiRateLimitHandler("user-day"),
});

// Shared middleware chain for every credit-spending AI route, in order:
// coarse IP guard -> authenticate -> per-user minute limit -> per-user daily cap.
const aiChain = [aiIpLimiter, requireRefundsUser, aiUserLimiter, aiUserDailyLimiter];

const AI_GUARDRAILS = [
  "You are the assistant for Netspy-World Forensics (legal entity NETSPYWORLD FORENSICS LTD), a digital-asset tracing and recovery firm.",
  "Hard rules you must never break:",
  "- Never promise, guarantee, or imply a specific recovery outcome, amount, timeline, or success rate. Recovery is never guaranteed and depends on jurisdiction, counterparty cooperation, and the underlying asset.",
  "- Never provide legal advice. For anything legal, direct the client to a licensed attorney or to the firm's analysts who coordinate with counsel.",
  "- Never offer to take action yourself: you cannot freeze funds, contact exchanges, counterparties, or law enforcement, file anything, or move assets. A licensed analyst must review and authorize any such step.",
  "- Never invent case facts, statistics, balances, or addresses. If you do not have a fact, say so.",
  "- Do not request seed phrases, private keys, passwords, or other secrets, and warn the user never to share them.",
  "Style: precise, calm, and professional. Be concise. Use plain language a non-technical victim can follow, and end with the concrete next step the client can take.",
].join("\n");

const AI_MODE_PROMPTS: Record<AiMode, string> = {
  recovery: [
    "Mode: RECOVERY GUIDANCE.",
    "Help the client understand the recovery process: what evidence to preserve (transaction hashes, wallet addresses, dates, communications, exchange tickets), what factors affect recoverability, what to expect at each stage, and how the firm's analysts coordinate the work.",
    "Frame realistic expectations without ever guaranteeing an outcome.",
  ].join("\n"),
  forensics: [
    "Mode: ON-CHAIN FORENSICS.",
    "Help the client understand blockchain tracing and analysis concepts: how funds are followed across addresses and bridges, common laundering patterns (peel chains, mixers, layering through exchanges), risk signals, and what on-chain evidence supports a case.",
    "Explain analytical reasoning at a conceptual level; do not fabricate specific on-chain findings for the client's case.",
  ].join("\n"),
};

function parseChatRequest(
  body: unknown,
): { ok: true; mode: AiMode; messages: AiChatMessage[] } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const { mode, messages } = body as { mode?: unknown; messages?: unknown };

  if (mode !== "recovery" && mode !== "forensics") {
    return { ok: false, error: "mode must be either 'recovery' or 'forensics'." };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "messages must be a non-empty array." };
  }
  if (messages.length > AI_MAX_MESSAGES) {
    return { ok: false, error: `Conversation is too long (max ${AI_MAX_MESSAGES} messages).` };
  }

  const cleaned: AiChatMessage[] = [];
  let totalChars = 0;
  for (const raw of messages) {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, error: "Each message must be an object with role and content." };
    }
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") {
      return { ok: false, error: "Each message role must be 'user' or 'assistant'." };
    }
    if (typeof content !== "string" || content.trim().length === 0) {
      return { ok: false, error: "Each message must have non-empty string content." };
    }
    if (content.length > AI_MAX_CHARS_PER_MESSAGE) {
      return { ok: false, error: `A message exceeds the ${AI_MAX_CHARS_PER_MESSAGE}-character limit.` };
    }
    totalChars += content.length;
    cleaned.push({ role, content });
  }
  if (totalChars > AI_MAX_TOTAL_CHARS) {
    return { ok: false, error: "Conversation is too large. Start a new conversation." };
  }
  if (cleaned[cleaned.length - 1].role !== "user") {
    return { ok: false, error: "The last message must come from the user." };
  }

  return { ok: true, mode, messages: cleaned };
}

router.post("/ai/chat", ...aiChain, async (req: Request, res: Response): Promise<void> => {
  if (!isOpenAIConfigured()) {
    res.status(503).json({ error: "The assistant is not configured yet. Please try again later." });
    return;
  }

  const parsed = parseChatRequest(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model: OPENAI_MODEL,
      max_completion_tokens: OPENAI_MAX_COMPLETION_TOKENS,
      stream: true,
      messages: [
        { role: "system", content: `${AI_GUARDRAILS}\n\n${AI_MODE_PROMPTS[parsed.mode]}` },
        ...parsed.messages,
      ],
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    logger.error({ err }, "Refunds AI chat stream failed");
    // Headers are already sent, so surface the error inside the SSE stream
    // rather than as an HTTP status the client will never see.
    res.write(
      `data: ${JSON.stringify({ error: "The assistant ran into a problem. Please try again." })}\n\n`,
    );
    res.end();
  }
});

router.post(
  "/ai/report/:reference",
  ...aiChain,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as AuthedAiRequest).refundsUser!;

      if (!isOpenAIConfigured()) {
        res
          .status(503)
          .json({ error: "The assistant is not configured yet. Please try again later." });
        return;
      }

      const referenceParam = Array.isArray(req.params.reference)
        ? req.params.reference[0]
        : req.params.reference;

      const result = await loadCaseReportForUser(user, referenceParam ?? "");
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      const { report } = result;
      const caseFacts = JSON.stringify(
        {
          reference: report.case.reference,
          incident: report.case.incident,
          asset: report.case.asset,
          chain: report.case.chain,
          amount: report.case.amount,
          currency: report.case.currency,
          status: report.case.status,
          submittedAt: report.case.submittedAt,
          transactionHashes: report.case.txHashes,
          activity: report.activity,
        },
        null,
        2,
      );

      const completion = await getOpenAIClient().chat.completions.create({
        model: OPENAI_MODEL,
        max_completion_tokens: OPENAI_MAX_COMPLETION_TOKENS,
        messages: [
          {
            role: "system",
            content: `${AI_GUARDRAILS}\n\nMode: CASE NARRATIVE. Write a clear, professional investigation narrative for the client's own case using ONLY the structured facts provided. Use these sections: Summary, Incident overview, Investigation activity to date, Current status, and Recommended next steps. Do not invent facts that are not present. Do not promise recovery.`,
          },
          {
            role: "user",
            content: `Write the investigation narrative for this case. Structured facts:\n\n${caseFacts}`,
          },
        ],
      });

      const narrative = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!narrative) {
        res.status(502).json({ error: "The assistant returned an empty narrative. Please try again." });
        return;
      }

      res.json({
        reference: report.case.reference,
        generatedAt: new Date().toISOString(),
        model: OPENAI_MODEL,
        narrative,
        disclaimer: report.firm.jurisdictionNote,
      });
    } catch (err) {
      logger.error({ err }, "Failed to build AI case narrative");
      res.status(500).json({ error: "Failed to generate the report narrative." });
    }
  },
);

export default router;
