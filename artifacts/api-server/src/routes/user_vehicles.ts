import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, vehiclesTable, userVehiclesTable } from "@workspace/db";
import { z } from "zod";

const router = Router();

// GET /user-vehicles?user_id=xxx
router.get("/user-vehicles", async (req, res): Promise<void> => {
  const userId = req.query.user_id as string;
  if (!userId) { res.status(400).json({ error: "user_id required" }); return; }

  const rows = await db
    .select({ uv: userVehiclesTable, v: vehiclesTable })
    .from(userVehiclesTable)
    .leftJoin(vehiclesTable, eq(userVehiclesTable.vehicle_id, vehiclesTable.id))
    .where(eq(userVehiclesTable.user_id, userId))
    .orderBy(userVehiclesTable.created_at);

  res.json(rows.map(r => ({ ...r.uv, vehicle: r.v })));
});

// POST /user-vehicles
// Body: { user_id, vehicle_id?, name?, connector_type?, battery_kwh?, range_km?, ... }
const CreateBody = z.object({
  user_id:       z.string(),
  vehicle_id:    z.number().int().positive().optional(),
  name:          z.string().optional(),
  connector_type: z.enum(["CCS2", "CHAdeMO", "Type2", "GB-T"]).optional(),
  battery_kwh:   z.number().positive().optional(),
  range_km:      z.number().positive().optional(),
  make:          z.string().optional(),
  model:         z.string().optional(),
  year:          z.number().int().optional(),
  body_style:    z.string().optional(),
  vehicle_type:  z.string().optional(),
  nickname:      z.string().optional(),
  is_default:    z.boolean().optional(),
});

router.post("/user-vehicles", async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { user_id, vehicle_id, name, connector_type, battery_kwh, range_km,
          make, model, year, body_style, vehicle_type, nickname, is_default } = parsed.data;

  let catalogId: number;

  if (vehicle_id) {
    catalogId = vehicle_id;
  } else {
    if (!name || !connector_type || !battery_kwh || !range_km) {
      res.status(400).json({ error: "vehicle_id or (name, connector_type, battery_kwh, range_km) required" });
      return;
    }
    // Find-or-create catalog record
    const existing = await db.select().from(vehiclesTable)
      .where(eq(vehiclesTable.name, name)).limit(1);
    if (existing.length > 0) {
      catalogId = existing[0].id;
    } else {
      const [created] = await db.insert(vehiclesTable).values({
        name, connector_type, battery_kwh, range_km,
        make: make ?? null, model: model ?? null, year: year ?? null,
        body_style: body_style ?? null, vehicle_type: vehicle_type ?? null,
        data_source: "user", is_verified: false,
      }).returning();
      catalogId = created.id;
    }
  }

  // If new record should be default, clear existing defaults
  if (is_default) {
    await db.update(userVehiclesTable).set({ is_default: false })
      .where(eq(userVehiclesTable.user_id, user_id));
  }

  // Check if user already has this vehicle linked (prevent duplicates)
  const dup = await db.select().from(userVehiclesTable)
    .where(eq(userVehiclesTable.user_id, user_id))
    .then(rows => rows.find(r => r.vehicle_id === catalogId));

  if (dup) { res.status(409).json({ error: "Vehicle already in your garage", existing: dup }); return; }

  const [uv] = await db.insert(userVehiclesTable).values({
    user_id, vehicle_id: catalogId, nickname: nickname ?? null,
    is_default: is_default ?? false,
  }).returning();

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, catalogId));
  res.status(201).json({ ...uv, vehicle });
});

// PATCH /user-vehicles/:id  (nickname, battery, is_default)
const PatchBody = z.object({
  nickname:            z.string().nullable().optional(),
  current_battery_pct: z.number().min(0).max(100).nullable().optional(),
  is_default:          z.boolean().optional(),
});

router.patch("/user-vehicles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { is_default, ...rest } = parsed.data;

  if (is_default) {
    const [existing] = await db.select().from(userVehiclesTable).where(eq(userVehiclesTable.id, id));
    if (existing) {
      await db.update(userVehiclesTable).set({ is_default: false })
        .where(eq(userVehiclesTable.user_id, existing.user_id));
    }
  }

  const [updated] = await db.update(userVehiclesTable)
    .set({ ...rest, ...(is_default !== undefined ? { is_default } : {}) })
    .where(eq(userVehiclesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, updated.vehicle_id));
  res.json({ ...updated, vehicle });
});

// DELETE /user-vehicles/:id
router.delete("/user-vehicles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(userVehiclesTable).where(eq(userVehiclesTable.id, id));
  res.status(204).end();
});

export default router;
