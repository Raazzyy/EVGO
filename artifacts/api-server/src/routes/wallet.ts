import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db, walletTransactionsTable, paymentTransactionsTable, tiyinToSum, sumToTiyin,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { getWalletSummary } from "../lib/wallet";
import { isPaymeTestMode } from "../lib/paymeMode";

const router: IRouter = Router();

// Пополнять можно от 1 000 до 5 000 000 сумов за раз — нижняя граница отсекает
// «копеечные» тесты, верхняя ограничивает риск ошибки на порядок.
const MIN_TOPUP_SUM = 1_000;
const MAX_TOPUP_SUM = 5_000_000;

// GET /wallet — баланс, замороженное, доступное (в сумах для отображения).
router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const s = await getWalletSummary(req.userId as string);
  res.json({
    balance:   tiyinToSum(s.balance_tiyin),
    held:      tiyinToSum(s.held_tiyin),
    available: tiyinToSum(s.available_tiyin),
    // Тийины тоже отдаём — чтобы клиент при желании считал без потери точности.
    balance_tiyin:   s.balance_tiyin,
    held_tiyin:      s.held_tiyin,
    available_tiyin: s.available_tiyin,
  });
});

// GET /wallet/transactions — история операций.
router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.user_id, req.userId as string))
    .orderBy(desc(walletTransactionsTable.created_at))
    .limit(limit);

  res.json(rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: tiyinToSum(r.amount_tiyin),
    balance_after: tiyinToSum(r.balance_after_tiyin),
    session_id: r.session_id,
    comment: r.comment,
    created_at: r.created_at,
  })));
});

// POST /wallet/topup { amount }  — amount в сумах.
// Создаёт платёжную транзакцию и возвращает ссылку на оплату Payme.
router.post("/wallet/topup", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId as string;
  const amountSum = Number(req.body?.amount);

  if (!Number.isFinite(amountSum) || amountSum < MIN_TOPUP_SUM || amountSum > MAX_TOPUP_SUM) {
    res.status(400).json({
      error: `Сумма пополнения — от ${MIN_TOPUP_SUM} до ${MAX_TOPUP_SUM} сумов`,
      code: "amount_out_of_range",
    });
    return;
  }
  const amountTiyin = sumToTiyin(amountSum);

  const merchantId = process.env.PAYME_MERCHANT_ID ?? "";
  if (!merchantId) {
    // Договор с Payme ещё не заключён — касса не настроена. Отдаём понятный
    // код, чтобы клиент показал «оплата временно недоступна», а не пустую ссылку.
    res.status(503).json({
      error: "Оплата временно недоступна: касса не настроена",
      code: "payme_not_configured",
    });
    return;
  }

  // Регистрируем намерение оплаты. Позже Payme свяжется по webhook и переведёт
  // транзакцию в performed, тогда и зачислим на баланс.
  const [pt] = await db.insert(paymentTransactionsTable).values({
    provider: "payme",
    user_id: userId,
    amount_tiyin: amountTiyin,
    state: "created",
  }).returning({ id: paymentTransactionsTable.id });

  // Ссылка на оплату: base64(m=<касса>;ac.user_id=<id>;a=<тийины>).
  // Счёт привязан к user_id — вебхук по нему находит, чей кошелёк пополнять.
  const host = isPaymeTestMode() ? "https://checkout.test.paycom.uz" : "https://checkout.paycom.uz";
  const params = `m=${merchantId};ac.user_id=${userId};a=${amountTiyin}`;
  const checkoutUrl = `${host}/${Buffer.from(params).toString("base64")}`;

  res.json({
    payment_txn_id: pt!.id,
    checkout_url: checkoutUrl,
    amount: amountSum,
  });
});

export default router;
