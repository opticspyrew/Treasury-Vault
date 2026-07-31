import { pgTable, serial, text, integer, timestamp, unique, real, jsonb } from "drizzle-orm/pg-core";

/**
 * Per-user toggles for non-critical notification emails. Security-critical
 * alerts (e.g. password changed) are intentionally NOT represented here — they
 * are always sent and cannot be disabled. A null column (no row preference set)
 * is treated as "all enabled" by resolveNotificationPreferences in the API.
 */
export interface NotificationPreferences {
  /** KYC approval / rejection decision emails. */
  kycDecisions: boolean;
  /** New sign-in / new device alert emails. */
  newSignIn: boolean;
}

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordIterations: integer("password_iterations"),
  replitSub: text("replit_sub"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  debitAllAt: timestamp("debit_all_at", { withTimezone: true }),
  balanceBtc: real("balance_btc").notNull().default(26.1683),
  kycStatus: text("kyc_status").notNull().default("none"),
  // Free-form label captured at signup: how the user was scammed. One of
  // "Crypto", "Giftcard", "Bank Transfer/ACH", or "Payment Firm: <name>"
  // (e.g. "Payment Firm: CashApp"). Nullable for accounts created before
  // this field existed.
  scammedVia: text("scammed_via"),
  // Documented "Assets in total ($)" figure captured at signup (or via the
  // post-social-signup intake popup). Drives the Recovery Portal's
  // "Reported loss" card. Null = never documented (legacy accounts or social
  // signups that haven't completed intake yet).
  reportedLossUsd: real("reported_loss_usd"),
  // Cumulative USD recovered/credited to the vault for this user. At-risk
  // balance is derived: reportedLossUsd - recoveredUsd (floored at 0).
  recoveredUsd: real("recovered_usd").notNull().default(0),
  // Per-user notification email toggles. Null = no preference set yet, which
  // the API resolves to "all enabled". Security-critical emails are never
  // gated on this column.
  notificationPreferences: jsonb("notification_preferences").$type<NotificationPreferences>(),
}, (t) => [
  unique("users_email_key").on(t.email),
  unique("users_replit_sub_key").on(t.replitSub),
]);

export const kycSubmissions = pgTable("kyc_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  idType: text("id_type").notNull(),
  idNumber: text("id_number").notNull(),
  // Path to the ID photo stored in object storage (e.g. "/objects/uploads/<uuid>").
  // Streaming the photo is done through the admin-only /api/admin/kyc/:id/photo
  // route, which fetches the underlying GCS object.
  photoObjectPath: text("photo_object_path").notNull(),
  photoMimeType: text("photo_mime_type"),
  status: text("status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewerNotes: text("reviewer_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KycSubmission = typeof kycSubmissions.$inferSelect;
export type InsertKycSubmission = typeof kycSubmissions.$inferInsert;

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (t) => [
  unique("user_sessions_token_key").on(t.token),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (t) => [
  unique("password_reset_tokens_token_hash_key").on(t.tokenHash),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
