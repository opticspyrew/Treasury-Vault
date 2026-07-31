// Outbound sync hooks — the glue between our own write paths (case intake, admin
// status change) and the Netspy-World API client.
//
// Design contract:
//   * Fully inert when outbound is disabled or misconfigured. We do NOT touch the
//     database or the network, so a default (disabled) deployment has zero side
//     effects and existing intake/admin behavior is unchanged.
//   * Never block or fail the request that triggered the sync. These are
//     fire-and-forget: the caller uses `void enqueue...` and we swallow all
//     errors internally.
//   * When enabled but a push cannot complete (missing link, API failure), we
//     leave a durable `manus_sync_pending` activity row so a future backfill can
//     find and retry the case. Successful pushes leave a `manus_synced` row.

import { db } from "@workspace/db";
import { adminServiceRequests, adminActivityLog } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { outboundReadiness } from "./config";
import { createUnifiedCase, syncCaseStatus } from "./client";

export interface OutboundCaseCreate {
  caseId: number;
  reference: string;
  clientEmail: string;
  clientName: string;
  amount: string | null;
  description?: string;
  chains?: string[];
  transactionHashes?: string[];
}

export interface OutboundStatusSync {
  caseId: number;
  reference: string;
  status: string;
  manusCaseId: string | null;
}

// Best-effort reverse status mapping (requirements §11.3 open question). Netspy
// models two axes (investigation + recovery); our single status maps to the most
// conservative pair. Confirm the exact vocabulary with Netspy before relying on
// these for anything beyond a status hint.
function mapToNetspyStatus(status: string): {
  investigationStatus: string;
  recoveryStatus: string;
} {
  switch (status) {
    case "approved":
      return { investigationStatus: "completed", recoveryStatus: "completed" };
    case "rejected":
      return { investigationStatus: "completed", recoveryStatus: "rejected" };
    case "processing":
      return { investigationStatus: "active", recoveryStatus: "active" };
    default:
      return { investigationStatus: "pending", recoveryStatus: "pending" };
  }
}

async function recordPending(caseId: number, reference: string, reason: string): Promise<void> {
  logger.warn({ caseId, reason }, "Netspy outbound sync pending");
  try {
    await db.insert(adminActivityLog).values({
      eventType: "manus_sync_pending",
      serviceRequestId: caseId,
      description: `Outbound sync to Netspy pending for ${reference}`,
      metadata: { source: "manus", direction: "outbound", reason },
    });
  } catch (err) {
    logger.error({ err, caseId }, "Failed to record manus_sync_pending marker");
  }
}

async function recordSynced(
  caseId: number,
  description: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(adminActivityLog).values({
      eventType: "manus_synced",
      serviceRequestId: caseId,
      description,
      metadata: { source: "manus", direction: "outbound", ...metadata },
    });
  } catch (err) {
    logger.error({ err, caseId }, "Failed to record manus_synced marker");
  }
}

async function runCaseCreate(input: OutboundCaseCreate): Promise<void> {
  const blockchainData =
    input.chains?.length || input.transactionHashes?.length
      ? {
          ...(input.chains?.length ? { chains: input.chains } : {}),
          ...(input.transactionHashes?.length
            ? { transactionHashes: input.transactionHashes }
            : {}),
        }
      : undefined;

  const res = await createUnifiedCase({
    clientEmail: input.clientEmail,
    clientName: input.clientName,
    caseType: "both",
    estimatedLoss: input.amount != null ? String(input.amount) : undefined,
    caseDescription: input.description,
    ...(blockchainData ? { blockchainData } : {}),
  });

  const unifiedCaseId = res.ok && res.data ? res.data.unifiedCaseId : undefined;
  if (res.ok && unifiedCaseId != null) {
    const linkId = String(unifiedCaseId);
    try {
      await db
        .update(adminServiceRequests)
        .set({ manusCaseId: linkId, updatedAt: new Date() })
        .where(eq(adminServiceRequests.id, input.caseId));
    } catch (err) {
      // The case exists at Netspy but we could not persist the link locally.
      // Record pending (not synced) so a backfill re-links it, rather than
      // leaving a false success marker with no durable manusCaseId.
      logger.error({ err, caseId: input.caseId }, "Failed to store manusCaseId link");
      await recordPending(
        input.caseId,
        input.reference,
        `created at Netspy (unifiedCaseId ${linkId}) but failed to persist link`,
      );
      return;
    }
    await recordSynced(
      input.caseId,
      `Case ${input.reference} pushed to Netspy (unifiedCaseId ${linkId})`,
      { manusCaseId: linkId, action: "case.created" },
    );
    return;
  }
  await recordPending(input.caseId, input.reference, `createUnified failed: ${res.error ?? res.status}`);
}

async function runStatusSync(input: OutboundStatusSync): Promise<void> {
  const unifiedCaseId = Number(input.manusCaseId);
  if (!Number.isFinite(unifiedCaseId)) {
    await recordPending(input.caseId, input.reference, "manusCaseId is not numeric");
    return;
  }
  const res = await syncCaseStatus({ unifiedCaseId, ...mapToNetspyStatus(input.status) });
  if (res.ok) {
    await recordSynced(input.caseId, `Status "${input.status}" pushed to Netspy for ${input.reference}`, {
      manusCaseId: input.manusCaseId,
      status: input.status,
      action: "case.statusUpdated",
    });
    return;
  }
  await recordPending(input.caseId, input.reference, `syncStatus failed: ${res.error ?? res.status}`);
}

// Push a newly created case to Netspy. Fire-and-forget; inert when disabled.
export function enqueueOutboundCaseCreate(input: OutboundCaseCreate): void {
  if (!outboundReadiness().ready) return;
  void runCaseCreate(input).catch((err) =>
    logger.error({ err, caseId: input.caseId }, "Outbound case create crashed"),
  );
}

// Push a status change to Netspy. Fire-and-forget; inert when disabled. A case
// with no Netspy link yet records a pending marker instead of calling the API.
export function enqueueOutboundStatusSync(input: OutboundStatusSync): void {
  if (!outboundReadiness().ready) return;
  if (!input.manusCaseId) {
    void recordPending(input.caseId, input.reference, "no manusCaseId linked").catch((err) =>
      logger.error({ err, caseId: input.caseId }, "Outbound status sync marker crashed"),
    );
    return;
  }
  void runStatusSync(input).catch((err) =>
    logger.error({ err, caseId: input.caseId }, "Outbound status sync crashed"),
  );
}
