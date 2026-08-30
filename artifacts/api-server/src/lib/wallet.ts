import { db } from "@workspace/db";
import {
  walletsTable, walletTransactionsTable, walletHoldsTable,
} from "@workspace/db";
import { eq, and, sql, lt } from "drizzle-orm";

/**
 * Денежное ядро кошелька.
 *
 * Все суммы — целые тийины (1 сум = 100 тийин). Ни одной операции над деньгами
 * без блокировки строки кошелька `FOR UPDATE`: две параллельные попытки списать
 * с одного баланса обязаны выстроиться в очередь, иначе оба увидят старый
 * баланс и спишут дважды. Блокировка строки — единственная надёжная защита от
 * гонки; полагаться на «прочитал-проверил-записал» в приложении нельзя.
 *
 * Холд (замороженные средства под активную сессию) НЕ трогает баланс: он лишь
 * уменьшает ДОСТУПНУЮ сумму. Поэтому:
 *   доступно = баланс − сумма активных холдов
 * Прямое списание проверяется против «доступно». Списание по факту сессии
 * (capture) берёт из баланса напрямую — там деньги и лежали всё это время.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class InsufficientFundsError extends Error {
  readonly balance_tiyin: number;
  readonly required_tiyin: number;
  constructor(balance: number, required: number) {
    super(`Недостаточно средств: доступно ${balance} тийин, нужно ${required}`);
    this.name = "InsufficientFundsError";
    this.balance_tiyin = balance;
    this.required_tiyin = required;
  }
}

/** Гарантирует существование строки кошелька и возвращает её (с блокировкой). */
async function lockWallet(tx: Tx, userId: string): Promise<{ balance: number }> {
  const [row] = await tx
    .select({ balance: walletsTable.balance_tiyin })
    .from(walletsTable)
    .where(eq(walletsTable.user_id, userId))
    .limit(1)
    .for("update");
  if (row) return row;
  // Создаём и берём заново под блокировкой — onConflictDoNothing на случай
  // гонки двух первых операций одного пользователя.
  await tx.insert(walletsTable).values({ user_id: userId, balance_tiyin: 0 }).onConflictDoNothing();
  const [created] = await tx
    .select({ balance: walletsTable.balance_tiyin })
    .from(walletsTable)
    .where(eq(walletsTable.user_id, userId))
    .limit(1)
    .for("update");
  return created ?? { balance: 0 };
}

/** Сумма активных (незакрытых) холдов пользователя внутри транзакции. */
async function activeHoldsSum(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx
    .select({ sum: sql<number>`coalesce(sum(${walletHoldsTable.amount_tiyin}), 0)::bigint` })
    .from(walletHoldsTable)
    .where(and(eq(walletHoldsTable.user_id, userId), eq(walletHoldsTable.status, "active")));
  return Number(row?.sum ?? 0);
}

export interface WalletSummary {
  balance_tiyin: number;
  held_tiyin: number;
  available_tiyin: number;
}

/** Баланс, замороженное и доступное — для экрана кошелька. */
export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const [wallet] = await db
    .select({ balance: walletsTable.balance_tiyin })
    .from(walletsTable)
    .where(eq(walletsTable.user_id, userId))
    .limit(1);
  const balance = wallet?.balance ?? 0;
  const [held] = await db
    .select({ sum: sql<number>`coalesce(sum(${walletHoldsTable.amount_tiyin}), 0)::bigint` })
    .from(walletHoldsTable)
    .where(and(eq(walletHoldsTable.user_id, userId), eq(walletHoldsTable.status, "active")));
  const heldTiyin = Number(held?.sum ?? 0);
  return { balance_tiyin: balance, held_tiyin: heldTiyin, available_tiyin: balance - heldTiyin };
}

interface CreditMeta {
  type: "topup" | "refund" | "adjustment";
  sessionId?: number | null;
  paymentTxnId?: number | null;
  comment?: string | null;
}

/**
 * Зачисление. Кладёт деньги на баланс и пишет строку журнала.
 *
 * `idempotencyPaymentTxnId`: если для этой платёжной транзакции запись журнала
 * уже есть — повторно НЕ зачисляем (Payme дёргает PerformTransaction по многу
 * раз, каждый должен вернуть один и тот же результат, но зачислить единожды).
 */
