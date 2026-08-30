import { logger } from "../lib/logger";
import { expireStaleHolds, cancelStalePayments, reconcileWallets } from "../lib/wallet";

/**
 * Фоновое обслуживание кошелька.
 *
 *   - каждые 5 минут — снимаем протухшие холды (TTL 15 мин), чтобы
 *     замороженные под брошенную сессию деньги не висели вечно;
 *   - каждый час — автоотмена «созданных», но не оплаченных транзакций старше
 *     12 часов (окно Payme);
 *   - раз в сутки — сверка кэша баланса с журналом; расхождение = сигнал
 *     тревоги в лог (позже сюда же можно повесить Telegram-алерт).
 *
 * Таймеры простые (`setInterval`) — этого достаточно для одного инстанса на
 * Replit. Если появится несколько инстансов, сверку и автоотмену надо будет
 * защитить advisory-локом, чтобы не гоняться друг с другом.
 */

const MIN = 60_000;

let holdsTimer:      ReturnType<typeof setInterval> | null = null;
let paymentsTimer:   ReturnType<typeof setInterval> | null = null;
let reconcileTimer:  ReturnType<typeof setInterval> | null = null;

async function sweepHolds(): Promise<void> {
  try {
    const n = await expireStaleHolds();
    if (n > 0) logger.info({ released: n }, "wallet: сняты протухшие холды");
  } catch (e) { logger.warn({ err: e }, "wallet: снятие холдов не удалось"); }
}

async function sweepPayments(): Promise<void> {
  try {
    const n = await cancelStalePayments();
    if (n > 0) logger.info({ cancelled: n }, "wallet: отменены протухшие платежи");
  } catch (e) { logger.warn({ err: e }, "wallet: автоотмена платежей не удалась"); }
}

async function runReconcile(): Promise<void> {
  try {
    const mismatches = await reconcileWallets();
    if (mismatches.length > 0) {
      logger.error({ mismatches }, "wallet: РАСХОЖДЕНИЕ баланса с журналом");
    } else {
      logger.info("wallet: сверка баланса с журналом — расхождений нет");
    }
  } catch (e) { logger.warn({ err: e }, "wallet: сверка не удалась"); }
}

export function startWalletMaintenance(): void {
  // Прогон сразу на старте — чтобы не ждать первого интервала.
  void sweepHolds();
  void sweepPayments();
  void runReconcile();

  holdsTimer     = setInterval(() => void sweepHolds(),    5 * MIN);
  paymentsTimer  = setInterval(() => void sweepPayments(), 60 * MIN);
  reconcileTimer = setInterval(() => void runReconcile(),  24 * 60 * MIN);

  // Не держим процесс живым только ради таймеров (важно для тестов/graceful shutdown).
  holdsTimer.unref?.();
  paymentsTimer.unref?.();
  reconcileTimer.unref?.();

  logger.info("wallet: фоновое обслуживание запущено");
}
