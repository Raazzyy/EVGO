import { pgTable, text, serial, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * api_type values: none | ocpi | ocpp | custom | manual
 * Stored as plain text for schema flexibility; validated in application layer.
 */
export const operatorsTable = pgTable("operators", {
  id:                 serial("id").primaryKey(),
  name:               text("name").notNull(),
  logo_url:           text("logo_url"),
  // ── Extended contact / contract fields ─────────────────────────────────
  contact_person:     text("contact_person"),
  phone:              text("phone"),
  email:              text("email"),
  contract_notes:     text("contract_notes"),
  // ── Integration / API fields ────────────────────────────────────────────
  api_type:           text("api_type").notNull().default("none"),
  api_endpoint:       text("api_endpoint"),
  /** Stored as plaintext MVP; production vault is out of scope for this task */
  api_credentials:    text("api_credentials"),
  // ── Financial ──────────────────────────────────────────────────────────
  default_margin_pct: numeric("default_margin_pct", { precision: 5, scale: 2 }),
});

export const insertOperatorSchema = createInsertSchema(operatorsTable).omit({ id: true });
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type Operator = typeof operatorsTable.$inferSelect;
