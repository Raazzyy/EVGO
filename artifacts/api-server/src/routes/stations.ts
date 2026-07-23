import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, stationsTable, operatorsTable, connectorsTable, sessionsTable } from "@workspace/db";
import {
  CreateStationBody,
  UpdateStationBody,
  UpdateStationStatusBody,
  GetStationParams,
  UpdateStationParams,
  DeleteStationParams,
  UpdateStationStatusParams,
  GetStationsQueryParams,
} from "@workspace/api-zod";
import { z } from "zod";

// ── Extended partial-update schema (superset of generated one) ───────────────
const connectorSchema = z.object({
  type: z.string(),
  power_kw: z.number(),
  total: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
});

const ExtendedStationPatch = z.object({
  name:                 z.string().optional(),
  address:              z.string().optional(),
  lat:                  z.number().optional(),
  lng:                  z.number().optional(),
  power_kw:             z.number().positive().optional(),
  price_per_kwh:        z.number().nonnegative().optional(),
  cost_price_per_kwh:   z.coerce.number().nonnegative().nullable().optional(),
  status:               z.enum(["free", "occupied", "offline"]).optional(),
  source:               z.enum(["manual", "api", "mock"]).optional(),
  operator_id:          z.number().int().positive().nullable().optional(),
  connectors:           z.array(connectorSchema).optional(),
  amenities:            z.array(z.string()).optional(),
  photos:               z.array(z.string().url()).optional(),
  district:             z.string().nullable().optional(),
  region:               z.string().nullable().optional(),
  // is_promoted stored as 0/1 integer; accept boolean or number from client
  is_promoted:          z.union([z.boolean(), z.number().int().min(0).max(1)]).optional()
                          .transform(v => v === true || v === 1 ? 1 : v === false || v === 0 ? 0 : undefined),
  discount_pct:         z.number().int().min(0).max(100).optional(),
  supports_reservation: z.boolean().optional(),
});

const router: IRouter = Router();

function buildStationWithOperator(s: typeof stationsTable.$inferSelect, op: typeof operatorsTable.$inferSelect | null) {
  return {
    ...s,
    operator: op ? { id: op.id, name: op.name, logo_url: op.logo_url, station_count: 0 } : undefined,
    distance_km: null,
  };
}

router.get("/stations", async (req, res): Promise<void> => {
  const q = GetStationsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }

  const conditions = [];
  if (q.data.status) conditions.push(eq(stationsTable.status, q.data.status));
  if (q.data.operator_id) conditions.push(eq(stationsTable.operator_id, q.data.operator_id));
  if (q.data.min_power) conditions.push(gte(stationsTable.power_kw, q.data.min_power));
  if (q.data.max_power) conditions.push(lte(stationsTable.power_kw, q.data.max_power));

  const rows = await db
    .select({
      station: stationsTable,
      operator: operatorsTable,
    })
    .from(stationsTable)
    .leftJoin(operatorsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  let result = rows.map(r => buildStationWithOperator(r.station, r.operator));

  // filter by connector_type if provided (JSON field)
  if (q.data.connector_type) {
    result = result.filter(s =>
      (s.connectors as Array<{type: string}> | null)?.some(c => c.type === q.data.connector_type)
    );
  }

  // Sort by distance if lat/lng provided
  if (q.data.lat != null && q.data.lng != null) {
    const userLat = q.data.lat;
    const userLng = q.data.lng;
    result = result.map(s => ({
      ...s,
      distance_km: Math.sqrt(
        Math.pow((s.lat - userLat) * 111, 2) +
        Math.pow((s.lng - userLng) * 111 * Math.cos(userLat * Math.PI / 180), 2)
      ),
    }));
    result.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
    if (q.data.radius_km) {
      result = result.filter(s => (s.distance_km ?? 0) <= (q.data.radius_km ?? Infinity));
    }
  }

  // Return {promoted, nearby} — backend owns the split
  const promoted = result
    .filter(s => (s as any).is_promoted === 1 || (s as any).is_promoted === true)
    .sort((a, b) => ((b as any).discount_pct ?? 0) - ((a as any).discount_pct ?? 0));
  const nearby = result; // all stations sorted by distance; promoted appear at natural position too

  res.json({ promoted, nearby });
});

router.post("/stations", async (req, res): Promise<void> => {
  const parsed = CreateStationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [station] = await db.insert(stationsTable).values({
    ...parsed.data,
    source: parsed.data.source ?? "manual",
  }).returning();
  const [op] = station.operator_id
    ? await db.select().from(operatorsTable).where(eq(operatorsTable.id, station.operator_id))
    : [null];
  res.status(201).json(buildStationWithOperator(station, op ?? null));
});

