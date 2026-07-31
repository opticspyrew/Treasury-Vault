// Core upsert/append logic for the Manus / Netspy-World data sync. Both inbound
// surfaces use these functions: the REST-style /sync/* endpoints (our contract,
// docs/manus-data-sync-requirements.md §9) and the Netspy webhook receiver
// (PDF §4). Keeping a single service layer guarantees both paths apply the same
// validation, joins, conflict resolution and audit-logging rules.
//
// Conflict resolution (§7): last-writer-wins by updatedAt, with Manus winning
// analyst-owned fields (status, notes) and Refunds.site winning client-owned
// intake fields (name, email, phone, company, amount, currency, txnId). Every
// applied change writes an admin_activity_log row with metadata.source = "manus"
// so the case timeline and AI narratives stay complete and auditable.

import { db, pool } from "@workspace/db";
import { adminClients, adminServiceRequests, adminActivityLog } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { isValidCaseStatus, type CaseStatus } from "./config";
import { caseReference, parseCaseReference } from "./case-reference";

// --- Result type ------------------------------------------------------------

export interface SyncOk<T> {
  ok: true;
  data: T;
}
export interface SyncFail {
  ok: false;
  status: 400 | 404 | 413 | 422;
  error: string;
}
export type SyncResult<T> = SyncOk<T> | SyncFail;

function ok<T>(data: T): SyncOk<T> {
  return { ok: true, data };
}
function fail(status: SyncFail["status"], error: string): SyncFail {
  return { ok: false, status, error };
}

// --- Input shapes -----------------------------------------------------------

export interface ClientSyncInput {
  manusClientId?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  company?: string | null;
  status?: string;
  notes?: string | null;
  updatedAt?: string;
}

export interface CaseSyncInput {
  manusCaseId?: string;
  reference?: string;
  client?: { email?: string; manusClientId?: string };
  type?: string;
  amount?: string | number | null;
  currency?: string;
  txnId?: string | null;
  notes?: string | null;
  status?: string;
  updatedAt?: string;
}

export interface ActivitySyncInput {
  manusEventId?: string;
  case?: { reference?: string; manusCaseId?: string };
  clientEmail?: string;
  eventType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

// --- Small coercion / validation helpers ------------------------------------

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  return t || null;
}

function trimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function parseTs(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// numeric(14,2): up to 12 integer digits and 2 decimals, non-negative. Accepts
// optional comma grouping. Returns the normalized string, or null when omitted.
function normalizeAmount(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string" && typeof raw !== "number") return { ok: false };
  const s = String(raw).replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { ok: false };
  const num = Number(s);
  if (!Number.isFinite(num) || num < 0) return { ok: false };
  const intPart = s.split(".")[0].replace(/^0+/, "");
  if (intPart.length > 12) return { ok: false };
  return { ok: true, value: s };
}

function isNewer(incoming: Date | null, existing: Date | null): boolean {
  if (!incoming) return true; // no timestamp supplied -> treat as authoritative
  if (!existing) return true;
  return incoming.getTime() > existing.getTime();
}

// --- Client upsert ----------------------------------------------------------

export async function upsertClient(
  input: ClientSyncInput,
): Promise<SyncResult<{ clientId: number; manusClientId: string | null; created: boolean }>> {
  const email = normalizeEmail(input.email);
  const manusClientId = trimmed(input.manusClientId);
  if (!email && !manusClientId) {
    return fail(400, "client requires email or manusClientId");
  }
  if (input.status !== undefined && !isValidCaseStatus(input.status)) {
    return fail(422, `unknown status: ${String(input.status)}`);
  }

  let existing: typeof adminClients.$inferSelect | undefined;
  if (manusClientId) {
    [existing] = await db
      .select()
      .from(adminClients)
      .where(eq(adminClients.manusClientId, manusClientId));
  }
  if (!existing && email) {
    [existing] = await db
      .select()
      .from(adminClients)
      .where(sql`lower(${adminClients.email}) = ${email}`);
  }

  const incomingTs = parseTs(input.updatedAt);

  if (!existing) {
    const name = trimmed(input.name);
    if (!name || !email) {
      return fail(404, "client not found and payload lacks name/email to create it");
    }
    const [created] = await db
      .insert(adminClients)
      .values({
        name,
        email,
        phone: input.phone ?? null,
        company: input.company ?? null,
        status: input.status ?? "pending",
        notes: input.notes ?? null,
        manusClientId,
        updatedAt: incomingTs ?? new Date(),
      })
      .returning();
    await db.insert(adminActivityLog).values({
      eventType: "client_synced",
      clientId: created.id,
      description: `Client synced from Manus: ${created.name}`,
      metadata: { source: "manus", manusClientId, created: true },
    });
    return ok({ clientId: created.id, manusClientId: created.manusClientId ?? null, created: true });
  }

  // Existing client: apply analyst-owned fields only; never overwrite the
  // client-owned intake fields (name/email/phone/company) — Refunds.site wins.
  const patch: Partial<typeof adminClients.$inferInsert> = {};
  if (manusClientId && !existing.manusClientId) patch.manusClientId = manusClientId;
  if (isNewer(incomingTs, existing.updatedAt as Date)) {
    if (input.status !== undefined) patch.status = input.status;
    if (input.notes !== undefined) patch.notes = input.notes;
  }
  if (Object.keys(patch).length > 0) {
    patch.updatedAt = incomingTs ?? new Date();
    await db.update(adminClients).set(patch).where(eq(adminClients.id, existing.id));
    await db.insert(adminActivityLog).values({
      eventType: "client_synced",
      clientId: existing.id,
      description: `Client updated from Manus: ${existing.name}`,
      metadata: {
        source: "manus",
        manusClientId: manusClientId ?? existing.manusClientId,
        created: false,
      },
    });
  }
  return ok({
    clientId: existing.id,
    manusClientId: patch.manusClientId ?? existing.manusClientId ?? null,
    created: false,
  });
}

// --- Case upsert ------------------------------------------------------------

export async function upsertCase(
  input: CaseSyncInput,
): Promise<SyncResult<{ caseId: number; reference: string; manusCaseId: string | null; created: boolean }>> {
  const manusCaseId = trimmed(input.manusCaseId);
  if (input.status !== undefined && !isValidCaseStatus(input.status)) {
    return fail(422, `unknown status: ${String(input.status)}`);
  }
  const amount = normalizeAmount(input.amount);
  if (!amount.ok) return fail(422, "invalid amount");

  // Resolve the owning client.
  const clientEmail = normalizeEmail(input.client?.email);
  const clientManusId = trimmed(input.client?.manusClientId);
  let client: typeof adminClients.$inferSelect | undefined;
  if (clientManusId) {
    [client] = await db
      .select()
      .from(adminClients)
      .where(eq(adminClients.manusClientId, clientManusId));
  }
  if (!client && clientEmail) {
    [client] = await db
      .select()
      .from(adminClients)
      .where(sql`lower(${adminClients.email}) = ${clientEmail}`);
  }

  // Locate an existing case by manusCaseId, else by exact reference.
  let existing: typeof adminServiceRequests.$inferSelect | undefined;
  if (manusCaseId) {
    [existing] = await db
      .select()
      .from(adminServiceRequests)
      .where(eq(adminServiceRequests.manusCaseId, manusCaseId));
  }
  if (!existing && input.reference) {
    const parsed = parseCaseReference(input.reference);
    if (parsed) {
      const [row] = await db
        .select()
        .from(adminServiceRequests)
        .where(eq(adminServiceRequests.id, parsed.id));
      if (row && caseReference(row.id, row.createdAt as Date) === input.reference.trim()) {
        existing = row;
      }
    }
  }

  const incomingTs = parseTs(input.updatedAt);

  if (!existing) {
    if (!client) {
      return fail(404, "case not found and client could not be resolved to create it");
    }
    const [created] = await db
      .insert(adminServiceRequests)
      .values({
        clientId: client.id,
        type: trimmed(input.type) ?? "recovery_case",
        amount: amount.value,
        currency: trimmed(input.currency) ?? "USD",
        txnId: input.txnId ?? null,
        notes: input.notes ?? null,
        status: input.status ?? "pending",
        manusCaseId,
        updatedAt: incomingTs ?? new Date(),
      })
      .returning();
    const reference = caseReference(created.id, created.createdAt as Date);
    await db.insert(adminActivityLog).values({
      eventType: "case_synced",
      clientId: client.id,
      serviceRequestId: created.id,
      description: `Case synced from Manus (${reference})`,
      metadata: {
        source: "manus",
        manusCaseId,
        reference,
        created: true,
        status: created.status,
      },
    });
    return ok({ caseId: created.id, reference, manusCaseId: created.manusCaseId ?? null, created: true });
  }

  // Existing case: status/notes are analyst-owned (Manus wins, last-writer);
  // amount/currency/txnId are client-owned and are never overwritten here.
  const reference = caseReference(existing.id, existing.createdAt as Date);
  const patch: Partial<typeof adminServiceRequests.$inferInsert> = {};
  if (manusCaseId && !existing.manusCaseId) patch.manusCaseId = manusCaseId;
  let statusChanged = false;
  if (isNewer(incomingTs, existing.updatedAt as Date)) {
    if (input.status !== undefined && input.status !== existing.status) {
      patch.status = input.status;
      statusChanged = true;
    }
    if (input.notes !== undefined) patch.notes = input.notes;
  }
  if (Object.keys(patch).length > 0) {
    patch.updatedAt = incomingTs ?? new Date();
    await db.update(adminServiceRequests).set(patch).where(eq(adminServiceRequests.id, existing.id));
    await db.insert(adminActivityLog).values({
      eventType: statusChanged ? "status_changed" : "case_synced",
      clientId: existing.clientId,
      serviceRequestId: existing.id,
      description: statusChanged
        ? `Case ${reference} status changed to ${input.status} (synced from Manus)`
        : `Case ${reference} updated from Manus`,
      metadata: {
        source: "manus",
        manusCaseId: manusCaseId ?? existing.manusCaseId,
        reference,
        created: false,
        ...(statusChanged ? { from: existing.status, to: input.status } : {}),
      },
    });
  }
  return ok({
    caseId: existing.id,
    reference,
    manusCaseId: patch.manusCaseId ?? existing.manusCaseId ?? null,
    created: false,
  });
}

// --- Activity append --------------------------------------------------------

export async function appendActivity(
  inputs: ActivitySyncInput[],
): Promise<SyncResult<{ inserted: number; skippedDuplicates: number }>> {
  // Validate the whole batch first so a bad element never leaves partial writes.
  for (const ev of inputs) {
    if (!trimmed(ev.eventType)) return fail(422, "activity event requires eventType");
    if (!trimmed(ev.description)) return fail(422, "activity event requires description");
  }

  let inserted = 0;
  let skippedDuplicates = 0;

  for (const ev of inputs) {
    let serviceRequestId: number | null = null;
    let clientId: number | null = null;

    const manusCaseId = trimmed(ev.case?.manusCaseId);
    if (manusCaseId) {
      const [row] = await db
        .select()
        .from(adminServiceRequests)
        .where(eq(adminServiceRequests.manusCaseId, manusCaseId));
      if (row) {
        serviceRequestId = row.id;
        clientId = row.clientId;
      }
    }
    if (!serviceRequestId && ev.case?.reference) {
      const parsed = parseCaseReference(ev.case.reference);
      if (parsed) {
        const [row] = await db
          .select()
          .from(adminServiceRequests)
          .where(eq(adminServiceRequests.id, parsed.id));
        if (row && caseReference(row.id, row.createdAt as Date) === ev.case.reference.trim()) {
          serviceRequestId = row.id;
          clientId = row.clientId;
        }
      }
    }
    if (!clientId) {
      const email = normalizeEmail(ev.clientEmail);
      if (email) {
        const [row] = await db
          .select()
          .from(adminClients)
          .where(sql`lower(${adminClients.email}) = ${email}`);
        if (row) clientId = row.id;
      }
    }

    // De-dupe on metadata.manusEventId (§4 rule 4): an event already recorded
    // is skipped, so webhook/batch retries never double-insert.
    const manusEventId = trimmed(ev.manusEventId);
    if (manusEventId) {
      const { rows } = await pool.query(
        `SELECT 1 FROM admin_activity_log WHERE metadata->>'manusEventId' = $1 LIMIT 1`,
        [manusEventId],
      );
      if (rows.length > 0) {
        skippedDuplicates++;
        continue;
      }
    }

    const createdAt = parseTs(ev.createdAt);
    await db.insert(adminActivityLog).values({
      eventType: ev.eventType as string,
      clientId,
      serviceRequestId,
      description: ev.description as string,
      metadata: {
        ...(ev.metadata ?? {}),
        source: "manus",
        ...(manusEventId ? { manusEventId } : {}),
        ...(manusCaseId ? { manusCaseId } : {}),
        ...(ev.case?.reference ? { reference: ev.case.reference } : {}),
      },
      ...(createdAt ? { createdAt } : {}),
    });
    inserted++;
  }

  return ok({ inserted, skippedDuplicates });
}

// --- Webhook event mapping (PDF §4) -----------------------------------------

export interface WebhookEnvelope {
  id?: string;
  timestamp?: string;
  event?: string;
  /** Alias used by the actual Netspy staging sender instead of `event`. */
  type?: string;
  source?: string;
  data?: Record<string, unknown>;
  deliveryId?: string;
}

// The Netspy staging sender uses snake_case event names in a `type` body field
// (e.g. "case_created") instead of the PDF §4 dotted names in `event`
// (e.g. "case.created"). Normalize known aliases onto the canonical names;
// unknown names pass through untouched (the switch's default case records them).
const WEBHOOK_EVENT_ALIASES: Record<string, string> = {
  case_created: "case.created",
  case_updated: "case.statusUpdated",
  case_status_updated: "case.statusUpdated",
  blockchain_trace_completed: "blockchain.traceCompleted",
  vault_created: "vault.created",
  vault_compliance_verified: "vault.complianceVerified",
  vault_funded: "vault.funded",
  vault_withdrawal_completed: "vault.withdrawalCompleted",
};

export function normalizeWebhookEventName(name: string | null): string | null {
  if (!name) return name;
  return WEBHOOK_EVENT_ALIASES[name.toLowerCase()] ?? name;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function asIdString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

// Conservative, explicit Manus->our status mapping. The full vocabulary mapping
// is an open question (§11.3); unmapped combinations are RECORDED as activity
// only and never coerce our canonical status (§7: never silently coerce).
function mapManusStatus(
  investigationStatus: unknown,
  recoveryStatus: unknown,
): CaseStatus | null {
  if (recoveryStatus === "completed") return "approved";
  if (recoveryStatus === "rejected") return "rejected";
  if (investigationStatus === "active") return "processing";
  return null;
}

function summarizeWebhookData(event: string, data: Record<string, unknown>): Record<string, unknown> {
  const summary = asRecord(data.summary);
  const vault = asRecord(data.vault);
  const compliance = asRecord(data.complianceResult);
  const withdrawal = asRecord(data.withdrawal);
  switch (event) {
    case "blockchain.traceCompleted":
      return {
        traceId: data.traceId,
        overallRiskScore: summary.overallRiskScore,
        recoveryPotential: summary.recoveryPotential,
        totalTransactions: summary.totalTransactions,
      };
    case "vault.created":
      return { vaultId: vault.id, chain: vault.chain, status: vault.status };
    case "vault.complianceVerified":
      return { vaultId: data.vaultId, status: compliance.status };
    case "vault.funded":
      return { vaultId: data.vaultId, amount: data.amount };
    case "vault.withdrawalCompleted":
      return { vaultId: data.vaultId, status: withdrawal.status, amount: withdrawal.amount };
    default:
      return {};
  }
}

function webhookDescription(event: string, data: Record<string, unknown>): string {
  const summary = asRecord(data.summary);
  switch (event) {
    case "blockchain.traceCompleted":
      return `Blockchain trace completed (risk ${summary.overallRiskScore ?? "?"})`;
    case "vault.created":
      return "Recovery vault created";
    case "vault.complianceVerified":
      return "Recovery vault compliance verified";
    case "vault.funded":
      return "Recovery vault funded";
    case "vault.withdrawalCompleted":
      return "Recovery vault withdrawal completed";
    default:
      return `Netspy event: ${event}`;
  }
}

/**
 * Map a verified Netspy webhook envelope onto the shared sync service. Returns
 * a SyncResult; the route translates failures to HTTP codes. Blockchain/vault
 * events are recorded as activity (not acted on) — we deliberately do not model
 * vault tables here (deferred). case.statusUpdated only changes our status when
 * the mapping is unambiguous, otherwise it records the raw Manus statuses.
 */
export async function processWebhookEvent(
  env: WebhookEnvelope,
): Promise<SyncResult<{ processed: true; action: string; refundsCaseId?: string }>> {
  const event = normalizeWebhookEventName(trimmed(env.event) ?? trimmed(env.type));
  if (!event) return fail(400, "missing event type");
  const data = asRecord(env.data);
  const manusEventId = trimmed(env.id) ?? trimmed(env.deliveryId) ?? undefined;
  const manusCaseId = asIdString(data.unifiedCaseId);

  switch (event) {
    case "case.created": {
      const email = normalizeEmail(data.clientEmail) ?? undefined;
      const name = asString(data.clientName)?.trim();
      if (email && name) {
        const c = await upsertClient({ email, name });
        if (!c.ok) return c;
      }
      const caseRes = await upsertCase({
        manusCaseId,
        client: { email },
        type: "recovery_case",
        amount: typeof data.estimatedLoss === "number" ? data.estimatedLoss : asString(data.estimatedLoss),
        notes: asString(data.caseDescription) ?? null,
        status: "pending",
      });
      if (!caseRes.ok) return caseRes;
      await appendActivity([
        {
          manusEventId,
          case: { manusCaseId },
          clientEmail: email,
          eventType: "case_created",
          description: `Case created in Netspy${name ? ` for ${name}` : ""}`,
          metadata: {
            event,
            caseType: data.caseType,
            netspyCaseId: data.netspyCaseId ?? data.netsyyCaseId,
          },
        },
      ]);
      return ok({ processed: true, action: event, refundsCaseId: caseRes.data.reference });
    }

    case "case.statusUpdated": {
      const mapped = mapManusStatus(data.investigationStatus, data.recoveryStatus);
      if (mapped && manusCaseId) {
        // Best-effort: if the case is unknown locally this returns 404, which we
        // tolerate (the activity row below still records the update).
        await upsertCase({ manusCaseId, status: mapped, updatedAt: asString(data.updatedAt) });
      }
      await appendActivity([
        {
          manusEventId,
          case: { manusCaseId },
          eventType: "status_changed",
          description: `Netspy status update (investigation: ${asString(data.investigationStatus) ?? "?"}, recovery: ${asString(data.recoveryStatus) ?? "?"})`,
          metadata: {
            event,
            investigationStatus: data.investigationStatus,
            recoveryStatus: data.recoveryStatus,
            updatedBy: data.updatedBy,
            mappedStatus: mapped ?? null,
          },
        },
      ]);
      return ok({ processed: true, action: event });
    }

    case "blockchain.traceCompleted":
    case "vault.created":
    case "vault.complianceVerified":
    case "vault.funded":
    case "vault.withdrawalCompleted": {
      await appendActivity([
        {
          manusEventId,
          case: { manusCaseId },
          eventType: event.replace(/\./g, "_"),
          description: webhookDescription(event, data),
          metadata: { event, summary: summarizeWebhookData(event, data) },
        },
      ]);
      return ok({ processed: true, action: event });
    }

    default: {
      // Unknown event: record minimally so nothing is lost and ack to stop
      // Netspy's retry schedule (a 2xx with processed:false would be retried).
      await appendActivity([
        {
          manusEventId,
          case: { manusCaseId },
          eventType: "manus_event",
          description: `Unhandled Netspy event: ${event}`,
          metadata: { event },
        },
      ]);
      return ok({ processed: true, action: "unhandled" });
    }
  }
}
