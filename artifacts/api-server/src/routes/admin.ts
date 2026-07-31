import { Router, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { db } from "@workspace/db";
import { adminClients, adminServiceRequests, adminActivityLog, users, cryptoWalletConfigs, coinSectionOrders, kycSubmissions } from "@workspace/db";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { sendAdminEmail, sendUserEmail, newClientEmail, newServiceRequestEmail, kycApprovedEmail, kycRejectedEmail, paymentConfirmationDecisionEmail, recoveryCreditedEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { createAdminSession, validateAdminSession, deleteAdminSession } from "../lib/admin-sessions";
import { clearLoginFailures, getAccountThrottleStatus } from "../lib/login-throttle";
import { resolveNotificationPreferences } from "../lib/notification-preferences";
import { enqueueOutboundStatusSync } from "../lib/manus/outbound-hooks";
import { caseReference } from "../lib/manus/case-reference";

const router = Router();

const SUPPORTED_COIN_SYMBOLS = new Set(["BTC", "USDT", "USDC", "ETH", "SOL", "XRP", "BNB"]);

function getAdminCredentials(): { user: string; pass: string } {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) {
    logger.error("ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required but not set");
    throw new Error("Admin credentials not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD env vars.");
  }
  return { user, pass };
}

// Constant-time comparison of the (username, password) pair against the
// configured admin credentials. We concatenate with a NUL separator and pad
// any length mismatch to the expected length before comparing, so neither
// the response timing nor the early-exit branch can reveal which field was
// wrong or how long the submitted values were.
function safeCredentialsMatch(
  submittedUser: string,
  submittedPass: string,
  expectedUser: string,
  expectedPass: string,
): boolean {
  const expected = Buffer.from(`${expectedUser}\u0000${expectedPass}`, "utf8");
  const submitted = Buffer.from(`${submittedUser}\u0000${submittedPass}`, "utf8");
  // Always run timingSafeEqual against an equal-length buffer so the timing
  // path is identical regardless of the submitted length. If lengths differ,
  // pad/truncate the submitted buffer to the expected length and force the
  // comparison to fail by short-circuiting after the constant-time call.
  const sameLength = submitted.length === expected.length;
  const compareBuf = sameLength
    ? submitted
    : Buffer.concat([submitted, Buffer.alloc(expected.length)], expected.length);
  const equal = timingSafeEqual(compareBuf, expected);
  return sameLength && equal;
}

import { ObjectStorageService } from "../lib/objectStorage";
import { SUPPORT_EMAIL } from "../lib/support-email";

// Support address shown in KYC and payment-confirmation decision emails.
// Resolved from the shared support-email helper so every notification type
// uses one consistent contact address.
const KYC_SUPPORT_EMAIL = SUPPORT_EMAIL;
const PAYMENT_SUPPORT_EMAIL = SUPPORT_EMAIL;

// Build a link back to the user-facing dashboard for KYC decision emails.
// The KYC modal is opened from the main dashboard, so the same URL works for
// "open dashboard" (approved) and "resubmit verification" (rejected).
function buildAdminAppUrl(req?: Request): string | null {
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (req) {
    const fwdHost = req.headers["x-forwarded-host"];
    const fwdProto = req.headers["x-forwarded-proto"];
    const host = (Array.isArray(fwdHost) ? fwdHost[0] : fwdHost)?.split(",")[0].trim();
    const proto = (Array.isArray(fwdProto) ? fwdProto[0] : fwdProto)?.split(",")[0].trim() || "https";
    if (host) return `${proto}://${host}`;
  }
  const replitApp = process.env.REPLIT_APP_DOMAIN?.trim();
  if (replitApp) return `https://${replitApp.replace(/\/$/, "")}`;
  const replitDev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDev) return `https://${replitDev.replace(/\/$/, "")}`;
  return null;
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers["x-admin-token"];
  const token = typeof auth === "string" ? auth : "";
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const valid = await validateAdminSession(token);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  } catch (err) {
    logger.error({ err }, "Failed to validate admin session");
    res.status(500).json({ error: "Failed to validate session" });
  }
}

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  let creds: { user: string; pass: string };
  try {
    creds = getAdminCredentials();
  } catch {
    res.status(503).json({ error: "Admin authentication not configured on server" });
    return;
  }
  const { username, password } = req.body as { username?: string; password?: string };
  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  if (!safeCredentialsMatch(username, password, creds.user, creds.pass)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  try {
    const ua = req.headers["user-agent"];
    const { token, expiresAt } = await createAdminSession({
      ipAddress: req.ip ?? null,
      userAgent: typeof ua === "string" ? ua.slice(0, 512) : null,
    });
    res.json({ success: true, token, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "Failed to create admin session");
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  const auth = req.headers["x-admin-token"];
  const token = typeof auth === "string" ? auth : "";
  try {
    if (token) await deleteAdminSession(token);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete admin session");
    res.status(500).json({ error: "Failed to log out" });
  }
});

router.get("/stats", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [totalClients] = await db.select({ count: sql<number>`count(*)::int` }).from(adminClients);
    const [pendingClients] = await db.select({ count: sql<number>`count(*)::int` }).from(adminClients).where(eq(adminClients.status, "pending"));
    const [totalRequests] = await db.select({ count: sql<number>`count(*)::int` }).from(adminServiceRequests);
    const [pendingRequests] = await db.select({ count: sql<number>`count(*)::int` }).from(adminServiceRequests).where(eq(adminServiceRequests.status, "pending"));
    const recentActivity = await db.select().from(adminActivityLog).orderBy(desc(adminActivityLog.createdAt)).limit(10);
    res.json({
      totalClients: totalClients.count,
      pendingClients: pendingClients.count,
      totalRequests: totalRequests.count,
      pendingRequests: pendingRequests.count,
      recentActivity,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Failed to load stats");
    res.status(500).json({ error: "Failed to load stats", detail: msg });
  }
});

router.get("/clients", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const clients = await db.select().from(adminClients).orderBy(desc(adminClients.createdAt));
    res.json({ clients });
  } catch (err) {
    logger.error({ err }, "Failed to load clients");
    res.status(500).json({ error: "Failed to load clients" });
  }
});

