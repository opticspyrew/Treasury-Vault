import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

export const providerIdentities = pgTable("provider_identities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(),
  emailAtLink: text("email_at_link"),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("provider_identities_provider_user_key").on(t.provider, t.providerUserId),
]);

export type ProviderIdentity = typeof providerIdentities.$inferSelect;
export type InsertProviderIdentity = typeof providerIdentities.$inferInsert;
