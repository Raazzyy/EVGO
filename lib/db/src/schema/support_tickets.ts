import { pgTable, text, serial, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "resolved", "closed"]);

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  user_id: text("user_id"),
  user_email: text("user_email"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: ticketStatusEnum("status").notNull().default("open"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
});

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true, created_at: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