router.post("/clients", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, company, notes } = req.body as {
      name?: string; email?: string; phone?: string; company?: string; notes?: string;
    };
    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }

    const [existing] = await db.select().from(adminClients).where(eq(adminClients.email, email.toLowerCase().trim()));
    if (existing) {
      res.status(409).json({ error: "A client with this email already exists" });
      return;
    }

    const [client] = await db.insert(adminClients).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() ?? null,
      company: company?.trim() ?? null,
      notes: notes?.trim() ?? null,
      status: "pending",
    }).returning();

    await db.insert(adminActivityLog).values({
      eventType: "client_registered",
      clientId: client.id,
      description: `New client registered: ${client.name} (${client.email})`,
      metadata: { name: client.name, email: client.email },
    });

    const { subject, html } = newClientEmail({ ...client, createdAt: client.createdAt as Date });
    const emailSent = await sendAdminEmail(subject, html);

    res.status(201).json({ client, emailSent });
  } catch (err) {
    logger.error({ err }, "Failed to register client");
    res.status(500).json({ error: "Failed to register client" });
  }
});

router.patch("/clients/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(String(req.params.id));
    const { status, notes } = req.body as { status?: string; notes?: string };
    const [client] = await db.update(adminClients)
      .set({ status, notes, updatedAt: new Date() })
      .where(eq(adminClients.id, id))
      .returning();
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    await db.insert(adminActivityLog).values({
      eventType: "client_status_changed",
      clientId: client.id,
      description: `Client ${client.name} status changed to: ${status}`,
      metadata: { status },
    });

    res.json({ client });
  } catch (err) {
    logger.error({ err }, "Failed to update client");
    res.status(500).json({ error: "Failed to update client" });
  }
});

router.get("/requests", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await db
      .select({
        id: adminServiceRequests.id,
        clientId: adminServiceRequests.clientId,
        type: adminServiceRequests.type,
        amount: adminServiceRequests.amount,
        currency: adminServiceRequests.currency,
        notes: adminServiceRequests.notes,
        status: adminServiceRequests.status,
        createdAt: adminServiceRequests.createdAt,
        updatedAt: adminServiceRequests.updatedAt,
        clientName: adminClients.name,
        clientEmail: adminClients.email,
      })
      .from(adminServiceRequests)
      .leftJoin(adminClients, eq(adminServiceRequests.clientId, adminClients.id))
      .orderBy(desc(adminServiceRequests.createdAt));
    res.json({ requests });
  } catch (err) {
    logger.error({ err }, "Failed to load requests");
    res.status(500).json({ error: "Failed to load requests" });
  }
});