export async function credit(
  userId: string,
  amountTiyin: number,
  meta: CreditMeta,
): Promise<{ balance_tiyin: number; alreadyCredited: boolean }> {
  if (!Number.isInteger(amountTiyin) || amountTiyin <= 0) {
    throw new Error(`credit: сумма должна быть целой и > 0, получено ${amountTiyin}`);
  }
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId);

    // Идемпотентность по платёжной транзакции.
    if (meta.paymentTxnId != null) {
      const [dup] = await tx
        .select({ id: walletTransactionsTable.id })
        .from(walletTransactionsTable)
        .where(and(
          eq(walletTransactionsTable.payment_txn_id, meta.paymentTxnId),
          eq(walletTransactionsTable.type, "topup"),
        ))
        .limit(1);
      if (dup) return { balance_tiyin: wallet.balance, alreadyCredited: true };
    }

    const newBalance = wallet.balance + amountTiyin;
    await tx.update(walletsTable)
      .set({ balance_tiyin: newBalance, updated_at: new Date() })
      .where(eq(walletsTable.user_id, userId));

    await tx.insert(walletTransactionsTable).values({
      user_id: userId,
      type: meta.type,
      amount_tiyin: amountTiyin,
      balance_after_tiyin: newBalance,
      session_id: meta.sessionId ?? null,
      payment_txn_id: meta.paymentTxnId ?? null,
      comment: meta.comment ?? null,
    });

    return { balance_tiyin: newBalance, alreadyCredited: false };
  });
}

/**
 * Разворот зачисления при отмене платежа провайдером ПОСЛЕ проведения.
 *
 * Снимает ровно зачисленную сумму, даже если баланса уже не хватает (деньги
 * могли быть потрачены) — уход в минус допустим: провайдер авторитетно
 * возвращает средства на карту, а недостачу закрывает отдельная сверка.
 * Идемпотентно по платёжной транзакции: повторная отмена — no-op.
 */
export async function reverseCredit(
  userId: string,
  amountTiyin: number,
  paymentTxnId: number,
): Promise<{ balance_tiyin: number; alreadyReversed: boolean }> {
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId);
    const [dup] = await tx
      .select({ id: walletTransactionsTable.id })
      .from(walletTransactionsTable)
      .where(and(
        eq(walletTransactionsTable.payment_txn_id, paymentTxnId),
        eq(walletTransactionsTable.type, "refund"),
      ))
      .limit(1);
    if (dup) return { balance_tiyin: wallet.balance, alreadyReversed: true };

    const newBalance = wallet.balance - amountTiyin;
    await tx.update(walletsTable)
      .set({ balance_tiyin: newBalance, updated_at: new Date() })
      .where(eq(walletsTable.user_id, userId));
    await tx.insert(walletTransactionsTable).values({
      user_id: userId,
      type: "refund",
      amount_tiyin: -amountTiyin,
      balance_after_tiyin: newBalance,
      payment_txn_id: paymentTxnId,
      comment: "Отмена пополнения провайдером",
    });
    return { balance_tiyin: newBalance, alreadyReversed: false };
  });
}

interface DebitMeta {
  type: "charge" | "adjustment";
  sessionId?: number | null;
  comment?: string | null;
}

/**
 * Прямое списание с проверкой ДОСТУПНОГО баланса (за вычетом активных холдов).
 * Бросает InsufficientFundsError, если доступного не хватает.
 */
export async function debit(
  userId: string,
  amountTiyin: number,
  meta: DebitMeta,
): Promise<{ balance_tiyin: number }> {
  if (!Number.isInteger(amountTiyin) || amountTiyin <= 0) {
    throw new Error(`debit: сумма должна быть целой и > 0, получено ${amountTiyin}`);
  }
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId);
    const held = await activeHoldsSum(tx, userId);
    const available = wallet.balance - held;
    if (available < amountTiyin) {
      throw new InsufficientFundsError(available, amountTiyin);
    }
    const newBalance = wallet.balance - amountTiyin;
    await tx.update(walletsTable)
      .set({ balance_tiyin: newBalance, updated_at: new Date() })
      .where(eq(walletsTable.user_id, userId));
    await tx.insert(walletTransactionsTable).values({
      user_id: userId,
      type: meta.type,
      amount_tiyin: -amountTiyin,
      balance_after_tiyin: newBalance,
      session_id: meta.sessionId ?? null,
      comment: meta.comment ?? null,
    });
    return { balance_tiyin: newBalance };
  });
}

