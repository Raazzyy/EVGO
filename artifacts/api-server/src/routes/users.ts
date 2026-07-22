import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  UpdateUserBody,
  GetUserParams,
  UpdateUserParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(usersTable.created_at);
  res.json(rows);
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const [user] = await db.insert(usersTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(user);
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const p = GetUserParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.data.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.put("/users/:id", async (req, res): Promise<void> => {
  const p = UpdateUserParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, p.data.id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

export default router;
