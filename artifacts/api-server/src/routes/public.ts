import { Router, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { db } from "@workspace/db";
import { adminClients, adminServiceRequests, adminActivityLog, cryptoWalletConfigs, coinSectionOrders, users, kycSubmissions } from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { sendAdminEmail, newClientEmail, newServiceRequestEmail, newKycSubmissionEmail } from "../lib/email";
import { extractBearerToken, findUserBySessionToken } from "../lib/auth";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();

// Per-IP throttle shared by the unauthenticated submission routes
// (`/register`, `/request`, `/payment-confirmation`). 10 successful writes
// per minute per IP; failed requests don't count against the budget.
// Keyed by `req.ip` (valid because `app.ts` sets `trust proxy: 1`).
const publicSubmissionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, "Public submission rate limit exceeded");
    res.status(429).json({ error: "Too many requests, please try again in a minute." });
  },
});

const STATIC_RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, BTC: 1 / 27000 };
const CACHE_TTL_MS = 60_000;
let ratesCache: { rates: Record<string, number>; fetchedAt: number } | null = null;

router.get("/exchange-rates", async (_req: Request, res: Response): Promise<void> => {
  const now = Date.now();
  if (ratesCache && now - ratesCache.fetchedAt < CACHE_TTL_MS) {
    res.json({ rates: ratesCache.rates, cached: true });
    return;
  }

  const rates: Record<string, number> = { ...STATIC_RATES };

  try {
    const [fiatResult, btcResult] = await Promise.allSettled([
      fetch("https://open.er-api.com/v6/latest/USD").then(r => {
        if (!r.ok) throw new Error(`open.er-api returned ${r.status}`);
        return r.json();
      }),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd").then(r => {
        if (!r.ok) throw new Error(`coingecko returned ${r.status}`);
        return r.json();
      }),
    ]);

    if (fiatResult.status === "fulfilled") {
      const data = fiatResult.value as { rates?: Record<string, number> };
      if (data.rates?.EUR) rates.EUR = data.rates.EUR;
      if (data.rates?.GBP) rates.GBP = data.rates.GBP;
    } else {
      logger.warn({ err: fiatResult.reason }, "Fiat rate provider unavailable, using static EUR/GBP");
    }

    if (btcResult.status === "fulfilled") {
      const data = btcResult.value as { bitcoin?: { usd?: number } };
      if (data.bitcoin?.usd && data.bitcoin.usd > 0) {
        rates.BTC = 1 / data.bitcoin.usd;
      }
    } else {
      logger.warn({ err: btcResult.reason }, "BTC rate provider unavailable, using static BTC rate");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch live exchange rates, using static fallback");
  }

  ratesCache = { rates, fetchedAt: now };
  res.json({ rates, cached: false });
});

router.post("/register", publicSubmissionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email } = req.body as { name?: string; email?: string };
    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    // Project only the id column — admin-only fields (phone, company, status,
    // notes, timestamps) must never be returned to an unauthenticated caller.
    const [existing] = await db
      .select({ id: adminClients.id })
      .from(adminClients)
      .where(eq(adminClients.email, normalizedEmail));
    if (existing) {
      res.json({ alreadyExists: true, emailSent: false });
      return;
    }

    const [client] = await db.insert(adminClients).values({
      name: name.trim(),
      email: normalizedEmail,
      status: "pending",
    }).returning();

    await db.insert(adminActivityLog).values({
      eventType: "client_registered",
      clientId: client.id,
      description: `New client registered via Treasury Vault: ${client.name} (${client.email})`,
      metadata: { name: client.name, email: client.email },
    });

    const { subject, html } = newClientEmail({ ...client, createdAt: client.createdAt as Date });
    const emailSent = await sendAdminEmail(subject, html);

    logger.info({ clientId: client.id, email: normalizedEmail, emailSent }, "New client registered via public endpoint");
    res.status(201).json({ client: { id: client.id }, alreadyExists: false, emailSent });
  } catch (err) {
    logger.error({ err }, "Failed to register client via public endpoint");
    res.status(500).json({ error: "Failed to register client" });
  }
});

router.get("/tx-approvals", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = String(req.query.txnIds ?? "").trim();
    if (!raw) {
      res.json({ approvals: [] });
      return;
    }
    const ids = raw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);
    if (ids.length === 0) {
      res.json({ approvals: [] });
      return;
    }
    const rows = await db
      .select({ txnId: adminServiceRequests.txnId, status: adminServiceRequests.status })
      .from(adminServiceRequests)
      .where(
        ids.length === 1
          ? eq(adminServiceRequests.txnId, ids[0])
          : inArray(adminServiceRequests.txnId, ids)
      );
    res.json({ approvals: rows.filter(r => r.txnId != null) });
  } catch (err) {
    logger.error({ err }, "Failed to fetch tx approvals");
    res.status(500).json({ error: "Failed to fetch approvals" });
  }
});