router.post("/requests", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, type, amount, currency, notes } = req.body as {
      clientId?: number | string; type?: string; amount?: string; currency?: string; notes?: string;
    };
    if (!clientId) {
      res.status(400).json({ error: "clientId is required" });
      return;
    }

    const [client] = await db.select().from(adminClients).where(eq(adminClients.id, parseInt(String(clientId), 10)));
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const [request] = await db.insert(adminServiceRequests).values({
      clientId: parseInt(String(clientId), 10),
      type: type ?? "withdrawal",
      amount: amount ? String(amount) : null,
      currency: currency ?? "USD",
      notes: notes?.trim() ?? null,
      status: "pending",
    }).returning();

    await db.insert(adminActivityLog).values({
      eventType: "service_request_submitted",
      clientId: client.id,
      serviceRequestId: request.id,
      description: `${type ?? "withdrawal"} request submitted by ${client.name}: ${currency ?? "USD"} ${amount ?? "N/A"}`,
      metadata: { type, amount, currency },
    });

    const { subject, html } = newServiceRequestEmail({
      client: { name: client.name, email: client.email },
      request: { ...request, createdAt: request.createdAt as Date },
    });
    const emailSent = await sendAdminEmail(subject, html);

    res.status(201).json({ request, emailSent });
  } catch (err) {
    logger.error({ err }, "Failed to submit request");
    res.status(500).json({ error: "Failed to submit request" });
  }
});

router.patch("/requests/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(String(req.params.id));
    const { status } = req.body as { status?: string };
    const [request] = await db.update(adminServiceRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(adminServiceRequests.id, id))
      .returning();
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const [client] = await db.select().from(adminClients).where(eq(adminClients.id, request.clientId));

    await db.insert(adminActivityLog).values({
      eventType: "request_status_changed",
      clientId: request.clientId,
      serviceRequestId: request.id,
      description: `${request.type} request from ${client?.name ?? "unknown"} ${status}`,
      metadata: { status, requestId: id },
    });

    // Best-effort push of the status change to Netspy for recovery cases. Inert
    // unless outbound sync is enabled and configured; never blocks the response.
    if (status && request.type === "recovery_case") {
      enqueueOutboundStatusSync({
        caseId: request.id,
        reference: caseReference(request.id, request.createdAt as Date),
        status,
        manusCaseId: request.manusCaseId ?? null,
      });
    }

    // Notify the customer by email when a payment confirmation request is
    // decided so they don't have to keep the invoice page open. Email failures
    // are logged but never block the admin action.
    if (
      request.type === "payment_confirmation" &&
      (status === "approved" || status === "rejected") &&
      client?.email
    ) {
      try {
        const appUrl = buildAdminAppUrl(req);
        const invoiceUrl = appUrl ? `${appUrl}/invoice` : null;
        const { subject, html } = paymentConfirmationDecisionEmail({
          name: client.name,
          email: client.email,
          decision: status,
          decidedAt: new Date(),
          amount: request.amount,
          currency: request.currency,
          invoiceUrl,
          supportEmail: PAYMENT_SUPPORT_EMAIL,
        });
        const sent = await sendUserEmail(client.email, subject, html);
        logger.info(
          { clientId: client.id, requestId: id, status, sent },
          sent
            ? "Payment confirmation decision email sent"
            : "Payment confirmation decision email could not be sent",
        );
      } catch (err) {
        logger.error(
          { err, clientId: client.id, requestId: id, status },
          "Failed to send payment confirmation decision email",
        );
      }
    }

    res.json({ request });
  } catch (err) {
    logger.error({ err }, "Failed to update request");
    res.status(500).json({ error: "Failed to update request" });
  }
});

router.get("/users", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Project only non-secret columns. Password verifier material
    // (passwordHash, passwordSalt, passwordIterations) must never leave
    // the server, even to authenticated admins.
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        balanceBtc: users.balanceBtc,
        reportedLossUsd: users.reportedLossUsd,
        recoveredUsd: users.recoveredUsd,
        scammedVia: users.scammedVia,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Augment each user with their current sign-in throttle status so the
    // Users page can show "Locked — Xm left" without a second round-trip.
    // Throttle keys are normalized (trim + lowercase) to match the bucket
    // written by the login route.
    const now = Date.now();
    const withLockout = await Promise.all(
      allUsers.map(async (u) => {
        const key = u.email.trim().toLowerCase();
        const status = await getAccountThrottleStatus(key, now);
        return {
          ...u,
          loginThrottle: {
            failureCount: status.failureCount,
            locked: status.locked,
            retryAfterMs: status.retryAfterMs,
            maxFailures: status.maxFailures,
          },
        };
      }),
    );

    // Surface locked accounts at the top of the list so support can
    // triage them at a glance. Within each group (locked / not locked)
    // the original "newest registration first" order is preserved.
    const sorted = [...withLockout].sort((a, b) => {
      const aLocked = a.loginThrottle.locked ? 1 : 0;
      const bLocked = b.loginThrottle.locked ? 1 : 0;
      if (aLocked !== bLocked) return bLocked - aLocked;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const lockedCount = sorted.reduce(
      (n, u) => n + (u.loginThrottle.locked ? 1 : 0),
      0,
    );

    res.json({ users: sorted, lockedCount });
  } catch (err) {
    logger.error({ err }, "Failed to load users");
    res.status(500).json({ error: "Failed to load users" });
  }
});

