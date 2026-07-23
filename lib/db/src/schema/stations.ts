import { pgTable, text, serial, integer, real, pgEnum, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stationStatusEnum = pgEnum("station_status", ["free", "occupied", "offline"]);
export const stationSourceEnum = pgEnum("station_source", ["manual", "api", "mock"]);

export const stationsTable = pgTable("stations", {
  id: serial("id").primaryKey(),
  operator_id: integer("operator_id"),
  name: text("name").notNull(),
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  connectors: json("connectors").$type<Array<{type: string; power_kw: number; total: number; available: number}>>().default([]),
  power_kw: real("power_kw").notNull(),
  price_per_kwh: real("price_per_kwh").notNull(),
  status: stationStatusEnum("status").notNull().default("free"),
  source: stationSourceEnum("source").notNull().default("mock"),
  is_promoted: integer("is_promoted").notNull().default(0), // 0=false, 1=true
  discount_pct: integer("discount_pct").notNull().default(0),
  amenities: json("amenities").$type<string[]>().default([]),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStationSchema = createInsertSchema(stationsTable).omit({ id: true, updated_at: true });
export type InsertStation = z.infer<typeof insertStationSchema>;
export type Station = typeof stationsTable.$inferSelect;
