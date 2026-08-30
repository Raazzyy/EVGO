import { Router, type IRouter } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, paymentTransactionsTable, usersTable } from "@workspace/db";
import { credit, reverseCredit } from "../lib/wallet";
import { isPaymeTestMode } from "../lib/paymeMode";
import { logger } from "../lib/logger";

/**
 * Merchant API Payme для пополнения кошелька.
 *
 * Одна касса, счёт привязан к `account.user_id`. Реализованы все методы,
 * которые дёргает касса и песочница `test.paycom.uz`:
 *   CheckPerformTransaction, CreateTransaction, PerformTransaction,
 *   CancelTransaction, CheckTransaction, GetStatement, ChangePassword.
 *
 * Каркас и защита (тайминг-безопасная авторизация, идемпотентность,
 * ответ всегда 200 с JSON-RPC телом) перенесены из боевого AKGOUZ.
 *
 * ⚠️ Прохождение обеих фаз песочницы (задача 41) требует реальной кассы и
 * ключей от Payme — до договора протестировать против их песочницы нельзя.
 */

const router: IRouter = Router();

// Payme требует завершить транзакцию в течение 12 часов с создания; ещё
// «созданная» дольше этого окна — автоотмена (reason 4).
const TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

const MIN_TOPUP_TIYIN = 1_000 * 100;
const MAX_TOPUP_TIYIN = 5_000_000 * 100;

// ── Payme error codes ──────────────────────────────────────────────────────
const E_ACCOUNT   = -31050; // счёт (user_id) не найден
const E_AMOUNT    = -31001; // недопустимая сумма
const E_TXN_404   = -31003; // транзакция не найдена
const E_CANT_DO   = -31008; // невозможно выполнить операцию
const E_METHOD    = -32601; // метод не найден
const E_AUTH      = -32504; // недостаточно привилегий (авторизация)

function paymeError(id: unknown, code: number, ru: string, uz?: string, en?: string) {
  return { jsonrpc: "2.0", id, error: { code, message: { ru, uz: uz ?? ru, en: en ?? ru } } };
}

// ── Тайминг-безопасная авторизация ─────────────────────────────────────────
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Все ключи касс из окружения (никогда не хардкодим — утекут в git). */
function merchantKeys(): string[] {
  const raw = [
    process.env.PAYME_MERCHANT_KEYS,
    process.env.PAYME_KEY,
    process.env.PAYME_MERCHANT_KEY,
  ].filter(Boolean).join(",");
  return Array.from(new Set(raw.split(",").map((k) => k.trim()).filter(Boolean)));
}

function merchantIds(): string[] {
  return Array.from(new Set([process.env.PAYME_MERCHANT_ID].filter(Boolean) as string[]));
}

// Официальный диапазон адресов Payme (185.234.113.0/24). Проверка — защита в
// глубину поверх подписи. По умолчанию ВЫКЛючена: за прокси Replit `req.ip` —
// это адрес прокси, и жёсткий allowlist заблокировал бы легитимные вызовы.
// Включать `PAYME_ENFORCE_IP=true` только когда точно известен реальный ip.
function ipAllowed(req: any): boolean {
  if (String(process.env.PAYME_ENFORCE_IP ?? "").toLowerCase() !== "true") return true;
  const ip = String(req.ip ?? "").replace(/^::ffff:/, "");
  return ip.startsWith("185.234.113.");
}

function checkAuth(req: any): boolean {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) return false;
  const token = header.split(" ")[1]?.trim();
  if (!token) return false;
  const keys = merchantKeys();
  const ids = merchantIds();
  // Не замыкаемся на первом совпадении — число сравнений не зависит от того,
  // какой ключ подошёл (иначе по времени ответа утекает подсказка).
  let matched = false;
  for (const k of keys) {
    if (safeEqual(token, Buffer.from(`Paycom:${k}`).toString("base64"))) matched = true;
    for (const mId of ids) {
      if (safeEqual(token, Buffer.from(`${mId}:${k}`).toString("base64"))) matched = true;
    }
  }
  return matched;
}

// ── Разбор и валидация счёта ───────────────────────────────────────────────
async function resolveAccount(params: any): Promise<
  | { ok: true; userId: string }
  | { ok: false; code: number; ru: string }
> {
  const userId = String(params?.account?.user_id ?? "").trim();
  if (!userId) return { ok: false, code: E_ACCOUNT, ru: "Некорректный счёт: не указан user_id" };
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return { ok: false, code: E_ACCOUNT, ru: "Пользователь не найден" };
  return { ok: true, userId };
}

