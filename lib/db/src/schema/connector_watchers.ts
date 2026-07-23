import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const connectorWatchersTable = pgTable("connector_watchers", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  connector_id: integer("connector_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConnectorWatcherSchema = createInsertSchema(connectorWatchersTable).omit({ id: true, created_at: true });
export type InsertConnectorWatcher = z.infer<typeof insertConnectorWatcherSchema>;
export type ConnectorWatcher = typeof connectorWatchersTable.$inferSelect;
