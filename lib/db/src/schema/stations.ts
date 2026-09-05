import {
  pgTable, text, serial, integer, real, pgEnum,
  json, timestamp, boolean, numeric, doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stationStatusEnum = pgEnum("station_status", ["free", "occupied", "offline"]);
export const stationSourceEnum = pgEnum("station_source", ["manual", "api", "mock"]);

export const stationsTable = pgTable("stations", {
  id:                   serial("id").primaryKey(),
  operator_id:          integer("operator_id"),
  name:                 text("name").notNull(),
  address:              text("address").notNull(),
  // double precision — real (Float32) давал дрейф координат ~1–4 м (DB-01).
  lat:                  doublePrecision("lat").notNull(),
  lng:                  doublePrecision("lng").notNull(),
  connectors:           json("connectors")
    .$type<Array<{ type: string; power_kw: number; total: number; available: number }>>()
    .default([]),
  power_kw:             real("power_kw").notNull(),
  price_per_kwh:        real("price_per_kwh").notNull(),
  /** Operator cost before margin — used for margin calculations */
  cost_price_per_kwh:   numeric("cost_price_per_kwh", { precision: 10, scale: 2 }),
  status:               stationStatusEnum("status").notNull().default("free"),
  source:               stationSourceEnum("source").notNull().default("mock"),
  is_promoted:          boolean("is_promoted").notNull().default(false),
  discount_pct:         integer("discount_pct").notNull().default(0),
  promo_ends_at:        timestamp("promo_ends_at", { withTimezone: true }),
  amenities:            json("amenities").$type<string[]>().default([]),
  /** Array of photo URLs; uploads handled by a separate task */
  photos:               json("photos").$type<string[]>().default([]),
  district:             text("district"),
  region:               text("region"),
  supports_reservation: boolean("supports_reservation").notNull().default(false),
  // ── Верификация данных ─────────────────────────────────────────────────
  // Основной источник станций — OpenChargeMap, открытая база, которую
  // наполняют энтузиасты: часть записей устарела, цены почти везде неверны.
  // Пользователь должен видеть, когда станцию проверяли живьём.
  /** Когда станцию последний раз проверяли на месте или по телефону. */
  verified_at:          timestamp("verified_at", { withTimezone: true }),
  /** Кто проверил — email администратора. */
  verified_by:          text("verified_by"),
  updated_at:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStationSchema = createInsertSchema(stationsTable).omit({ id: true, updated_at: true });
export type InsertStation = z.infer<typeof insertStationSchema>;
export type Station = typeof stationsTable.$inferSelect;