router.post("/request", publicSubmissionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, type, amount, currency, notes, txnId } = req.body as {
      name?: string; email?: string;
      type?: string; amount?: string; currency?: string; notes?: string; txnId?: string;
    };

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    // KYC gate: Send and Withdrawal requests require an authenticated user
    // whose account has been KYC-approved. This is the authoritative check —
    // the dashboard UI also gates these actions, but client-side gating alone
    // is insufficient since the endpoint is callable directly.
    const normalizedType = (type ?? "").toLowerCase().trim();
    const isMoneyMovement = normalizedType === "send" || normalizedType === "withdrawal" || normalizedType === "withdraw";
    if (isMoneyMovement) {
      const authed = await getAuthedUser(req);
      if (!authed) {
        res.status(401).json({ error: "Sign in required to submit this request." });
        return;
      }
      if (authed.kycStatus !== "approved") {
        res.status(403).json({
          error: "Identity verification is required before you can send or withdraw.",
          kycStatus: authed.kycStatus,
        });
        return;
      }
      // Use the authenticated identity rather than trusting the request body,
      // so a signed-in user can't submit under another identity.
      if (authed.email.toLowerCase() !== email.toLowerCase().trim()) {
        res.status(403).json({ error: "Email does not match the signed-in account." });
        return;
      }
    }

    const normalizedEmail = email.toLowerCase().trim();
    let [client] = await db.select().from(adminClients).where(eq(adminClients.email, normalizedEmail));

    if (!client) {
      const [newClient] = await db.insert(adminClients).values({
        name: name?.trim() ?? normalizedEmail.split("@")[0],
        email: normalizedEmail,
        status: "pending",
      }).returning();
      client = newClient;

      await db.insert(adminActivityLog).values({
        eventType: "client_registered",
        clientId: client.id,
        description: `Client auto-created from service request: ${client.name} (${client.email})`,
        metadata: { name: client.name, email: client.email },
      });
    }

    const [request] = await db.insert(adminServiceRequests).values({
      clientId: client.id,
      type: type ?? "withdrawal",
      amount: amount ? String(amount) : null,
      currency: currency ?? "USD",
      notes: notes?.trim() ?? null,
      txnId: txnId?.trim() || null,
      status: "pending",
    }).returning();

    await db.insert(adminActivityLog).values({
      eventType: "service_request_submitted",
      clientId: client.id,
      description: `${type ?? "withdrawal"} request from ${client.name}: ${currency ?? "USD"} ${amount ?? "N/A"}`,
      metadata: { type, amount, currency },
    });

    const { subject, html } = newServiceRequestEmail({
      client: { name: client.name, email: client.email },
      request: { ...request, createdAt: request.createdAt as Date },
    });
    const emailSent = await sendAdminEmail(subject, html);

    logger.info({ clientId: client.id, requestId: request.id, type, emailSent }, "Service request submitted via public endpoint");
    res.status(201).json({ request: { id: request.id, publicToken: request.publicToken }, emailSent });
  } catch (err) {
    logger.error({ err }, "Failed to submit service request via public endpoint");
    res.status(500).json({ error: "Failed to submit request" });
  }
});

router.post("/payment-confirmation", publicSubmissionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, amount, currency, notes } = req.body as {
      name?: string; email?: string; amount?: string; currency?: string; notes?: string;
    };

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    let [client] = await db.select().from(adminClients).where(eq(adminClients.email, normalizedEmail));

    if (!client) {
      const [newClient] = await db.insert(adminClients).values({
        name: name?.trim() ?? normalizedEmail.split("@")[0],
        email: normalizedEmail,
        status: "pending",
      }).returning();
      client = newClient;
    }

    const [request] = await db.insert(adminServiceRequests).values({
      clientId: client.id,
      type: "payment_confirmation",
      amount: amount ? String(amount) : null,
      currency: currency ?? "USD",
      notes: notes?.trim() ?? "Awaiting admin approval to release funds.",
      status: "pending",
    }).returning();

    await db.insert(adminActivityLog).values({
      eventType: "service_request_submitted",
      clientId: client.id,
      description: `Payment confirmation request from ${client.name}: ${currency ?? "USD"} ${amount ?? "N/A"}`,
      metadata: { type: "payment_confirmation", amount, currency },
    });

    const { subject, html } = newServiceRequestEmail({
      client: { name: client.name, email: client.email },
      request: { ...request, type: "Payment Confirmation", createdAt: request.createdAt as Date },
    });
    const emailSent = await sendAdminEmail(subject, html);

    logger.info({ clientId: client.id, requestId: request.id, emailSent }, "Payment confirmation submitted");
    res.status(201).json({ request: { id: request.id, publicToken: request.publicToken }, emailSent });
  } catch (err) {
    logger.error({ err }, "Failed to submit payment confirmation");
    res.status(500).json({ error: "Failed to submit payment confirmation" });
  }
});