// Display price used by the dashboard. Mirrors BTC_PRICE_USD in
// crypto-dashboard/src/hooks/use-balance.ts and the seed price in
// auth.ts signup so admin USD edits round-trip back to the same USD figure.
const ADMIN_BTC_PRICE_USD = 27000;
const ADMIN_MAX_BALANCE_USD = 1_000_000_000; // 1B USD safety cap

router.patch("/users/:id/balance", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number.parseInt(String(rawId ?? ""), 10);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const body = (req.body ?? {}) as { amountUsd?: unknown; balanceBtc?: unknown };
    let nextBalanceBtc: number | null = null;

    if (body.balanceBtc !== undefined) {
      const btc = typeof body.balanceBtc === "number" ? body.balanceBtc : Number(body.balanceBtc);
      if (!Number.isFinite(btc) || btc < 0) {
        res.status(400).json({ error: "balanceBtc must be a finite, non-negative number" });
        return;
      }
      nextBalanceBtc = btc;
    } else if (body.amountUsd !== undefined) {
      const usd = typeof body.amountUsd === "number" ? body.amountUsd : Number(body.amountUsd);
      if (!Number.isFinite(usd) || usd < 0) {
        res.status(400).json({ error: "amountUsd must be a finite, non-negative number" });
        return;
      }
      if (usd > ADMIN_MAX_BALANCE_USD) {
        res.status(400).json({ error: `amountUsd exceeds the $${ADMIN_MAX_BALANCE_USD.toLocaleString("en-US")} cap` });
        return;
      }
      nextBalanceBtc = usd / ADMIN_BTC_PRICE_USD;
    } else {
      res.status(400).json({ error: "Provide either amountUsd or balanceBtc" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ balanceBtc: nextBalanceBtc, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        balanceBtc: users.balanceBtc,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db.insert(adminActivityLog).values({
      eventType: "user_balance_updated",
      description: `Admin set balance for ${updated.name} (${updated.email}) to ${updated.balanceBtc.toFixed(8)} BTC (~$${(updated.balanceBtc * ADMIN_BTC_PRICE_USD).toFixed(2)})`,
      metadata: { userId: id, balanceBtc: updated.balanceBtc, btcPriceUsd: ADMIN_BTC_PRICE_USD },
    });

    res.json({ user: updated });
  } catch (err) {
    logger.error({ err }, "Failed to update user balance");
    res.status(500).json({ error: "Failed to update user balance" });
  }
});

// Record a recovery credited to the vault for a user. Increments the user's
// cumulative recovered total; the Recovery Portal derives the at-risk balance
// as reportedLoss - recovered, so crediting here automatically moves funds
// from "at risk" to "recovered" on the user's dashboard.
router.post("/users/:id/record-recovery", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number.parseInt(String(rawId ?? ""), 10);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const body = (req.body ?? {}) as { amountUsd?: unknown };
    const amount = typeof body.amountUsd === "number" ? body.amountUsd : Number(body.amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "amountUsd must be a positive number" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.reportedLossUsd === null) {
      res.status(400).json({ error: "This user has no documented reported loss yet." });
      return;
    }
    const remaining = Math.max(0, user.reportedLossUsd - user.recoveredUsd);
    if (amount > remaining) {
      res.status(400).json({
        error: `Amount exceeds the remaining at-risk balance ($${remaining.toLocaleString("en-US")}).`,
      });
      return;
    }

    // Atomic conditional increment: the WHERE clause re-checks the cap inside
    // the UPDATE itself so concurrent recovery requests cannot both pass the
    // pre-check above and push recovered above the reported loss.
    const [updated] = await db
      .update(users)
      .set({ recoveredUsd: sql`${users.recoveredUsd} + ${amount}`, updatedAt: new Date() })
      .where(sql`${users.id} = ${id} AND ${users.reportedLossUsd} IS NOT NULL AND ${users.recoveredUsd} + ${amount} <= ${users.reportedLossUsd}`)
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        reportedLossUsd: users.reportedLossUsd,
        recoveredUsd: users.recoveredUsd,
      });

    if (!updated) {
      // Lost a race with a concurrent recovery credit — re-checked cap failed.
      res.status(409).json({ error: "Amount exceeds the remaining at-risk balance. Please reload and try again." });
      return;
    }

    await db.insert(adminActivityLog).values({
      eventType: "user_recovery_recorded",
      description: `Admin recorded $${amount.toLocaleString("en-US")} recovered to vault for ${updated.name} (${updated.email}); total recovered $${updated.recoveredUsd.toLocaleString("en-US")} of $${(updated.reportedLossUsd ?? 0).toLocaleString("en-US")} reported`,
      metadata: { userId: id, amountUsd: amount, recoveredUsd: updated.recoveredUsd, reportedLossUsd: updated.reportedLossUsd },
    });

    // Proactive good-news email: tell the client the moment a recovery is
    // credited so they don't have to log in to find out. Failures are logged
    // but never block the admin action (matches existing notification
    // patterns), and the user's notification preferences are respected.
    if (
      updated.email &&
      resolveNotificationPreferences(user.notificationPreferences).recoveryCredits
    ) {
      try {
        const appUrl = buildAdminAppUrl(req);
        const { subject, html } = recoveryCreditedEmail({
          name: updated.name,
          email: updated.email,
          amountUsd: amount,
          totalRecoveredUsd: updated.recoveredUsd,
          reportedLossUsd: updated.reportedLossUsd ?? 0,
          creditedAt: new Date(),
          portalUrl: appUrl ? `${appUrl}/refunds/portal` : null,
          supportEmail: SUPPORT_EMAIL,
        });
        const sent = await sendUserEmail(updated.email, subject, html);
        logger.info(
          { userId: id, amountUsd: amount, sent },
          sent
            ? "Recovery credited email sent"
            : "Recovery credited email could not be sent",
        );
      } catch (err) {
        logger.error(
          { err, userId: id, amountUsd: amount },
          "Failed to send recovery credited email",
        );
      }
    }

    res.json({ user: updated });
  } catch (err) {
    logger.error({ err }, "Failed to record recovery");
    res.status(500).json({ error: "Failed to record recovery" });
  }
});

