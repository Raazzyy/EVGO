import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const favoritesTable = pgTable("favorites", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  station_id: integer("station_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.user_id, t.station_id)]);

export const insertFavoriteSchema = createInsertSchema(favoritesTable).omit({ id: true, created_at: true });
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favoritesTable.$inferSelect;
