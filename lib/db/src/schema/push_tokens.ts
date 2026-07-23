import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const pushPlatformEnum = pgEnum("push_platform", ["ios", "android", "web"]);

export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  platform: pushPlatformEnum("platform").notNull(),
  token: text("token").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PushToken = typeof pushTokensTable.$inferSelect;
