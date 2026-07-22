import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, supportTicketsTable } from "@workspace/db";
import {
  CreateSupportTicketBody,
  UpdateSupportTicketBody,
  UpdateSupportTicketParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/support-tickets", async (_req, res): Promise<void> => {
  const rows = await db.select().from(supportTicketsTable).orderBy(supportTicketsTable.created_at);
  res.json(rows);
});

router.post("/support-tickets", async (req, res): Promise<void> => {
  const parsed = CreateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [ticket] = await db.insert(supportTicketsTable).values(parsed.data).returning();
  res.status(201).json(ticket);
});

router.patch("/support-tickets/:id", async (req, res): Promise<void> => {
  const p = UpdateSupportTicketParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = UpdateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "resolved" || parsed.data.status === "closed") {
    updates.resolved_at = new Date();
  }

  const [ticket] = await db
    .update(supportTicketsTable)
    .set(updates)
    .where(eq(supportTicketsTable.id, p.data.id))
    .returning();
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json(ticket);
});

export default router;
