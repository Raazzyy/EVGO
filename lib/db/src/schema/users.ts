import { pgTable, text, timestamp, real, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membershipTierEnum = pgEnum("membership_tier", ["free", "premium"]);

/** Языки интерфейса: узбекский (латиница), русский, английский. */
export const userLanguageEnum = pgEnum("user_language", ["uz", "ru", "en"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  /**
   * Вход в приложении — по номеру телефона, поэтому email необязателен.
   * Формат хранения: 998XXXXXXXXX, без плюса и разделителей.
   */
  phone: text("phone").unique(),
  phone_verified_at: timestamp("phone_verified_at", { withTimezone: true }),
  email: text("email").unique(),
  name: text("name"),
  language: userLanguageEnum("language").notNull().default("ru"),
  membership_tier: membershipTierEnum("membership_tier").notNull().default("free"),
  total_sessions: integer("total_sessions").notNull().default(0),
  total_spent: real("total_spent").notNull().default(0),
  total_energy_kwh: real("total_energy_kwh").notNull().default(0),
  co2_saved_kg: real("co2_saved_kg").notNull().default(0),
  /**
   * Какие push человек согласен получать.
   *
   * Хранится на сервере, а не только на устройстве: отправку решает сервер,
   * и без этих флагов он слал бы всё подряд — а человек, которого залило
   * уведомлениями, отключает их целиком на уровне системы, и достучаться
   * до него больше нечем.
   */
  notify_session_ended:    boolean("notify_session_ended").notNull().default(true),
  notify_station_available: boolean("notify_station_available").notNull().default(true),
  notify_discount_nearby:  boolean("notify_discount_nearby").notNull().default(true),
  notify_low_battery:      boolean("notify_low_battery").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
