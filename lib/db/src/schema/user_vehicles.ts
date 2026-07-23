import { pgTable, serial, text, real, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { vehiclesTable } from "./vehicles";

export const userVehiclesTable = pgTable("user_vehicles", {
  id:                  serial("id").primaryKey(),
  user_id:             text("user_id").notNull(),
  vehicle_id:          integer("vehicle_id").notNull().references(() => vehiclesTable.id, { onDelete: "cascade" }),
  nickname:            text("nickname"),
  current_battery_pct: real("current_battery_pct"),
  is_default:          boolean("is_default").notNull().default(false),
  created_at:          timestamp("created_at").notNull().defaultNow(),
});

export type UserVehicle = typeof userVehiclesTable.$inferSelect;
export type InsertUserVehicle = typeof userVehiclesTable.$inferInsert;
