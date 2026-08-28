import { pgTable, text, serial, integer, real, json, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const routeStatusEnum = pgEnum("route_status", ["active", "completed", "cancelled"]);

export const routesTable = pgTable("routes", {
  id: serial("id").primaryKey(),
  /** Владелец маршрута. Без него сохранённые маршруты были видны всем. */
  user_id: text("user_id"),
  vehicle_id: integer("vehicle_id"),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  origin_lat: real("origin_lat"),
  origin_lng: real("origin_lng"),
  dest_lat: real("dest_lat"),
  dest_lng: real("dest_lng"),
  initial_battery_pct: real("initial_battery_pct").notNull().default(80),
  stops: json("stops").$type<Array<{
    station_id: number;
    station_name: string;
    address: string;
    lat: number;
    lng: number;
    arrival_battery_pct: number;
    departure_battery_pct: number;
    charge_time_min: number;
    distance_from_prev_km: number;
    eta: string;
  }>>().default([]),
  total_distance_km: real("total_distance_km").notNull().default(0),
  total_time_min: integer("total_time_min").notNull().default(0),
  status: routeStatusEnum("status").notNull().default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routesTable).omit({ id: true, created_at: true });
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routesTable.$inferSelect;
