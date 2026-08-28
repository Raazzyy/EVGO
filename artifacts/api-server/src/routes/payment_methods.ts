import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, paymentMethodsTable } from "@workspace/db";
import {
  AddPaymentMethodBody,
  DeletePaymentMethodParams,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

// `user_id` пока приходит от клиента и на веру. Это временно: после появления
// аутентификации (задача 20 — middleware requireAuth) во всех обработчиках
// ниже он заменяется на `req.userId` из токена, и параметр из запроса уходит.
const UserScope = z.object({ user_id: z.string().min(1) });

// ── GET /api/payment-methods?user_id= ────────────────────────────────────────
router.get("/payment-methods", async (req, res): Promise<void> => {
  // Без фильтра этот обработчик отдавал платёжные методы всех пользователей.
  const scope = UserScope.safeParse(req.query);
  if (!scope.success) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }

  const rows = await db
    .select()
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.user_id, scope.data.user_id));

  res.json(rows);
});

// ── POST /api/payment-methods ────────────────────────────────────────────────
router.post("/payment-methods", async (req, res): Promise<void> => {
  const parsed = AddPaymentMethodBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Раньше при отсутствии user_id запись уезжала в общую корзину "default_user",
  // где её видели все. Теперь владелец обязателен.
  if (!parsed.data.user_id) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }

  const [pm] = await db.insert(paymentMethodsTable).values({
    user_id: parsed.data.user_id,
    type: parsed.data.type,
    last_four: parsed.data.last_four,
    is_default: parsed.data.is_default ?? false,
  }).returning();

  res.status(201).json(pm);
});

// ── DELETE /api/payment-methods/:id?user_id= ─────────────────────────────────
router.delete("/payment-methods/:id", async (req, res): Promise<void> => {
  const p = DeletePaymentMethodParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }

  const scope = UserScope.safeParse(req.query);
  if (!scope.success) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }

  // Удаляем только свою карту — иначе по одному id сносится чужая.
  const deleted = await db
    .delete(paymentMethodsTable)
    .where(and(
      eq(paymentMethodsTable.id, p.data.id),
      eq(paymentMethodsTable.user_id, scope.data.user_id),
    ))
    .returning({ id: paymentMethodsTable.id });

  if (deleted.length === 0) { res.status(404).json({ error: "Payment method not found" }); return; }
  res.sendStatus(204);
});

export default router;
