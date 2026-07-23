import { pgTable, serial, text, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * target_type: 'all' | 'operator' | 'station'
 * target_ids: array of operator/station IDs (empty means all)
 */
export const promosTable = pgTable("promos", {
  id:                serial("id").primaryKey(),
  title:             text("title").notNull(),
  discount_pct:      integer("discount_pct").notNull().default(0),
  starts_at:         timestamp("starts_at", { withTimezone: true }),
  ends_at:           timestamp("ends_at", { withTimezone: true }),
  is_active:         boolean("is_active").notNull().default(true),
  target_type:       text("target_type").notNull().default("all"),
  target_ids:        json("target_ids").$type<number[]>().notNull().default([]),
  traffic_threshold: integer("traffic_threshold"),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPromoSchema = createInsertSchema(promosTable).omit({ id: true, created_at: true });
export type InsertPromo = z.infer<typeof insertPromoSchema>;
export type Promo = typeof promosTable.$inferSelect;