function validateAmount(amount: unknown): boolean {
  return Number.isInteger(amount) && (amount as number) >= MIN_TOPUP_TIYIN && (amount as number) <= MAX_TOPUP_TIYIN;
}

// ── Методы ──────────────────────────────────────────────────────────────────
async function checkPerformTransaction(params: any, id: unknown) {
  if (!validateAmount(params?.amount)) return paymeError(id, E_AMOUNT, "Недопустимая сумма пополнения");
  const acc = await resolveAccount(params);
  if (!acc.ok) return paymeError(id, acc.code, acc.ru);
  return { jsonrpc: "2.0", id, result: { allow: true } };
}

async function createTransaction(params: any, id: unknown) {
  const paymeId = String(params?.id ?? "");
  // Идемпотентность: транзакция с этим Payme id уже есть — возвращаем её.
  const [existing] = await db.select().from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.provider_txn_id, paymeId)).limit(1);
  if (existing) {
    if (existing.provider_state !== 1) {
      return paymeError(id, E_CANT_DO, "Транзакция в недопустимом состоянии");
    }
    return { jsonrpc: "2.0", id, result: {
      create_time: existing.create_time, transaction: String(existing.id), state: 1,
    } };
  }

  if (!validateAmount(params?.amount)) return paymeError(id, E_AMOUNT, "Недопустимая сумма пополнения");
  const acc = await resolveAccount(params);
  if (!acc.ok) return paymeError(id, acc.code, acc.ru);

  const now = Date.now();
  const [row] = await db.insert(paymentTransactionsTable).values({
    provider: "payme",
    provider_txn_id: paymeId,
    user_id: acc.userId,
    amount_tiyin: params.amount,
    state: "created",
    provider_state: 1,
    create_time: now,
    raw_payload: params,
  }).returning({ id: paymentTransactionsTable.id, create_time: paymentTransactionsTable.create_time });

  return { jsonrpc: "2.0", id, result: {
    create_time: row!.create_time, transaction: String(row!.id), state: 1,
  } };
}

async function findByPaymeId(paymeId: string) {
  const [row] = await db.select().from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.provider_txn_id, paymeId)).limit(1);
  return row ?? null;
}

async function performTransaction(params: any, id: unknown) {
  const txn = await findByPaymeId(String(params?.id ?? ""));
  if (!txn) return paymeError(id, E_TXN_404, "Транзакция не найдена");

  // Уже проведена — идемпотентный повтор.
  if (txn.provider_state === 2) {
    return { jsonrpc: "2.0", id, result: {
      transaction: String(txn.id), perform_time: txn.perform_time, state: 2,
    } };
  }
  if (txn.provider_state !== 1) return paymeError(id, E_CANT_DO, "Транзакцию нельзя провести");

  // Протухла? Автоотмена.
  if (txn.create_time && Date.now() - txn.create_time > TRANSACTION_TIMEOUT_MS) {
    await db.update(paymentTransactionsTable)
      .set({ state: "cancelled", provider_state: -1, cancel_reason: 4, cancel_time: Date.now(), updated_at: new Date() })
      .where(eq(paymentTransactionsTable.id, txn.id));
    return paymeError(id, E_CANT_DO, "Срок транзакции истёк");
  }

  // Зачисляем на кошелёк (идемпотентно по нашему id платёжной транзакции).
  await credit(txn.user_id, txn.amount_tiyin, { type: "topup", paymentTxnId: txn.id });

  const now = Date.now();
  await db.update(paymentTransactionsTable)
    .set({ state: "performed", provider_state: 2, perform_time: now, updated_at: new Date() })
    .where(eq(paymentTransactionsTable.id, txn.id));

  return { jsonrpc: "2.0", id, result: { transaction: String(txn.id), perform_time: now, state: 2 } };
}

async function cancelTransaction(params: any, id: unknown) {
  const txn = await findByPaymeId(String(params?.id ?? ""));
  if (!txn) return paymeError(id, E_TXN_404, "Транзакция не найдена");
  const reason = Number(params?.reason) || null;

  // Уже отменена — идемпотентный повтор.
  if (txn.provider_state === -1 || txn.provider_state === -2) {
    return { jsonrpc: "2.0", id, result: {
      transaction: String(txn.id), cancel_time: txn.cancel_time, state: txn.provider_state,
    } };
  }

  const now = Date.now();
  if (txn.provider_state === 2) {
    // Отмена после проведения — возвращаем деньги на карту, снимаем с кошелька.
    await reverseCredit(txn.user_id, txn.amount_tiyin, txn.id);
    await db.update(paymentTransactionsTable)
      .set({ state: "cancelled", provider_state: -2, cancel_reason: reason, cancel_time: now, updated_at: new Date() })
      .where(eq(paymentTransactionsTable.id, txn.id));
    return { jsonrpc: "2.0", id, result: { transaction: String(txn.id), cancel_time: now, state: -2 } };
  }

  // Отмена ещё не проведённой.
  await db.update(paymentTransactionsTable)
    .set({ state: "cancelled", provider_state: -1, cancel_reason: reason, cancel_time: now, updated_at: new Date() })
    .where(eq(paymentTransactionsTable.id, txn.id));
  return { jsonrpc: "2.0", id, result: { transaction: String(txn.id), cancel_time: now, state: -1 } };
}