// Public status lookup is keyed by the per-row `publicToken` (UUID) issued
// in the response body of `/request` and `/payment-confirmation`.
router.get("/request-status/:token", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token ?? "").trim();
    const isValidToken = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(token);
    if (!isValidToken) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    const [request] = await db
      .select({ id: adminServiceRequests.id, status: adminServiceRequests.status, type: adminServiceRequests.type })
      .from(adminServiceRequests)
      .where(eq(adminServiceRequests.publicToken, token));
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json({ id: request.id, status: request.status, type: request.type });
  } catch (err) {
    logger.error({ err }, "Failed to fetch request status");
    res.status(500).json({ error: "Failed to fetch request status" });
  }
});

router.get("/wallet-configs", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rawConfigs = await db
      .select()
      .from(cryptoWalletConfigs)
      .where(eq(cryptoWalletConfigs.isActive, true))
      .orderBy(asc(cryptoWalletConfigs.sortOrder), asc(cryptoWalletConfigs.symbol));
    let coinOrder: string[] = [];
    try {
      const sectionOrders = await db
        .select()
        .from(coinSectionOrders)
        .orderBy(asc(coinSectionOrders.sortOrder), asc(coinSectionOrders.symbol));
      coinOrder = sectionOrders.map(o => o.symbol);
    } catch (orderErr) {
      const code = (orderErr as { code?: string } | null)?.code;
      if (code === "42P01") {
        logger.warn("coin_section_orders table missing; returning empty coinOrder");
      } else {
        logger.error({ err: orderErr }, "Failed to fetch coin section orders");
        res.status(500).json({ error: "Failed to fetch wallet configs" });
        return;
      }
    }
    const orderRank = new Map<string, number>(coinOrder.map((s, i) => [s, i]));
    const configs = [...rawConfigs].sort((a, b) => {
      const ar = orderRank.has(a.symbol) ? (orderRank.get(a.symbol) as number) : Number.MAX_SAFE_INTEGER;
      const br = orderRank.has(b.symbol) ? (orderRank.get(b.symbol) as number) : Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id - b.id;
    });
    res.json({ configs, coinOrder });
  } catch (err) {
    logger.error({ err }, "Failed to fetch wallet configs");
    res.status(500).json({ error: "Failed to fetch wallet configs" });
  }
});

// ─── KYC verification ──────────────────────────────────────────────────────
// All KYC routes are user-authenticated via the standard Bearer session token
// (issued by /api/auth/login). They live under /public/ for routing parity
// with the rest of the user-facing endpoints — public meaning "called by the
// user-facing client", not "unauthenticated".

const KYC_PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8 MB raw image
const KYC_ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const kycSubmissionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many KYC submissions. Please try again in a minute." });
  },
});

async function getAuthedUser(req: Request): Promise<{ id: number; name: string; email: string; kycStatus: string } | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  const u = await findUserBySessionToken(token);
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, kycStatus: u.kycStatus ?? "none" };
}

router.get("/kyc/status", async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  try {
    const [latest] = await db
      .select({
        id: kycSubmissions.id,
        status: kycSubmissions.status,
        createdAt: kycSubmissions.createdAt,
        reviewedAt: kycSubmissions.reviewedAt,
        reviewerNotes: kycSubmissions.reviewerNotes,
        fullName: kycSubmissions.fullName,
        dateOfBirth: kycSubmissions.dateOfBirth,
        address: kycSubmissions.address,
        city: kycSubmissions.city,
        country: kycSubmissions.country,
        idType: kycSubmissions.idType,
        idNumber: kycSubmissions.idNumber,
      })
      .from(kycSubmissions)
      .where(eq(kycSubmissions.userId, user.id))
      .orderBy(desc(kycSubmissions.createdAt))
      .limit(1);
    // Only expose previous form values when the latest submission was rejected,
    // so the user can correct and resubmit without re-typing everything. For
    // pending/approved submissions we keep the response minimal.
    const submission = latest
      ? (latest.status === "rejected"
          ? latest
          : {
              id: latest.id,
              status: latest.status,
              createdAt: latest.createdAt,
              reviewedAt: latest.reviewedAt,
              reviewerNotes: latest.reviewerNotes,
            })
      : null;
    res.json({
      status: user.kycStatus,
      submission,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load KYC status");
    res.status(500).json({ error: "Failed to load KYC status" });
  }
});

// Issue a short-lived presigned URL the client uses to upload the ID photo
// directly to object storage. The submit endpoint then receives only the
// returned object path — we never round-trip the photo bytes through our server.
router.post("/kyc/upload-url", kycSubmissionLimiter, async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  if (user.kycStatus === "pending" || user.kycStatus === "approved") {
    res.status(409).json({ error: "KYC already submitted." });
    return;
  }
  try {
    const svc = new ObjectStorageService();
    const uploadURL = await svc.getObjectEntityUploadURL();
    res.json({ uploadURL });
  } catch (err) {
    logger.error({ err }, "Failed to issue KYC upload URL");
    res.status(500).json({ error: "Failed to issue upload URL" });
  }
});

