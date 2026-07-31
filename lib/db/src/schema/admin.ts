import { sql } from "drizzle-orm";
import { pgTable, serial, text, varchar, numeric, integer, timestamp, jsonb, unique, uniqueIndex, boolean, index } from "drizzle-orm/pg-core";

export const adminClients = pgTable("admin_clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  // Manus/Netspy external id for cross-system joins (additive; see
  // docs/manus-data-sync-requirements.md §4). Unique when present; multiple
  // NULLs are allowed for clients not yet linked to Manus.
  manusClientId: text("manus_client_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("admin_clients_email_key").on(t.email),
  uniqueIndex("admin_clients_manus_client_id_key")
    .on(t.manusClientId)
    .where(sql`${t.manusClientId} IS NOT NULL`),
]);

export const adminServiceRequests = pgTable("admin_service_requests", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => adminClients.id),
  type: text("type").notNull().default("withdrawal"),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  txnId: text("txn_id"),
  status: text("status").notNull().default("pending"),
  // Manus/Netspy external case id for cross-system joins (additive; §4).
  // Unique when present; multiple NULLs allowed for cases not yet linked.
  manusCaseId: text("manus_case_id"),
  // Unguessable per-row capability token used by the public status lookup.
  publicToken: varchar("public_token", { length: 64 }).notNull().default(sql`(gen_random_uuid())::text`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("admin_service_requests_public_token_key").on(t.publicToken),
  // Speeds up the per-user pending-withdrawal count on GET /api/auth/sessions,
  // which filters admin_service_requests by client_id, type and status.
  index("admin_service_requests_client_type_status_idx").on(
    t.clientId,
    t.type,
    t.status,
  ),
  uniqueIndex("admin_service_requests_manus_case_id_key")
    .on(t.manusCaseId)
    .where(sql`${t.manusCaseId} IS NOT NULL`),
]);

export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (t) => [
  unique("admin_sessions_token_hash_key").on(t.tokenHash),
]);

export const adminActivityLog = pgTable("admin_activity_log", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  clientId: integer("client_id").references(() => adminClients.id),
  // Optional link to the specific service request (case) this event belongs to.
  // Nullable: client-level events (e.g. client registration, KYC decisions) have
  // no owning case. Case reports filter on this so a client with multiple cases
  // never sees another case's events; events with NULL remain client-scoped.
  serviceRequestId: integer("service_request_id").references(() => adminServiceRequests.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cryptoWalletConfigs = pgTable("crypto_wallet_configs", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  network: text("network").notNull(),
  address: text("address").notNull(),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coinSectionOrders = pgTable("coin_section_orders", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("coin_section_orders_symbol_key").on(t.symbol),
]);

// Durable store of processed Idempotency-Key values for the Manus /sync/*
// endpoints (§4 rules 3–4): a retried write returns the original response
// instead of re-applying. Reused key + different body -> 409. Rows are pruned
// after a retention window (>= 7 days).
export const manusIdempotencyKeys = pgTable("manus_idempotency_keys", {
  key: text("key").primaryKey(),
  requestHash: text("request_hash").notNull(),
  // Nullable until the handler finishes: a row is first inserted as a bare
  // reservation (response columns NULL) to serialize concurrent same-key
  // requests, then updated with the response once the handler completes.
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("manus_idempotency_keys_created_at_idx").on(t.createdAt),
]);

export type ManusIdempotencyKey = typeof manusIdempotencyKeys.$inferSelect;
export type InsertManusIdempotencyKey = typeof manusIdempotencyKeys.$inferInsert;

export type AdminClient = typeof adminClients.$inferSelect;
export type InsertAdminClient = typeof adminClients.$inferInsert;
export type AdminServiceRequest = typeof adminServiceRequests.$inferSelect;
export type InsertAdminServiceRequest = typeof adminServiceRequests.$inferInsert;
export type AdminActivityLog = typeof adminActivityLog.$inferSelect;
export type CryptoWalletConfig = typeof cryptoWalletConfigs.$inferSelect;
export type InsertCryptoWalletConfig = typeof cryptoWalletConfigs.$inferInsert;
export type CoinSectionOrder = typeof coinSectionOrders.$inferSelect;
export type InsertCoinSectionOrder = typeof coinSectionOrders.$inferInsert;