async function checkTransaction(params: any, id: unknown) {
  const txn = await findByPaymeId(String(params?.id ?? ""));
  if (!txn) return paymeError(id, E_TXN_404, "Транзакция не найдена");
  return { jsonrpc: "2.0", id, result: {
    create_time:  txn.create_time ?? 0,
    perform_time: txn.perform_time ?? 0,
    cancel_time:  txn.cancel_time ?? 0,
    transaction:  String(txn.id),
    state:        txn.provider_state,
    reason:       txn.cancel_reason ?? null,
  } };
}

async function getStatement(params: any, id: unknown) {
  const from = Number(params?.from) || 0;
  const to = Number(params?.to) || Date.now();
  const rows = await db.select().from(paymentTransactionsTable)
    .where(and(
      eq(paymentTransactionsTable.provider, "payme"),
      gte(paymentTransactionsTable.create_time, from),
      lte(paymentTransactionsTable.create_time, to),
    ));
  return { jsonrpc: "2.0", id, result: {
    transactions: rows.map((t) => ({
      id: t.provider_txn_id,
      time: t.create_time,
      amount: t.amount_tiyin,
      account: { user_id: t.user_id },
      create_time: t.create_time ?? 0,
      perform_time: t.perform_time ?? 0,
      cancel_time: t.cancel_time ?? 0,
      transaction: String(t.id),
      state: t.provider_state,
      reason: t.cancel_reason ?? null,
    })),
  } };
}

// ── Единая точка входа ──────────────────────────────────────────────────────
router.post("/webhooks/payme", async (req, res): Promise<void> => {
  // Payme требует на КАЖДЫЙ вызов HTTP 200 с JSON-RPC телом — даже на ошибку
  // авторизации и разбора. Поэтому весь обработчик в одном try/catch.
  const body = req.body || {};
  const id = body.id;
  try {
    const { method, params } = body;
    if (!method) { res.status(200).json(paymeError(id, E_METHOD, "Не указан метод")); return; }

    if (!ipAllowed(req)) {
      logger.warn({ method, ip: req.ip }, "Payme webhook: ip not allowed");
      res.status(200).json(paymeError(id, E_AUTH, "Недостаточно привилегий для выполнения метода"));
      return;
    }

    if (!checkAuth(req)) {
      logger.warn({ method, configuredKeys: merchantKeys().length }, "Payme webhook: auth failed");
      res.status(200).json(paymeError(id, E_AUTH, "Недостаточно привилегий для выполнения метода"));
      return;
    }

    let out: unknown;
    switch (method) {
      case "CheckPerformTransaction": out = await checkPerformTransaction(params, id); break;
      case "CreateTransaction":       out = await createTransaction(params, id); break;
      case "PerformTransaction":      out = await performTransaction(params, id); break;
      case "CancelTransaction":       out = await cancelTransaction(params, id); break;
      case "CheckTransaction":        out = await checkTransaction(params, id); break;
      case "GetStatement":            out = await getStatement(params, id); break;
      case "ChangePassword":
        // Ключ кассы держим в окружении, а не меняем через API. Подтверждаем
        // вызов, но ничего не вращаем.
        out = { jsonrpc: "2.0", id, result: { success: true } }; break;
      default:
        out = paymeError(id, E_METHOD, "Метод не найден");
    }
    res.status(200).json(out);
  } catch (e) {
    logger.error({ err: e, method: body?.method }, "Payme webhook error");
    res.status(200).json(paymeError(id, -32400, "Системная ошибка"));
  }
});

// При старте — понятная диагностика конфигурации кассы.
{
  const testMode = isPaymeTestMode();
  const keys = merchantKeys().length;
  const mid = process.env.PAYME_MERCHANT_ID;
  logger.info(
    { testMode, configuredKeys: keys, merchantConfigured: !!mid },
    keys > 0 && mid
      ? `[payme] касса настроена (test=${testMode})`
      : "[payme] касса НЕ настроена — вебхук вернёт -32504, пополнение недоступно",
  );
}

export default router;
