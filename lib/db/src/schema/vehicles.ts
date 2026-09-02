import { pgTable, text, serial, real, pgEnum, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const connectorTypeEnum = pgEnum("connector_type", ["CCS2", "CHAdeMO", "Type2", "GB-T"]);

export const vehiclesTable = pgTable("vehicles", {
  id:                  serial("id").primaryKey(),
  name:                text("name").notNull(),
  battery_kwh:         real("battery_kwh").notNull(),
  range_km:            real("range_km").notNull(),
  connector_type:      connectorTypeEnum("connector_type").notNull(),
  current_battery_pct: real("current_battery_pct"),
  // Extended provenance / search fields
  data_source:   text("data_source").notNull().default("manual"),
  user_id:       text("user_id"),
  make:          text("make"),
  model:         text("model"),
  year:          integer("year"),
  trim_name:     text("trim_name"),
  body_style:    text("body_style"),
  vehicle_type:  text("vehicle_type"),
  is_verified:   boolean("is_verified").notNull().default(true),
}, (t) => [
  // Каталог моделей (user_id IS NULL) — без дублей по имени. Пользовательские
  // авто не участвуют (частичный индекс).
  uniqueIndex("uq_vehicles_catalog_name")
    .on(t.name)
    .where(sql`${t.user_id} is null`),
]);

/** Alias dictionary: Cyrillic spellings + common typos → canonical Latin slug */
export const vehicleAliasesTable = pgTable("vehicle_aliases", {
  id:        serial("id").primaryKey(),
  alias:     text("alias").notNull().unique(),
  canonical: text("canonical").notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
