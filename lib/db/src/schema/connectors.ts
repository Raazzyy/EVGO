import { pgTable, text, serial, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const connectorStatusEnum = pgEnum("connector_status", ["free", "occupied", "offline", "reserved"]);

export const connectorsTable = pgTable("connectors", {
  id: serial("id").primaryKey(),
  station_id: integer("station_id").notNull(),
  label: text("label").notNull(), // 'A', 'B', 'C', ...
  type: text("type").notNull(),   // 'CCS2', 'CHAdeMO', 'Type2', 'GB-T'
  power_kw: real("power_kw").notNull(),
  status: connectorStatusEnum("status").notNull().default("free"),
  current_session_id: integer("current_session_id"),
  reserved_by_user_id: text("reserved_by_user_id"),
  reserved_until: timestamp("reserved_until", { withTimezone: true }),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConnectorSchema = createInsertSchema(connectorsTable).omit({ id: true, updated_at: true });
export type InsertConnector = z.infer<typeof insertConnectorSchema>;
export type Connector = typeof connectorsTable.$inferSelect;
