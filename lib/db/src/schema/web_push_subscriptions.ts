import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Подписки веб-версии на push (Web Push API + VAPID).
 *
 * Мобильное приложение уходит через Expo Push по токену устройства; браузер
 * же присылает объект подписки (endpoint + два ключа), и слать ему нужно по
 * протоколу Web Push. Поэтому подписки браузера живут отдельной таблицей.
 *
 * `endpoint` уникален: это адрес push-сервиса браузера, он же идентификатор
 * подписки. Повторная подписка того же браузера обновляет строку, а не плодит
 * дубли.
 */
export const webPushSubscriptionsTable = pgTable("web_push_subscriptions", {
  id:         serial("id").primaryKey(),
  user_id:    text("user_id").notNull(),
  endpoint:   text("endpoint").notNull().unique(),
  p256dh:     text("p256dh").notNull(),
  auth:       text("auth").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWebPushSubscriptionSchema = createInsertSchema(webPushSubscriptionsTable).omit({ id: true, created_at: true });
export type WebPushSubscription = typeof webPushSubscriptionsTable.$inferSelect;
