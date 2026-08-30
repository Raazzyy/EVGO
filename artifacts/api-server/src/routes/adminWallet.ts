import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db, walletTransactionsTable, walletHoldsTable, usersTable, tiyinToSum, sumToTiyin,
} from "@workspace/db";
import { adminAuth } from "./admin";
import { getWalletSummary, adminAdjust } from "../lib/wallet";

/**
 * Кошелёк пользователя в админке (задача 48).
 *   GET  /admin/wallet/:userId          — баланс, холды, журнал
 *   POST /admin/wallet/:userId/adjust   — ручная корректировка (комментарий обязателен)
 */
const router: IRouter = Router();

router.get("/admin/wallet/:userId", adminAuth, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);

  const [user] = await db
    .select({ id: usersTable.id, phone: usersTable.phone, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const summary = await getWalletSummary(userId);

  const txns = await db.select().from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.user_id, userId))
    .orderBy(desc(walletTransactionsTable.created_at)).limit(200);

  const holds = await db.select().from(walletHoldsTable)
    .where(eq(walletHoldsTable.user_id, userId))
    .orderBy(desc(walletHoldsTable.created_at)).limit(50);

  res.json({
    user,
    balance:   tiyinToSum(summary.balance_tiyin),
    held:      tiyinToSum(summary.held_tiyin),
    available: tiyinToSum(summary.available_tiyin),
    transactions: txns.map((t) => ({
      id: t.id, type: t.type,
      amount: tiyinToSum(t.amount_tiyin),
      balance_after: tiyinToSum(t.balance_after_tiyin),
      session_id: t.session_id, comment: t.comment, created_at: t.created_at,
    })),
    holds: holds.map((h) => ({
      id: h.id, amount: tiyinToSum(h.amount_tiyin), status: h.status,
      session_id: h.session_id, created_at: h.created_at, expires_at: h.expires_at,
    })),
  });
});

// POST /admin/wallet/:userId/adjust  { amount, comment }  — amount в сумах, знаковый.
router.post("/admin/wallet/:userId/adjust", adminAuth, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const amountSum = Number(req.body?.amount);
  const comment = String(req.body?.comment ?? "").trim();

  if (!Number.isFinite(amountSum) || amountSum === 0) {
    res.status(400).json({ error: "Сумма корректировки — число и не 0" });
    return;
  }
  if (!comment) {
    res.status(400).json({ error: "Комментарий обязателен" });
    return;
  }
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const signed = `${req.adminEmail}: ${comment}`;
  const { balance_tiyin } = await adminAdjust(userId, sumToTiyin(amountSum), signed);
  res.json({ balance: tiyinToSum(balance_tiyin) });
});

export default router;
