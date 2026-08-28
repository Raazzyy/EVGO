import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";

/**
 * Одноразовые коды подтверждения телефона.
 *
 * Сам код не хранится — только HMAC от него (см. `lib/auth.ts`). Иначе
 * дамп базы выдаёт действующие коды всех, кто сейчас входит.
 *
 * Записи не удаляются сразу после использования: по ним считается частота
 * запросов. Чистятся по расписанию.
 */
export const otpCodesTable = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    /** 998XXXXXXXXX, без плюса. */
    phone: text("phone").notNull(),
    code_hash: text("code_hash").notNull(),
    /** Сколько раз вводили код для этой записи — защита от подбора. */
    attempts: integer("attempts").notNull().default(0),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumed_at: timestamp("consumed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Поиск последнего кода по номеру и подсчёт запросов за окно.
    index("idx_otp_codes_phone_created").on(t.phone, t.created_at),
  ],
);

export type OtpCode = typeof otpCodesTable.$inferSelect;