// Correct a user's cumulative recovered total after a mistyped recovery
// credit. Unlike record-recovery (increment-only), this sets the recovered
// total to an explicit corrected value — never below 0 and never above the
// reported loss — and writes an audit entry capturing the before/after
// values and the admin's stated reason.
router.post("/users/:id/adjust-recovery", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number.parseInt(String(rawId ?? ""), 10);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const body = (req.body ?? {}) as { recoveredUsd?: unknown; reason?: unknown };
    const newTotal = typeof body.recoveredUsd === "number" ? body.recoveredUsd : Number(body.recoveredUsd);
    if (!Number.isFinite(newTotal) || newTotal < 0) {
      res.status(400).json({ error: "recoveredUsd must be a non-negative number" });
      return;
    }
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.reportedLossUsd === null) {
      res.status(400).json({ error: "This user has no documented reported loss yet." });
      return;
    }
    if (newTotal > user.reportedLossUsd) {
      res.status(400).json({
        error: `Corrected total cannot exceed the reported loss ($${user.reportedLossUsd.toLocaleString("en-US")}).`,
      });
      return;
    }
    const previousTotal = user.recoveredUsd;
    if (newTotal === previousTotal) {
      res.status(400).json({ error: "Corrected total matches the current recovered total — nothing to change." });
      return;
    }

    // Re-check both bounds inside the UPDATE so a concurrent recovery credit
    // can't slip in between our read and this write and be silently
    // overwritten past the reported-loss cap.
    const [updated] = await db
      .update(users)
      .set({ recoveredUsd: newTotal, updatedAt: new Date() })
      .where(sql`${users.id} = ${id} AND ${users.recoveredUsd} = ${previousTotal} AND ${users.reportedLossUsd} IS NOT NULL AND ${newTotal} <= ${users.reportedLossUsd}`)
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        reportedLossUsd: users.reportedLossUsd,
        recoveredUsd: users.recoveredUsd,
      });

    if (!updated) {
      res.status(409).json({ error: "The recovered total changed while you were editing. Please reload and try again." });
      return;
    }

    await db.insert(adminActivityLog).values({
      eventType: "user_recovery_adjusted",
      description: `Admin corrected recovered total for ${updated.name} (${updated.email}) from $${previousTotal.toLocaleString("en-US")} to $${updated.recoveredUsd.toLocaleString("en-US")}${reason ? ` — reason: ${reason}` : ""}`,
      metadata: {
        userId: id,
        previousRecoveredUsd: previousTotal,
        recoveredUsd: updated.recoveredUsd,
        reportedLossUsd: updated.reportedLossUsd,
        reason: reason || null,
      },
    });

    res.json({ user: updated });
  } catch (err) {
    logger.error({ err }, "Failed to adjust recovery");
    res.status(500).json({ error: "Failed to adjust recovery" });
  }
});

