import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable, pushTokensTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { adminAuth } from "./admin";

const router: IRouter = Router();

// GET /notifications — уведомления текущего пользователя
router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.user_id, req.userId as string))
    // Сортировка в запросе, а не разворотом массива в коде: при появлении
    // пагинации разворот отдавал бы неверную страницу.
    .orderBy(desc(notificationsTable.created_at));

  res.json(rows);
});

// POST /notifications — служебное создание, только для админки
router.post("/notifications", adminAuth, async (req, res): Promise<void> => {
  const { user_id, type, title, body } = req.body ?? {};
  if (!user_id || !type || !title || !body) {
    res.status(400).json({ error: "user_id, type, title, body required" });
    return;
  }
  const [n] = await db.insert(notificationsTable).values({ user_id, type, title, body }).returning();
  res.status(201).json(n);
});

// PATCH /notifications/:id/read — отметить своё уведомление прочитанным
router.patch<{ id: string }>("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  // Условие по владельцу обязательно: без него по чужому id отмечалось
  // прочитанным чужое уведомление.
  const [n] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.user_id, req.userId as string),
    ))
    .returning();

  if (!n) { res.status(404).json({ error: "Not found" }); return; }
  res.json(n);
});

// POST /notifications/broadcast — рассылка, только для админки
router.post("/notifications/broadcast", adminAuth, async (req, res): Promise<void> => {
  const { type, title, body, user_ids } = req.body ?? {};
  if (!type || !title || !body) {
    res.status(400).json({ error: "type, title, body required" });
    return;
  }

  const targets: string[] = Array.isArray(user_ids) ? user_ids : [];

  if (targets.length === 0) {
    const tokens = await db.select().from(pushTokensTable);
    targets.push(...new Set(tokens.map(t => t.user_id)));
  }

  if (targets.length === 0) {
    res.json({ sent: 0 });
    return;
  }

  const rows = targets.map(uid => ({ user_id: uid, type, title, body }));
  await db.insert(notificationsTable).values(rows);
  res.json({ sent: targets.length });
});

// POST /push-tokens — регистрация токена устройства
router.post("/push-tokens", requireAuth, async (req, res): Promise<void> => {
  const { platform, token } = req.body ?? {};
  if (!platform || !token) {
    res.status(400).json({ error: "platform and token required" });
    return;
  }

  const [pt] = await db
    .insert(pushTokensTable)
    .values({ user_id: req.userId as string, platform, token })
    .returning();

  res.status(201).json(pt);
});

export default router;
