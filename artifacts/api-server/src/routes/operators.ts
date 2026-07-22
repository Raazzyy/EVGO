import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, operatorsTable, stationsTable } from "@workspace/db";
import {
  CreateOperatorBody,
  UpdateOperatorBody,
  GetOperatorParams,
  UpdateOperatorParams,
  DeleteOperatorParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/operators", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: operatorsTable.id,
      name: operatorsTable.name,
      logo_url: operatorsTable.logo_url,
      station_count: sql<number>`cast(count(${stationsTable.id}) as int)`,
    })
    .from(operatorsTable)
    .leftJoin(stationsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .groupBy(operatorsTable.id);
  res.json(rows);
});

router.post("/operators", async (req, res): Promise<void> => {
  const parsed = CreateOperatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [op] = await db.insert(operatorsTable).values(parsed.data).returning();
  res.status(201).json({ ...op, station_count: 0 });
});

router.get("/operators/:id", async (req, res): Promise<void> => {
  const p = GetOperatorParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const [row] = await db
    .select({
      id: operatorsTable.id,
      name: operatorsTable.name,
      logo_url: operatorsTable.logo_url,
      station_count: sql<number>`cast(count(${stationsTable.id}) as int)`,
    })
    .from(operatorsTable)
    .leftJoin(stationsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .where(eq(operatorsTable.id, p.data.id))
    .groupBy(operatorsTable.id);
  if (!row) { res.status(404).json({ error: "Operator not found" }); return; }
  res.json(row);
});

router.put("/operators/:id", async (req, res): Promise<void> => {
  const p = UpdateOperatorParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = UpdateOperatorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [op] = await db
    .update(operatorsTable)
    .set(parsed.data)
    .where(eq(operatorsTable.id, p.data.id))
    .returning();
  if (!op) { res.status(404).json({ error: "Operator not found" }); return; }
  res.json({ ...op, station_count: 0 });
});

router.delete("/operators/:id", async (req, res): Promise<void> => {
  const p = DeleteOperatorParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(operatorsTable).where(eq(operatorsTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
