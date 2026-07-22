import { pgTable, text, serial, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "cancelled"]);

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  station_id: integer("station_id").notNull(),
  user_id: text("user_id"),
  energy_kwh: real("energy_kwh"),
  cost: real("cost"),
  status: sessionStatusEnum("status").notNull().default("active"),
  started_at: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  ended_at: timestamp("ended_at", { withTimezone: true }),
  connector_type: text("connector_type"),
  payment_method_id: integer("payment_method_id"),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, started_at: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