router.post("/kyc/submit", kycSubmissionLimiter, async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }

  if (user.kycStatus === "pending") {
    res.status(409).json({ error: "Your KYC submission is already pending review." });
    return;
  }
  if (user.kycStatus === "approved") {
    res.status(409).json({ error: "Your account is already verified." });
    return;
  }

  const body = req.body as Partial<{
    fullName: string;
    dateOfBirth: string;
    address: string;
    city: string;
    country: string;
    idType: string;
    idNumber: string;
    photoUploadURL: string;
    photoMimeType: string;
  }>;

  const required = ["fullName", "dateOfBirth", "address", "city", "country", "idType", "idNumber", "photoUploadURL", "photoMimeType"] as const;
  for (const k of required) {
    const v = body[k];
    if (typeof v !== "string" || !v.trim()) {
      res.status(400).json({ error: `Missing required field: ${k}` });
      return;
    }
  }

  const mime = body.photoMimeType!.toLowerCase();
  if (!KYC_ALLOWED_MIME.has(mime)) {
    res.status(400).json({ error: "ID photo must be a JPEG, PNG, or WebP image." });
    return;
  }

  // Normalize the GCS upload URL the client received from /kyc/upload-url into
  // our internal /objects/<id> path. We verify it actually exists in storage
  // (i.e. the client really uploaded) and that it's within our 8 MB cap.
  const svc = new ObjectStorageService();
  let objectPath: string;
  let photoBuffer: Buffer;
  try {
    objectPath = svc.normalizeObjectEntityPath(body.photoUploadURL!);
    if (!objectPath.startsWith("/objects/")) {
      res.status(400).json({ error: "Invalid upload URL." });
      return;
    }
    const file = await svc.getObjectEntityFile(objectPath);
    const [buf] = await file.download();
    photoBuffer = buf;
    if (photoBuffer.length === 0) {
      res.status(400).json({ error: "Uploaded file is empty." });
      return;
    }
    if (photoBuffer.length > KYC_PHOTO_MAX_BYTES) {
      res.status(413).json({ error: "ID photo is too large (max 8 MB)." });
      return;
    }
  } catch (err) {
    logger.warn({ err }, "KYC submit failed to resolve uploaded photo");
    res.status(400).json({ error: "Uploaded photo could not be verified. Please try again." });
    return;
  }

  try {
    const [submission] = await db.insert(kycSubmissions).values({
      userId: user.id,
      fullName: body.fullName!.trim().slice(0, 200),
      dateOfBirth: body.dateOfBirth!.trim().slice(0, 40),
      address: body.address!.trim().slice(0, 500),
      city: body.city!.trim().slice(0, 120),
      country: body.country!.trim().slice(0, 120),
      idType: body.idType!.trim().slice(0, 60),
      idNumber: body.idNumber!.trim().slice(0, 120),
      photoObjectPath: objectPath,
      photoMimeType: mime,
      status: "pending",
    }).returning();

    await db.update(users).set({ kycStatus: "pending", updatedAt: new Date() }).where(eq(users.id, user.id));

    await db.insert(adminActivityLog).values({
      eventType: "kyc_submitted",
      description: `KYC verification submitted by ${user.name} (${user.email})`,
      metadata: { userId: user.id, submissionId: submission.id, fullName: submission.fullName },
    });

    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const { subject, html } = newKycSubmissionEmail({
      user,
      submission: { ...submission, createdAt: submission.createdAt as Date },
    });
    const emailSent = await sendAdminEmail(subject, html, [
      {
        filename: `kyc-${submission.id}-${user.id}.${ext}`,
        content: photoBuffer,
        contentType: mime,
      },
    ]);

    logger.info({ userId: user.id, submissionId: submission.id, emailSent }, "KYC submitted");
    res.status(201).json({ ok: true, submissionId: submission.id, status: "pending", emailSent });
  } catch (err) {
    logger.error({ err }, "Failed to submit KYC");
    res.status(500).json({ error: "Failed to submit KYC verification" });
  }
});

export default router;
