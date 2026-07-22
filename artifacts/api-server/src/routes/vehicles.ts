import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vehiclesTable } from "@workspace/db";
import {
  CreateVehicleBody,
  UpdateVehicleBody,
  GetVehicleParams,
  UpdateVehicleParams,
  DeleteVehicleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vehicles", async (_req, res): Promise<void> => {
  const rows = await db.select().from(vehiclesTable);
  res.json(rows);
});

router.post("/vehicles", async (req, res): Promise<void> => {
  const parsed = CreateVehicleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [v] = await db.insert(vehiclesTable).values(parsed.data).returning();
  res.status(201).json(v);
});

router.get("/vehicles/:id", async (req, res): Promise<void> => {
  const p = GetVehicleParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, p.data.id));
  if (!v) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.json(v);
});

router.put("/vehicles/:id", async (req, res): Promise<void> => {
  const p = UpdateVehicleParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = UpdateVehicleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [v] = await db.update(vehiclesTable).set(parsed.data).where(eq(vehiclesTable.id, p.data.id)).returning();
  if (!v) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.json(v);
});

router.delete("/vehicles/:id", async (req, res): Promise<void> => {
  const p = DeleteVehicleParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(vehiclesTable).where(eq(vehiclesTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
