import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, stationsTable, operatorsTable } from "@workspace/db";
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

  res.json(result);
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

router.get("/stations/:id", async (req, res): Promise<void> => {
  const p = GetStationParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const [row] = await db
    .select({ station: stationsTable, operator: operatorsTable })
    .from(stationsTable)
    .leftJoin(operatorsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .where(eq(stationsTable.id, p.data.id));
  if (!row) { res.status(404).json({ error: "Station not found" }); return; }
  res.json(buildStationWithOperator(row.station, row.operator));
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
