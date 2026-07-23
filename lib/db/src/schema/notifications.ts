import { pgTable, serial, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const notificationTypeEnum = pgEnum("notification_type", [
  "session_ended",
  "discount_nearby",
  "station_available",
  "low_battery",
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
