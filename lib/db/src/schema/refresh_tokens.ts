import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Refresh-токены пользователей.
 *
 * Хранится не сам токен, а его SHA-256: утечка таблицы не должна давать
 * возможность войти под чужим аккаунтом.
 *
 * Строка живёт и после отзыва — по `revoked_at` видно, что сессию закрыли, а
 * повторная попытка использовать отозванный токен становится сигналом кражи.
 */
export const refreshTokensTable = pgTable(
  "refresh_tokens",
  {
    id: serial("id").primaryKey(),
    user_id: text("user_id").notNull(),
    token_hash: text("token_hash").notNull().unique(),
    /** Модель устройства или user-agent — чтобы человек узнал свою сессию в списке. */
    device: text("device"),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_refresh_tokens_user").on(t.user_id),
  ],
);

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
