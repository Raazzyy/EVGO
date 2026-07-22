import { pgTable, text, serial, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const connectorTypeEnum = pgEnum("connector_type", ["CCS2", "CHAdeMO", "Type2", "GB-T"]);

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  battery_kwh: real("battery_kwh").notNull(),
  range_km: real("range_km").notNull(),
  connector_type: connectorTypeEnum("connector_type").notNull(),
  current_battery_pct: real("current_battery_pct"),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
