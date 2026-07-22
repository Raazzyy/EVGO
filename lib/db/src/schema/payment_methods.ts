import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentMethodsTable = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  type: text("type").notNull(),
  last_four: text("last_four").notNull(),
  is_default: boolean("is_default").notNull().default(false),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethodsTable).omit({ id: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