// Clear the per-account sign-in failure counter for a user. Used by the
// admin "Unlock sign-in" action so that a customer who locked themselves
// out (typo, forgotten password) can immediately retry without waiting
// for the 15-minute window to expire. Idempotent: returns success even
// if the account had no active failures recorded.
router.post("/users/:id/unlock-login", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number.parseInt(String(rawId ?? ""), 10);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, id));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // The server-side throttle keys failures by the normalized email used
    // at sign-in time (lowercased). Match that here so the clear actually
    // hits the same bucket.
    const key = user.email.trim().toLowerCase();
    await clearLoginFailures(key);

    await db.insert(adminActivityLog).values({
      eventType: "user_login_unlocked",
      description: `Admin cleared sign-in lockout for ${user.name} (${user.email})`,
      metadata: { userId: user.id, email: user.email },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to clear sign-in lockout");
    res.status(500).json({ error: "Failed to clear sign-in lockout" });
  }
});

router.get("/activity", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const activity = await db
      .select({
        id: adminActivityLog.id,
        eventType: adminActivityLog.eventType,
        clientId: adminActivityLog.clientId,
        description: adminActivityLog.description,
        metadata: adminActivityLog.metadata,
        createdAt: adminActivityLog.createdAt,
        clientName: adminClients.name,
      })
      .from(adminActivityLog)
      .leftJoin(adminClients, eq(adminActivityLog.clientId, adminClients.id))
      .orderBy(desc(adminActivityLog.createdAt))
      .limit(100);
    res.json({ activity });
  } catch (err) {
    logger.error({ err }, "Failed to load activity");
    res.status(500).json({ error: "Failed to load activity" });
  }
});

router.get("/wallet-configs", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const configs = await db
      .select()
      .from(cryptoWalletConfigs)
      .orderBy(asc(cryptoWalletConfigs.sortOrder), asc(cryptoWalletConfigs.symbol));
    res.json({ configs });
  } catch (err) {
    logger.error({ err }, "Failed to fetch wallet configs");
    res.status(500).json({ error: "Failed to fetch wallet configs" });
  }
});

router.post("/wallet-configs", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol, network, address, label, isActive, sortOrder } = req.body as {
      symbol?: string; network?: string; address?: string;
      label?: string; isActive?: boolean; sortOrder?: number;
    };
    const trimmedAddress = address?.trim() ?? "";
    if (!symbol?.trim() || !network?.trim() || !trimmedAddress) {
      res.status(400).json({ error: "symbol, network, and address are required and must not be blank" });
      return;
    }
    const [config] = await db.insert(cryptoWalletConfigs).values({
      symbol: symbol.trim().toUpperCase(),
      network: network.trim(),
      address: trimmedAddress,
      label: label?.trim() ?? null,
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.status(201).json({ config });
  } catch (err) {
    logger.error({ err }, "Failed to create wallet config");
    res.status(500).json({ error: "Failed to create wallet config" });
  }
});

router.patch("/wallet-configs/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(String(req.params.id));
    const { address, label, isActive, sortOrder, network } = req.body as {
      address?: string; label?: string; isActive?: boolean; sortOrder?: number; network?: string;
    };
    if (address !== undefined && !address.trim()) {
      res.status(400).json({ error: "address must not be blank" });
      return;
    }
    const [config] = await db.update(cryptoWalletConfigs)
      .set({
        ...(address !== undefined && { address: address.trim() }),
        ...(label !== undefined && { label: label?.trim() ?? null }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(network !== undefined && { network: network.trim() }),
        updatedAt: new Date(),
      })
      .where(eq(cryptoWalletConfigs.id, id))
      .returning();
    if (!config) {
      res.status(404).json({ error: "Wallet config not found" });
      return;
    }
    res.json({ config });
  } catch (err) {
    logger.error({ err }, "Failed to update wallet config");
    res.status(500).json({ error: "Failed to update wallet config" });
  }
});

router.get("/coin-section-orders", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const orders = await db
      .select()
      .from(coinSectionOrders)
      .orderBy(asc(coinSectionOrders.sortOrder), asc(coinSectionOrders.symbol));
    res.json({ orders });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "42P01") {
      logger.warn({ err }, "coin_section_orders table missing; returning empty list");
      res.json({ orders: [] });
      return;
    }
    logger.error({ err }, "Failed to fetch coin section orders");
    res.status(500).json({ error: "Failed to fetch coin section orders" });
  }
});

