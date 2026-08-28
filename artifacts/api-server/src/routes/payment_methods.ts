import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, paymentMethodsTable } from "@workspace/db";
import {
  AddPaymentMethodBody,
  DeletePaymentMethodParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Владелец во всех обработчиках берётся из токена.

// ── GET /api/payment-methods ─────────────────────────────────────────────────
router.get("/payment-methods", requireAuth, async (req, res): Promise<void> => {
  // Без фильтра этот обработчик отдавал платёжные методы всех пользователей.
  const rows = await db
    .select()
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.user_id, req.userId as string));

  res.json(rows);
});

// ── POST /api/payment-methods ────────────────────────────────────────────────
router.post("/payment-methods", requireAuth, async (req, res): Promise<void> => {
  const parsed = AddPaymentMethodBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [pm] = await db.insert(paymentMethodsTable).values({
    // Раньше при отсутствии user_id запись уезжала в общую корзину
    // "default_user", где её видели все.
    user_id: req.userId as string,
    type: parsed.data.type,
    last_four: parsed.data.last_four,
    is_default: parsed.data.is_default ?? false,
  }).returning();

  res.status(201).json(pm);
});

// ── DELETE /api/payment-methods/:id?user_id= ─────────────────────────────────
router.delete("/payment-methods/:id", requireAuth, async (req, res): Promise<void> => {
  const p = DeletePaymentMethodParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }

  // Удаляем только свою карту — иначе по одному id сносится чужая.
  const deleted = await db
    .delete(paymentMethodsTable)
    .where(and(
      eq(paymentMethodsTable.id, p.data.id),
      eq(paymentMethodsTable.user_id, req.userId as string),
    ))
    .returning({ id: paymentMethodsTable.id });

  if (deleted.length === 0) { res.status(404).json({ error: "Payment method not found" }); return; }
  res.sendStatus(204);
});

export default router;
