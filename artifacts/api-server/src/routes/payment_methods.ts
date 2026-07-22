import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, paymentMethodsTable } from "@workspace/db";
import {
  AddPaymentMethodBody,
  DeletePaymentMethodParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/payment-methods", async (_req, res): Promise<void> => {
  const rows = await db.select().from(paymentMethodsTable);
  res.json(rows);
});

router.post("/payment-methods", async (req, res): Promise<void> => {
  const parsed = AddPaymentMethodBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [pm] = await db.insert(paymentMethodsTable).values({
    user_id: parsed.data.user_id ?? "default_user",
    type: parsed.data.type,
    last_four: parsed.data.last_four,
    is_default: parsed.data.is_default ?? false,
  }).returning();
  res.status(201).json(pm);
});

router.delete("/payment-methods/:id", async (req, res): Promise<void> => {
  const p = DeletePaymentMethodParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