router.put("/coin-section-orders", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { orders } = req.body as { orders?: Array<{ symbol?: string; sortOrder?: number }> };
    if (!Array.isArray(orders) || orders.length === 0) {
      res.status(400).json({ error: "orders[] is required and must not be empty" });
      return;
    }
    const cleaned: Array<{ symbol: string; sortOrder: number }> = [];
    for (const o of orders) {
      const symbol = o?.symbol?.trim().toUpperCase();
      const sortOrder = Number(o?.sortOrder);
      if (!symbol || !Number.isFinite(sortOrder)) {
        res.status(400).json({ error: "each entry requires symbol and numeric sortOrder" });
        return;
      }
      if (!SUPPORTED_COIN_SYMBOLS.has(symbol)) {
        res.status(400).json({ error: `unsupported coin symbol: ${symbol}` });
        return;
      }
      cleaned.push({ symbol, sortOrder });
    }
    const seen = new Set<string>();
    for (const o of cleaned) {
      if (seen.has(o.symbol)) {
        res.status(400).json({ error: `duplicate symbol in orders: ${o.symbol}` });
        return;
      }
      seen.add(o.symbol);
    }
    await db.transaction(async (tx) => {
      for (const o of cleaned) {
        await tx
          .insert(coinSectionOrders)
          .values({ symbol: o.symbol, sortOrder: o.sortOrder })
          .onConflictDoUpdate({
            target: coinSectionOrders.symbol,
            set: { sortOrder: o.sortOrder, updatedAt: new Date() },
          });
      }
    });
    const refreshed = await db
      .select()
      .from(coinSectionOrders)
      .orderBy(asc(coinSectionOrders.sortOrder), asc(coinSectionOrders.symbol));
    res.json({ orders: refreshed });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "42P01") {
      logger.error({ err }, "coin_section_orders table missing — run db push to create it");
      res.status(503).json({ error: "Coin section ordering is not yet available. Run database migration (pnpm --filter db push)." });
      return;
    }
    logger.error({ err }, "Failed to update coin section orders");
    res.status(500).json({ error: "Failed to update coin section orders" });
  }
});

router.delete("/wallet-configs/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(String(req.params.id));
    const [deleted] = await db.delete(cryptoWalletConfigs)
      .where(eq(cryptoWalletConfigs.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Wallet config not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete wallet config");
    res.status(500).json({ error: "Failed to delete wallet config" });
  }
});

// ─── KYC review ────────────────────────────────────────────────────────────

router.get("/kyc", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "pending";
  try {
    const rows = await db
      .select({
        id: kycSubmissions.id,
        userId: kycSubmissions.userId,
        fullName: kycSubmissions.fullName,
        dateOfBirth: kycSubmissions.dateOfBirth,
        address: kycSubmissions.address,
        city: kycSubmissions.city,
        country: kycSubmissions.country,
        idType: kycSubmissions.idType,
        idNumber: kycSubmissions.idNumber,
        photoMimeType: kycSubmissions.photoMimeType,
        status: kycSubmissions.status,
        reviewedAt: kycSubmissions.reviewedAt,
        reviewerNotes: kycSubmissions.reviewerNotes,
        createdAt: kycSubmissions.createdAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(kycSubmissions)
      .innerJoin(users, eq(users.id, kycSubmissions.userId))
      .where(statusFilter === "all" ? sql`true` : eq(kycSubmissions.status, statusFilter))
      .orderBy(desc(kycSubmissions.createdAt))
      .limit(200);

    // Attach the full attempt history for each user so the admin can see prior
    // submissions (e.g. earlier rejections) without leaving the page. Done in a
    // single query keyed on the userIds present in `rows` to avoid N+1.
    const userIds = Array.from(new Set(rows.map(r => r.userId)));
    const history = userIds.length === 0
      ? []
      : await db
          .select({
            id: kycSubmissions.id,
            userId: kycSubmissions.userId,
            status: kycSubmissions.status,
            createdAt: kycSubmissions.createdAt,
            reviewedAt: kycSubmissions.reviewedAt,
            reviewerNotes: kycSubmissions.reviewerNotes,
          })
          .from(kycSubmissions)
          .where(inArray(kycSubmissions.userId, userIds))
          .orderBy(desc(kycSubmissions.createdAt));
    const attemptsByUser = new Map<number, typeof history>();
    for (const h of history) {
      const list = attemptsByUser.get(h.userId);
      if (list) list.push(h);
      else attemptsByUser.set(h.userId, [h]);
    }
    const submissions = rows.map(r => {
      const attempts = attemptsByUser.get(r.userId) ?? [];
      // Attempts are sorted newest-first; attemptNumber counts from oldest = 1.
      const idx = attempts.findIndex(a => a.id === r.id);
      const total = attempts.length;
      const attemptNumber = idx === -1 ? total : total - idx;
      return { ...r, attemptNumber, totalAttempts: total, attempts };
    });
    res.json({ submissions });
  } catch (err) {
    logger.error({ err }, "Failed to list KYC submissions");
    res.status(500).json({ error: "Failed to list KYC submissions" });
  }
});

router.get("/kyc/:id/photo", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid submission id" });
    return;
  }
  try {
    const [row] = await db
      .select({
        photoObjectPath: kycSubmissions.photoObjectPath,
        photoMimeType: kycSubmissions.photoMimeType,
      })
      .from(kycSubmissions)
      .where(eq(kycSubmissions.id, id))
      .limit(1);
    if (!row || !row.photoObjectPath) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    const svc = new ObjectStorageService();
    const file = await svc.getObjectEntityFile(row.photoObjectPath);
    const [metadata] = await file.getMetadata();
    res.setHeader(
      "Content-Type",
      (metadata.contentType as string) || row.photoMimeType || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "private, max-age=300");
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    const stream = file.createReadStream();
    stream.on("error", (e) => {
      logger.error({ err: e }, "Stream error reading KYC photo");
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    stream.pipe(res);
  } catch (err) {
    logger.error({ err }, "Failed to load KYC photo");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to load photo" });
    }
  }
});

