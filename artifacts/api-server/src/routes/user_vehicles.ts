import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, vehiclesTable, userVehiclesTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// Владелец во всех обработчиках берётся из токена. Раньше PATCH и DELETE
// вообще не проверяли владельца: по одному id можно было отредактировать или
// удалить чужую машину.

// GET /user-vehicles — гараж текущего пользователя
router.get("/user-vehicles", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId as string;

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
  // Авто из каталога-оверрайда приходят с id ≤ 0 (напр. -1) — их нельзя
  // отклонять; сервер в этом случае заводит каталожную запись из полей ниже.
  vehicle_id:    z.number().int().optional(),
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

router.post("/user-vehicles", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const user_id = req.userId as string;
  const { vehicle_id, name, connector_type, battery_kwh, range_km,
          make, model, year, body_style, vehicle_type, nickname, is_default } = parsed.data;

  let catalogId: number;

  // Только реальный каталожный id (> 0). id ≤ 0 — это оверрайд (напр. -1),
  // для него идём в find-or-create по полям, иначе была бы ссылка на несуществующую строку.
  if (vehicle_id && vehicle_id > 0) {
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

router.patch<{ id: string }>("/user-vehicles/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.userId as string;
  const { is_default, ...rest } = parsed.data;

  if (is_default) {
    // Машина по умолчанию только одна — снимаем флаг с остальных своих.
    await db.update(userVehiclesTable).set({ is_default: false })
      .where(eq(userVehiclesTable.user_id, userId));
  }

  const [updated] = await db.update(userVehiclesTable)
    .set({ ...rest, ...(is_default !== undefined ? { is_default } : {}) })
    .where(and(eq(userVehiclesTable.id, id), eq(userVehiclesTable.user_id, userId)))
    .returning();

  // 404 и на чужую машину тоже: существование чужих записей — не наше дело
  // сообщать, а различие ответов подсказало бы, какие id заняты.
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, updated.vehicle_id));
  res.json({ ...updated, vehicle });
});

// DELETE /user-vehicles/:id
router.delete<{ id: string }>("/user-vehicles/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const deleted = await db.delete(userVehiclesTable)
    .where(and(
      eq(userVehiclesTable.id, id),
      eq(userVehiclesTable.user_id, req.userId as string),
    ))
    .returning({ id: userVehiclesTable.id });

  if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