/** Compute progress/ETA for an active session on a connector */
function computeConnectorProgress(startedAt: Date, powerKw: number) {
  const CAR_BATTERY_KWH = 77.4;
  const startPct = 45;
  const elapsedH = (Date.now() - startedAt.getTime()) / 3_600_000;
  const cappedH = Math.min(elapsedH, 0.5);
  const addedKwh = cappedH * powerKw;
  const currentKwh = (startPct / 100) * CAR_BATTERY_KWH + addedKwh;
  const progress_pct = Math.min(95, Math.round((currentKwh / CAR_BATTERY_KWH) * 100));
  const energy_kwh = parseFloat(addedKwh.toFixed(2));
  const targetKwh = 0.8 * CAR_BATTERY_KWH;
  const remainingKwh = Math.max(0, targetKwh - currentKwh);
  const minsTo80 = powerKw > 0 ? Math.round((remainingKwh / powerKw) * 60) : 0;
  const freeAt = new Date(Date.now() + minsTo80 * 60_000);
  const freeAtStr = freeAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return { progress_pct, energy_kwh, mins_to_80: minsTo80, free_at: freeAtStr };
}

router.get("/stations/:id", async (req, res): Promise<void> => {
  const p = GetStationParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const user_id = req.query.user_id as string | undefined;

  const [row] = await db
    .select({ station: stationsTable, operator: operatorsTable })
    .from(stationsTable)
    .leftJoin(operatorsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .where(eq(stationsTable.id, p.data.id));
  if (!row) { res.status(404).json({ error: "Station not found" }); return; }

  // Fetch individual connectors and lazily expire stale reservations
  const now = new Date();
  const connectorRows = await db.select().from(connectorsTable)
    .where(eq(connectorsTable.station_id, p.data.id))
    .orderBy(connectorsTable.label);

  for (const c of connectorRows) {
    if (c.status === "reserved" && c.reserved_until && c.reserved_until < now) {
      await db.update(connectorsTable)
        .set({ status: "free", reserved_by_user_id: null, reserved_until: null, updated_at: now })
        .where(eq(connectorsTable.id, c.id));
      c.status = "free"; c.reserved_by_user_id = null; c.reserved_until = null;
    }
  }

  // Enrich occupied connectors with live session progress
  const enrichedConnectors = await Promise.all(connectorRows.map(async (c) => {
    if (c.status === "occupied" && c.current_session_id) {
      const [sess] = await db.select().from(sessionsTable)
        .where(eq(sessionsTable.id, c.current_session_id));
      if (sess && sess.status === "active") {
        const isOurs = user_id ? sess.user_id === user_id : false;
        if (isOurs) {
          return { ...c, session: { is_mine: true, ...computeConnectorProgress(sess.started_at, c.power_kw) } };
        }
        return { ...c, session: { is_mine: false } };
      }
    }
    return c;
  }));

  const freeCount = enrichedConnectors.filter(c => c.status === "free").length;
  const base = buildStationWithOperator(row.station, row.operator);
  res.json({
    ...base,
    connectors_detail: enrichedConnectors,
    available: freeCount,
    total_connectors: enrichedConnectors.length,
  });
});

router.put("/stations/:id", async (req, res): Promise<void> => {
  const p = UpdateStationParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = UpdateStationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [station] = await db
    .update(stationsTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(stationsTable.id, p.data.id))
    .returning();
  if (!station) { res.status(404).json({ error: "Station not found" }); return; }
  const [op] = station.operator_id
    ? await db.select().from(operatorsTable).where(eq(operatorsTable.id, station.operator_id))
    : [null];
  res.json(buildStationWithOperator(station, op ?? null));
});

// ── PATCH /stations/:id  (partial update — all extended fields accepted) ─────
router.patch("/stations/:id", async (req, res): Promise<void> => {
  const p = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = ExtendedStationPatch.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data, updated_at: new Date() };
  // Remove undefined values so Drizzle doesn't overwrite fields with undefined
  for (const k of Object.keys(updateData)) {
    if (updateData[k] === undefined) delete updateData[k];
  }

  const [station] = await db
    .update(stationsTable)
    .set(updateData as any)
    .where(eq(stationsTable.id, p.data.id))
    .returning();
  if (!station) { res.status(404).json({ error: "Station not found" }); return; }
  const [op] = station.operator_id
    ? await db.select().from(operatorsTable).where(eq(operatorsTable.id, station.operator_id))
    : [null];
  res.json(buildStationWithOperator(station, op ?? null));
});

router.delete("/stations/:id", async (req, res): Promise<void> => {
  const p = DeleteStationParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(stationsTable).where(eq(stationsTable.id, p.data.id));
  res.sendStatus(204);
});

router.patch("/stations/:id/status", async (req, res): Promise<void> => {
  const p = UpdateStationStatusParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = UpdateStationStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [station] = await db
    .update(stationsTable)
    .set({ status: parsed.data.status, updated_at: new Date() })
    .where(eq(stationsTable.id, p.data.id))
    .returning();
  if (!station) { res.status(404).json({ error: "Station not found" }); return; }
  const [op] = station.operator_id
    ? await db.select().from(operatorsTable).where(eq(operatorsTable.id, station.operator_id))
    : [null];
  res.json(buildStationWithOperator(station, op ?? null));
});

export default router;
