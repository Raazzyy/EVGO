import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, notificationsTable, pushTokensTable } from "@workspace/db";

const router: IRouter = Router();

// GET /notifications?user_id=
router.get("/notifications", async (req, res): Promise<void> => {
  const userId = req.query.user_id as string | undefined;
  if (!userId) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.user_id, userId))
    .orderBy(notificationsTable.created_at);
  res.json(rows.reverse()); // newest first
});

// POST /notifications — create (admin/internal)
router.post("/notifications", async (req, res): Promise<void> => {
  const { user_id, type, title, body } = req.body;
  if (!user_id || !type || !title || !body) {
    res.status(400).json({ error: "user_id, type, title, body required" });
    return;
  }
  const [n] = await db.insert(notificationsTable).values({ user_id, type, title, body }).returning();
  res.status(201).json(n);
});

// PATCH /notifications/:id/read
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [n] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, id))
    .returning();
  if (!n) { res.status(404).json({ error: "Not found" }); return; }
  res.json(n);
});

// POST /notifications/broadcast — admin sends to all users
router.post("/notifications/broadcast", async (req, res): Promise<void> => {
  const { type, title, body, user_ids } = req.body;
  if (!type || !title || !body) {
    res.status(400).json({ error: "type, title, body required" });
    return;
  }
  // If user_ids array provided, send to those; otherwise broadcast to all tokens
  const targets: string[] = Array.isArray(user_ids) ? user_ids : [];

  if (targets.length === 0) {
    // Get unique user IDs from push_tokens
    const tokens = await db.select().from(pushTokensTable);
    const unique = [...new Set(tokens.map(t => t.user_id))];
    targets.push(...unique);
  }

  if (targets.length === 0) {
    res.json({ sent: 0 });
    return;
  }

  const rows = targets.map(uid => ({ user_id: uid, type, title, body }));
  await db.insert(notificationsTable).values(rows);
  res.json({ sent: targets.length });
});

// POST /push-tokens — register push token
router.post("/push-tokens", async (req, res): Promise<void> => {
  const { user_id, platform, token } = req.body;
  if (!user_id || !platform || !token) {
    res.status(400).json({ error: "user_id, platform, token required" });
    return;
  }
  const [pt] = await db
    .insert(pushTokensTable)
    .values({ user_id, platform, token })
    .returning();
  res.status(201).json(pt);
});

export default router;
