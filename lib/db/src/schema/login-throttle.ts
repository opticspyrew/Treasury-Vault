import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

// Per-attempt rows that back the sign-in brute-force throttle. Moved out of
// in-memory Maps so the protection survives API server restarts and works
// across multiple server instances.
//
// scope is either "account" (key = normalized email; only failures recorded)
// or "ip" (key = client IP; every login attempt recorded). The throttle
// queries this table by (scope, key) within a rolling time window.
export const loginThrottleAttempts = pgTable(
  "login_throttle_attempts",
  {
    id: serial("id").primaryKey(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("login_throttle_scope_key_time_idx").on(
      t.scope,
      t.key,
      t.occurredAt,
    ),
    index("login_throttle_occurred_at_idx").on(t.occurredAt),
  ],
);

export type LoginThrottleAttempt = typeof loginThrottleAttempts.$inferSelect;
export type InsertLoginThrottleAttempt =
  typeof loginThrottleAttempts.$inferInsert;
