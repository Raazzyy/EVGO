import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * background_type: 'gradient' | 'image'
 */
export const bannersTable = pgTable("banners", {
  id:                serial("id").primaryKey(),
  title:             text("title").notNull(),
  subtitle:          text("subtitle"),
  image_url:         text("image_url"),
  background_type:   text("background_type").notNull().default("gradient"),
  gradient_from:     text("gradient_from").default("#2563EB"),
  gradient_to:       text("gradient_to").default("#7C3AED"),
  cta_text:          text("cta_text"),
  cta_target:        text("cta_target"),
  show_countdown:    boolean("show_countdown").notNull().default(false),
  countdown_ends_at: timestamp("countdown_ends_at", { withTimezone: true }),
  priority:          integer("priority").notNull().default(0),
  is_active:         boolean("is_active").notNull().default(true),
  starts_at:         timestamp("starts_at", { withTimezone: true }),
  ends_at:           timestamp("ends_at", { withTimezone: true }),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBannerSchema = createInsertSchema(bannersTable).omit({ id: true, created_at: true });
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof bannersTable.$inferSelect;
