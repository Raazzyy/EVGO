import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const operatorsTable = pgTable("operators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo_url: text("logo_url"),
});

export const insertOperatorSchema = createInsertSchema(operatorsTable).omit({ id: true });
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type Operator = typeof operatorsTable.$inferSelect;
