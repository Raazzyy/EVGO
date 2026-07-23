import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, vehiclesTable } from "@workspace/db";
import {
  CreateVehicleBody,
  UpdateVehicleBody,
  GetVehicleParams,
  UpdateVehicleParams,
  DeleteVehicleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /vehicles/search?q= — proxy to API Ninjas (EV_API_KEY stays server-side), results cached in DB
router.get("/vehicles/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  // 1. Check cache in DB first
  const cached = await db
    .select()
    .from(vehiclesTable)
    .where(ilike(vehiclesTable.name, `%${q}%`));

  if (cached.length > 0) {
    res.json(cached);
    return;
  }

  // 2. Fetch from API Ninjas if cache miss
  const apiKey = process.env.EV_API_KEY;
  if (!apiKey) {
    res.json([]); // No key — return empty (don't error; UI handles gracefully)
    return;
  }

  try {
    const url = `https://api.api-ninjas.com/v1/cars?model=${encodeURIComponent(q)}&fuel_type=electric&limit=10`;
    const resp = await fetch(url, { headers: { "X-Api-Key": apiKey } });
    if (!resp.ok) { res.json([]); return; }

    const data = (await resp.json()) as Array<{
      make: string;
      model: string;
      year: number;
      range?: number;
      drive?: string;
    }>;

    // Map to our Vehicle schema and upsert cache
    const mapped = data.map(v => ({
      name: `${v.make} ${v.model}`,
      battery_kwh: 60, // API Ninjas basic plan doesn't include battery_kwh; default
      range_km: Math.round((v.range ?? 300) * 1.609), // miles → km
      connector_type: "CCS2" as const,
      current_battery_pct: null as number | null,
    }));

    // Insert into cache (ignore duplicates via name matching)
    const inserted: typeof vehiclesTable.$inferSelect[] = [];
    for (const v of mapped) {
      const existing = await db.select().from(vehiclesTable).where(ilike(vehiclesTable.name, v.name));
      if (existing.length === 0) {
        const [row] = await db.insert(vehiclesTable).values(v).returning();
        inserted.push(row);
      } else {
        inserted.push(existing[0]);
      }
    }

    res.json(inserted);
  } catch {
    res.json([]);
  }
});

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
