/**
 * Тесты денежной логики кошелька (задача 44).
 *
 * Интеграционные: работают против реальной Postgres (та же, что у приложения),
 * потому что вся суть — в блокировке строки `FOR UPDATE` и идемпотентности на
 * уровне БД, а их на моках не проверить.
 *
 * Запуск:
 *   DATABASE_URL=postgres://postgres:ПАРОЛЬ@localhost:5432/evgo \
 *     npx tsx --test src/lib/wallet.test.ts
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, pool, walletsTable, walletTransactionsTable, walletHoldsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  credit, debit, createHold, captureHold, releaseHold, expireStaleHolds,
  reverseCredit, getWalletSummary, InsufficientFundsError,
} from "./wallet";

// Отдельный пользователь на прогон — чтобы тесты не мешали данным приложения.
const USER = `test-wallet-${Date.now()}`;
const SUM = 100; // тийин в суме

async function cleanup(userId: string) {
  await db.delete(walletHoldsTable).where(eq(walletHoldsTable.user_id, userId));
  await db.delete(walletTransactionsTable).where(eq(walletTransactionsTable.user_id, userId));
  await db.delete(walletsTable).where(eq(walletsTable.user_id, userId));
}

before(async () => { await cleanup(USER); });
after(async () => { await cleanup(USER); await pool.end(); });
beforeEach(async () => { await cleanup(USER); });

test("credit пополняет баланс и пишет журнал", async () => {
  const r = await credit(USER, 50_000 * SUM, { type: "topup" });
  assert.equal(r.balance_tiyin, 50_000 * SUM);
  const s = await getWalletSummary(USER);
  assert.equal(s.balance_tiyin, 50_000 * SUM);
  assert.equal(s.available_tiyin, 50_000 * SUM);
});

test("двойное зачисление одной платёжной транзакции засчитывается один раз", async () => {
  const paymentTxnId = 777001;
  const first = await credit(USER, 30_000 * SUM, { type: "topup", paymentTxnId });
  const second = await credit(USER, 30_000 * SUM, { type: "topup", paymentTxnId });
  assert.equal(first.alreadyCredited, false);
  assert.equal(second.alreadyCredited, true);
  const s = await getWalletSummary(USER);
  // Зачислено ровно один раз, несмотря на два вызова (как повторный PerformTransaction).
  assert.equal(s.balance_tiyin, 30_000 * SUM);
});

test("debit списывает и падает при нехватке средств", async () => {
  await credit(USER, 10_000 * SUM, { type: "topup" });
  await debit(USER, 4_000 * SUM, { type: "charge" });
  const s = await getWalletSummary(USER);
  assert.equal(s.balance_tiyin, 6_000 * SUM);

  await assert.rejects(
    () => debit(USER, 999_000 * SUM, { type: "charge" }),
    (e: unknown) => e instanceof InsufficientFundsError,
  );
});

test("гонка двух списаний: проходит только одно, когда денег хватает на одно", async () => {
  await credit(USER, 100 * SUM, { type: "topup" });
  // Два параллельных списания по 80 сумов — денег хватает ровно на одно.
  const results = await Promise.allSettled([
    debit(USER, 80 * SUM, { type: "charge" }),
    debit(USER, 80 * SUM, { type: "charge" }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  assert.equal(ok, 1, "ровно одно списание должно пройти");
  assert.equal(failed, 1, "второе должно упасть по нехватке средств");
  const s = await getWalletSummary(USER);
  assert.equal(s.balance_tiyin, 20 * SUM, "баланс не должен уйти в минус от гонки");
});

test("холд замораживает средства: доступное уменьшается, прямое списание сверх — падает", async () => {
  await credit(USER, 1_000 * SUM, { type: "topup" });
  const { holdId } = await createHold(USER, 700 * SUM, 42);
  const s = await getWalletSummary(USER);
  assert.equal(s.balance_tiyin, 1_000 * SUM);
  assert.equal(s.held_tiyin, 700 * SUM);
  assert.equal(s.available_tiyin, 300 * SUM);

  // Прямое списание 400 сумов не пройдёт — доступно только 300.
  await assert.rejects(
    () => debit(USER, 400 * SUM, { type: "charge" }),
    (e: unknown) => e instanceof InsufficientFundsError,
  );
  assert.ok(holdId > 0);
});

test("captureHold списывает по факту, остаток холда освобождается", async () => {
  await credit(USER, 1_000 * SUM, { type: "topup" });
  const { holdId } = await createHold(USER, 700 * SUM, 42);
  // По факту потрачено меньше замороженного.
  const cap = await captureHold(holdId, 450 * SUM);
  assert.equal(cap.captured_tiyin, 450 * SUM);
  const s = await getWalletSummary(USER);
  assert.equal(s.balance_tiyin, 550 * SUM);   // 1000 − 450
  assert.equal(s.held_tiyin, 0);              // холд закрыт
  assert.equal(s.available_tiyin, 550 * SUM); // остаток разморожен
});

test("captureHold не списывает больше замороженного", async () => {
  await credit(USER, 1_000 * SUM, { type: "topup" });
  const { holdId } = await createHold(USER, 300 * SUM, 42);
  const cap = await captureHold(holdId, 999 * SUM); // просят больше холда
  assert.equal(cap.captured_tiyin, 300 * SUM, "списываем не больше замороженного");
});

test("повторный captureHold — no-op (идемпотентность)", async () => {
  await credit(USER, 1_000 * SUM, { type: "topup" });
  const { holdId } = await createHold(USER, 300 * SUM, 42);
  await captureHold(holdId, 300 * SUM);
  const second = await captureHold(holdId, 300 * SUM);
  assert.equal(second.captured_tiyin, 0, "второй capture ничего не списывает");
  const s = await getWalletSummary(USER);
  assert.equal(s.balance_tiyin, 700 * SUM);
});

test("releaseHold возвращает средства в доступные", async () => {
  await credit(USER, 1_000 * SUM, { type: "topup" });
  const { holdId } = await createHold(USER, 700 * SUM, 42);
  await releaseHold(holdId);
  const s = await getWalletSummary(USER);
  assert.equal(s.held_tiyin, 0);
  assert.equal(s.available_tiyin, 1_000 * SUM);
});

test("expireStaleHolds снимает протухшие холды", async () => {
  await credit(USER, 1_000 * SUM, { type: "topup" });
  const { holdId } = await createHold(USER, 700 * SUM, 42);
  // Двигаем срок в прошлое, имитируя протухание.
  await db.update(walletHoldsTable)
    .set({ expires_at: new Date(Date.now() - 60_000) })
    .where(eq(walletHoldsTable.id, holdId));
  const released = await expireStaleHolds();
  assert.ok(released >= 1);
  const s = await getWalletSummary(USER);
  assert.equal(s.held_tiyin, 0, "протухший холд больше не морозит средства");
});

test("отмена после проведения: reverseCredit возвращает деньги на карту (идемпотентно)", async () => {
  const paymentTxnId = 777002;
  await credit(USER, 50_000 * SUM, { type: "topup", paymentTxnId });
  const r1 = await reverseCredit(USER, 50_000 * SUM, paymentTxnId);
  assert.equal(r1.alreadyReversed, false);
  assert.equal(r1.balance_tiyin, 0);
  // Повтор отмены — no-op.
  const r2 = await reverseCredit(USER, 50_000 * SUM, paymentTxnId);
  assert.equal(r2.alreadyReversed, true);
  const s = await getWalletSummary(USER);
  assert.equal(s.balance_tiyin, 0);
});

test("balance_after в журнале совпадает с итоговым балансом", async () => {
  await credit(USER, 10_000 * SUM, { type: "topup" });
  await debit(USER, 3_000 * SUM, { type: "charge" });
  const [last] = await db.select().from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.user_id, USER))
    .orderBy(sql`${walletTransactionsTable.id} DESC`).limit(1);
  const s = await getWalletSummary(USER);
  assert.equal(last!.balance_after_tiyin, s.balance_tiyin);
});