const HOLD_TTL_MS = 15 * 60 * 1000; // 15 минут

/**
 * Заморозить средства под активную сессию. Проверяет доступное (баланс минус
 * уже активные холды). Возвращает id холда.
 */
export async function createHold(
  userId: string,
  amountTiyin: number,
  sessionId: number | null,
): Promise<{ holdId: number; available_tiyin: number }> {
  if (!Number.isInteger(amountTiyin) || amountTiyin <= 0) {
    throw new Error(`createHold: сумма должна быть целой и > 0, получено ${amountTiyin}`);
  }
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId);
    const held = await activeHoldsSum(tx, userId);
    const available = wallet.balance - held;
    if (available < amountTiyin) {
      throw new InsufficientFundsError(available, amountTiyin);
    }
    const [hold] = await tx.insert(walletHoldsTable).values({
      user_id: userId,
      amount_tiyin: amountTiyin,
      session_id: sessionId,
      status: "active",
      expires_at: new Date(Date.now() + HOLD_TTL_MS),
    }).returning({ id: walletHoldsTable.id });
    return { holdId: hold!.id, available_tiyin: available - amountTiyin };
  });
}

/**
 * Списать по факту завершения сессии. Реальная сумма не может превышать
 * замороженную. Остаток холда освобождается автоматически (холд перестаёт быть
 * активным). Идемпотентно: повторный capture уже закрытого холда — no-op.
 */
export async function captureHold(
  holdId: number,
  actualAmountTiyin: number,
): Promise<{ captured_tiyin: number; balance_tiyin: number }> {
  if (!Number.isInteger(actualAmountTiyin) || actualAmountTiyin < 0) {
    throw new Error(`captureHold: сумма должна быть целой и >= 0, получено ${actualAmountTiyin}`);
  }
  return db.transaction(async (tx) => {
    const [hold] = await tx
      .select()
      .from(walletHoldsTable)
      .where(eq(walletHoldsTable.id, holdId))
      .limit(1)
      .for("update");
    if (!hold) throw new Error(`captureHold: холд ${holdId} не найден`);
    if (hold.status !== "active") {
      // Уже закрыт — возвращаем текущий баланс без изменений.
      const [w] = await tx.select({ balance: walletsTable.balance_tiyin })
        .from(walletsTable).where(eq(walletsTable.user_id, hold.user_id)).limit(1);
      return { captured_tiyin: 0, balance_tiyin: w?.balance ?? 0 };
    }

    // Реальная сумма ограничена замороженной — списать больше, чем заморозили,
    // нельзя (иначе холд не гарантировал бы платёжеспособность).
    const capture = Math.min(actualAmountTiyin, hold.amount_tiyin);
    const wallet = await lockWallet(tx, hold.user_id);
    const newBalance = wallet.balance - capture;

    await tx.update(walletsTable)
      .set({ balance_tiyin: newBalance, updated_at: new Date() })
      .where(eq(walletsTable.user_id, hold.user_id));

    await tx.update(walletHoldsTable)
      .set({ status: "captured", resolved_at: new Date() })
      .where(eq(walletHoldsTable.id, holdId));

    if (capture > 0) {
      await tx.insert(walletTransactionsTable).values({
        user_id: hold.user_id,
        type: "charge",
        amount_tiyin: -capture,
        balance_after_tiyin: newBalance,
        session_id: hold.session_id,
        comment: `Списание по сессии (холд #${holdId})`,
      });
    }
    return { captured_tiyin: capture, balance_tiyin: newBalance };
  });
}

/** Снять холд без списания (отмена сессии). Идемпотентно. */
export async function releaseHold(holdId: number): Promise<void> {
  await db.update(walletHoldsTable)
    .set({ status: "released", resolved_at: new Date() })
    .where(and(eq(walletHoldsTable.id, holdId), eq(walletHoldsTable.status, "active")));
}

/**
 * Освободить протухшие холды (без capture дольше TTL). Возвращает число снятых.
 * Вызывается по расписанию.
 */
export async function expireStaleHolds(): Promise<number> {
  const rows = await db.update(walletHoldsTable)
    .set({ status: "released", resolved_at: new Date() })
    .where(and(eq(walletHoldsTable.status, "active"), lt(walletHoldsTable.expires_at, new Date())))
    .returning({ id: walletHoldsTable.id });
  return rows.length;
}
