import { pgTable, text, timestamp, real, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membershipTierEnum = pgEnum("membership_tier", ["free", "premium"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  membership_tier: membershipTierEnum("membership_tier").notNull().default("free"),
  total_sessions: integer("total_sessions").notNull().default(0),
  total_spent: real("total_spent").notNull().default(0),
  total_energy_kwh: real("total_energy_kwh").notNull().default(0),
  co2_saved_kg: real("co2_saved_kg").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
