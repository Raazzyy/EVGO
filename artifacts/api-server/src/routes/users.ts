import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  UpdateUserBody,
  GetUserParams,
  UpdateUserParams,
} from "@workspace/api-zod";
import { requireUserOrAdmin } from "../middlewares/requireAuth";
import { adminAuth } from "./admin";

const router: IRouter = Router();

router.get("/users", adminAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(usersTable.created_at);
  res.json(rows);
});

router.post("/users", adminAuth, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const [user] = await db.insert(usersTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(user);
});

/** Свой профиль читает и правит сам пользователь, чужие — только админ. */
function canAccessUser(req: { userId?: string; isAdmin?: boolean }, id: string): boolean {
  return Boolean(req.isAdmin) || req.userId === id;
}

router.get("/users/:id", requireUserOrAdmin, async (req, res): Promise<void> => {
  const p = GetUserParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  if (!canAccessUser(req, p.data.id)) { res.status(404).json({ error: "User not found" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.data.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.put("/users/:id", requireUserOrAdmin, async (req, res): Promise<void> => {
  const p = UpdateUserParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  if (!canAccessUser(req, p.data.id)) { res.status(404).json({ error: "User not found" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, p.data.id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

export default router;