async function decideKyc(req: Request, res: Response, decision: "approved" | "rejected"): Promise<void> {
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid submission id" });
    return;
  }
  const rawNotes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
  // Rejections must include a reason — the user sees it in their KYC modal
  // and needs to know what to fix. Notes are optional on approval.
  if (decision === "rejected" && rawNotes.length === 0) {
    res.status(400).json({ error: "A rejection reason is required so the user knows what to fix." });
    return;
  }
  const notes = rawNotes.length > 0 ? rawNotes.slice(0, 500) : null;
  try {
    const [submission] = await db.select().from(kycSubmissions).where(eq(kycSubmissions.id, id)).limit(1);
    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (submission.status !== "pending") {
      res.status(409).json({ error: `Submission has already been ${submission.status}.` });
      return;
    }
    const now = new Date();
    await db.update(kycSubmissions).set({
      status: decision,
      reviewerNotes: notes,
      reviewedAt: now,
      updatedAt: now,
    }).where(eq(kycSubmissions.id, id));
    await db.update(users).set({ kycStatus: decision, updatedAt: now }).where(eq(users.id, submission.userId));
    await db.insert(adminActivityLog).values({
      eventType: decision === "approved" ? "kyc_approved" : "kyc_rejected",
      description: `KYC submission #${id} ${decision} for ${submission.fullName}`,
      metadata: { submissionId: id, userId: submission.userId, notes },
    });

    // Notify the user by email so they don't have to refresh the dashboard
    // to learn the outcome. A failed notification must never roll back the
    // decision itself — log and move on.
    try {
      const [recipient] = await db
        .select({
          name: users.name,
          email: users.email,
          notificationPreferences: users.notificationPreferences,
        })
        .from(users)
        .where(eq(users.id, submission.userId))
        .limit(1);
      const wantsKycEmail =
        !!recipient &&
        resolveNotificationPreferences(recipient.notificationPreferences).kycDecisions;
      if (recipient?.email && wantsKycEmail) {
        const appUrl = buildAdminAppUrl(req);
        const built = decision === "approved"
          ? kycApprovedEmail({
              name: recipient.name,
              email: recipient.email,
              decidedAt: now,
              dashboardUrl: appUrl,
              supportEmail: KYC_SUPPORT_EMAIL,
            })
          : kycRejectedEmail({
              name: recipient.name,
              email: recipient.email,
              decidedAt: now,
              reviewerNotes: notes ?? "",
              resubmitUrl: appUrl,
              supportEmail: KYC_SUPPORT_EMAIL,
            });
        const sent = await sendUserEmail(recipient.email, built.subject, built.html);
        logger.info(
          { userId: submission.userId, decision, sent },
          sent ? "KYC decision email sent" : "KYC decision email could not be sent",
        );
      }
    } catch (err) {
      logger.error({ err, decision, userId: submission.userId }, "Failed to send KYC decision email");
    }

    res.json({ ok: true, status: decision });
  } catch (err) {
    logger.error({ err, decision }, "Failed to update KYC status");
    res.status(500).json({ error: "Failed to update KYC status" });
  }
}

router.post("/kyc/:id/approve", requireAdmin, (req, res) => decideKyc(req, res, "approved"));
router.post("/kyc/:id/reject", requireAdmin, (req, res) => decideKyc(req, res, "rejected"));

export default router;
