import {
  pgTable, text, serial, integer, bigint, timestamp, pgEnum, json, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Кошелёк и денежный журнал.
 *
 * ВСЕ суммы хранятся в тийинах (1 сум = 100 тийин) целыми числами `bigint`.
 * Деньги нельзя держать в `real`/`float`: 0.1 + 0.2 != 0.3, и на балансах
 * это копится в реальные расхождения. Целые тийины — единственный
 * корректный способ. Конвертация в сумы — только на границе отображения.
 *
 * `mode: "number"`: баланс даже в миллиард сумов = 1e11 тийин, что далеко
 * ниже предела безопасного целого в JS (2^53 ≈ 9e15). Переполнение
 * невозможно на любых реальных суммах.
 */

// ── Кошелёк пользователя ────────────────────────────────────────────────
export const walletsTable = pgTable("wallets", {
  // Один кошелёк на пользователя — user_id и есть первичный ключ.
  user_id:        text("user_id").primaryKey(),
  balance_tiyin:  bigint("balance_tiyin", { mode: "number" }).notNull().default(0),
  updated_at:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  created_at:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Журнал операций (неизменяемый ledger) ───────────────────────────────
// Направление деньг задаёт знак amount_tiyin: пополнение > 0, списание < 0.
export const walletTxnTypeEnum = pgEnum("wallet_txn_type", [
  "topup",        // пополнение через провайдера
  "charge",       // списание за зарядную сессию
  "refund",       // возврат
  "adjustment",   // ручная корректировка администратором
]);

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id:                  serial("id").primaryKey(),
  user_id:             text("user_id").notNull(),
  type:                walletTxnTypeEnum("type").notNull(),
  /** Знаковая сумма в тийинах: пополнение положительное, списание отрицательное. */
  amount_tiyin:        bigint("amount_tiyin", { mode: "number" }).notNull(),
  /** Баланс после операции — для быстрой сверки журнала без пересчёта. */
  balance_after_tiyin: bigint("balance_after_tiyin", { mode: "number" }).notNull(),
  session_id:          integer("session_id"),
  payment_txn_id:      integer("payment_txn_id"),
  /** Обязателен для ручных корректировок — кто и почему. */
  comment:             text("comment"),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Идемпотентность зачисления/возврата на уровне БД: одна платёжная
  // транзакция даёт максимум одну строку каждого типа (topup / refund).
  // Код и так защищён локом кошелька, но этот индекс делает двойное
  // зачисление физически невозможным даже при будущих изменениях логики.
  uniqueIndex("uq_wallet_txn_payment_type")
    .on(t.payment_txn_id, t.type)
    .where(sql`${t.payment_txn_id} is not null`),
]);

// ── Холды (замороженные средства под активную сессию) ───────────────────
export const walletHoldStatusEnum = pgEnum("wallet_hold_status", [
  "active",    // средства заморожены, сессия идёт
  "captured",  // сессия завершена, деньги списаны по факту
  "released",  // холд снят (отмена или таймаут), деньги возвращены в доступный баланс
]);

export const walletHoldsTable = pgTable("wallet_holds", {
  id:           serial("id").primaryKey(),
  user_id:      text("user_id").notNull(),
  amount_tiyin: bigint("amount_tiyin", { mode: "number" }).notNull(),
  session_id:   integer("session_id"),
  status:       walletHoldStatusEnum("status").notNull().default("active"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Таймаут: холд без capture протухает и снимается автоматически. */
  expires_at:   timestamp("expires_at", { withTimezone: true }).notNull(),
  resolved_at:  timestamp("resolved_at", { withTimezone: true }),
});

// ── Транзакции провайдеров (Payme / Click) ──────────────────────────────
export const paymentProviderEnum = pgEnum("payment_provider", ["payme", "click"]);
export const paymentTxnStateEnum = pgEnum("payment_txn_state", [
  "created",     // создана у нас, ждём провайдера
  "performed",   // проведена, деньги зачислены в кошелёк
  "cancelled",   // отменена
]);

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id:              serial("id").primaryKey(),
  provider:        paymentProviderEnum("provider").notNull(),
  /** Идентификатор транзакции на стороне провайдера (Payme _id / Click). */
  provider_txn_id: text("provider_txn_id"),
  user_id:         text("user_id").notNull(),
  amount_tiyin:    bigint("amount_tiyin", { mode: "number" }).notNull(),
  state:           paymentTxnStateEnum("state").notNull().default("created"),
  /** Числовой стейт Payme: 1 создана, 2 проведена, −1/−2 отменена. */
  provider_state:  integer("provider_state").notNull().default(1),
  /** Причина отмены по номенклатуре Payme (для CancelTransaction). */
  cancel_reason:   integer("cancel_reason"),
  // Времена в миллисекундах эпохи — в этом формате их ждёт Payme в ответах.
  create_time:     bigint("create_time",  { mode: "number" }),
  perform_time:    bigint("perform_time", { mode: "number" }),
  cancel_time:     bigint("cancel_time",  { mode: "number" }),
  /** Ссылка на строку журнала, созданную при зачислении. */
  wallet_txn_id:   integer("wallet_txn_id"),
  /** Полное тело запроса провайдера — для разбора спорных операций и сверки. */
  raw_payload:     json("raw_payload"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Один _id провайдера = одна транзакция. Защищает CreateTransaction от гонки:
  // без индекса два одновременных вызова с одним Payme _id прошли бы SELECT и
  // создали два дубля. Частичный — старые записи без provider_txn_id не мешают.
  uniqueIndex("uq_payment_txn_provider_id")
    .on(t.provider, t.provider_txn_id)
    .where(sql`${t.provider_txn_id} is not null`),
]);

// ── Zod / типы ──────────────────────────────────────────────────────────
export const insertWalletSchema = createInsertSchema(walletsTable);
export type Wallet = typeof walletsTable.$inferSelect;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type WalletHold = typeof walletHoldsTable.$inferSelect;
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({ id: true, created_at: true });
export const insertWalletHoldSchema = createInsertSchema(walletHoldsTable).omit({ id: true, created_at: true });
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactionsTable).omit({ id: true, created_at: true, updated_at: true });

// Служебное: перевод сум ↔ тийин на границе.
export const SUM = 100;
export const sumToTiyin = (sum: number): number => Math.round(sum * SUM);
export const tiyinToSum = (tiyin: number): number => tiyin / SUM;
