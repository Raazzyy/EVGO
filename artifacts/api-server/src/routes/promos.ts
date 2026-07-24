import { Router, type IRouter } from "express";
import { eq, and, lte, gte, or, isNull, sql, count } from "drizzle-orm";
import { db, promosTable, stationsTable, operatorsTable, sessionsTable } from "@workspace/db";
import { z } from "zod";
import { adminAuth } from "./admin";

const router: IRouter = Router();

// ── Validation schemas ────────────────────────────────────────────────────────
// Accepts full ISO-8601 OR browser's datetime-local "YYYY-MM-DDTHH:mm".
// Uses refine-then-transform so invalid values produce a 400 parse error, not a 500 RangeError.
const flexDatetime = z
  .string()
  .refine(
    (v) => /Z|[+-]\d{2}:\d{2}$/.test(v) || !isNaN(new Date(v).getTime()),
    { message: "Invalid datetime value" },
  )
  .transform((v) => (/Z|[+-]\d{2}:\d{2}$/.test(v) ? v : new Date(v).toISOString()))
  .pipe(z.string().datetime());

const PromoBody = z.object({
  title:             z.string().min(1),
  discount_pct:      z.number().int().min(0).max(100).default(0),
  starts_at:         flexDatetime.optional().nullable(),
  ends_at:           flexDatetime.optional().nullable(),
  is_active:         z.boolean().default(true),
  // 6 targeting types
  target_type:       z.enum(["all", "operator", "station", "low_traffic", "high_traffic", "connector_type"]).default("all"),
  // For connector_type: stores connector type strings (e.g. ["CCS2"]); for others: numeric IDs
  target_ids:        z.array(z.union([z.number(), z.string()])).default([]),
  traffic_threshold: z.number().int().positive().optional().nullable(),
});

// Preview-only extension — traffic_days is NOT persisted (no DB column)
const PreviewBody = PromoBody.extend({
  traffic_days: z.number().int().positive().default(30).optional().nullable(),
});

const PromoIdParam = z.object({ id: z.coerce.number().int().positive() });

// ── GET /api/promos ───────────────────────────────────────────────────────────
router.get("/promos", adminAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(promosTable).orderBy(promosTable.created_at);
  res.json(rows);
});

// ── POST /api/promos ──────────────────────────────────────────────────────────
router.post("/promos", adminAuth, async (req, res): Promise<void> => {
  const parsed = PromoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [promo] = await db.insert(promosTable).values(parsed.data as any).returning();
  res.status(201).json(promo);
});

// ── POST /api/promos/preview — targeting preview with margin impact ───────────
router.post("/promos/preview", adminAuth, async (req, res): Promise<void> => {
  const parsed = PreviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { target_type, target_ids, discount_pct } = parsed.data;

  let stations: any[] = [];

  if (target_type === "all") {
    stations = await db.select().from(stationsTable);
  } else if (target_type === "operator" && target_ids.length > 0) {
    const numIds = target_ids.map(Number).filter(Boolean);
    stations = await db
      .select()
      .from(stationsTable)
      .where(sql`${stationsTable.operator_id} = ANY(ARRAY[${sql.join(numIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
  } else if (target_type === "station" && target_ids.length > 0) {
    const numIds = target_ids.map(Number).filter(Boolean);
    stations = await db
      .select()
      .from(stationsTable)
      .where(sql`${stationsTable.id} = ANY(ARRAY[${sql.join(numIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
  } else if (target_type === "connector_type" && target_ids.length > 0) {
    const connType = String(target_ids[0]);
    // Filter stations whose connectors JSON array contains an object with matching type
    const all = await db.select().from(stationsTable);
    stations = all.filter(s => {
      const cs = s.connectors as Array<{ type: string }> | null;
      return cs?.some(c => c.type === connType);
    });
  } else if (target_type === "low_traffic" && parsed.data.traffic_threshold) {
    // Stations with fewer sessions than threshold in the last traffic_days days
    const days = parsed.data.traffic_days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const counts = await db
      .select({ station_id: sessionsTable.station_id, cnt: count() })
      .from(sessionsTable)
      .where(gte(sessionsTable.started_at, since))
      .groupBy(sessionsTable.station_id);
    const countMap = new Map(counts.map(r => [r.station_id, Number(r.cnt)]));
    const all = await db.select().from(stationsTable);
    stations = all.filter(s => (countMap.get(s.id) ?? 0) < (parsed.data.traffic_threshold ?? Infinity));
  } else if (target_type === "high_traffic" && parsed.data.traffic_threshold) {
    const days = parsed.data.traffic_days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const counts = await db
      .select({ station_id: sessionsTable.station_id, cnt: count() })
      .from(sessionsTable)
      .where(gte(sessionsTable.started_at, since))
      .groupBy(sessionsTable.station_id);
    const countMap = new Map(counts.map(r => [r.station_id, Number(r.cnt)]));
    const all = await db.select().from(stationsTable);
    stations = all.filter(s => (countMap.get(s.id) ?? 0) > (parsed.data.traffic_threshold ?? 0));
  } else {
    // Fallback: all stations
    stations = await db.select().from(stationsTable);
  }

  const result = stations.map(s => {
    const effective_price = s.price_per_kwh * (1 - discount_pct / 100);
    const cost            = parseFloat(String(s.cost_price_per_kwh ?? 0));
    const margin_before   = cost > 0 ? ((s.price_per_kwh - cost) / s.price_per_kwh) * 100 : null;
    const margin_after    = cost > 0 ? ((effective_price  - cost) / effective_price)  * 100 : null;
    return {
      id:              s.id,
      name:            s.name,
      address:         s.address,
      price_per_kwh:   s.price_per_kwh,
      effective_price: Math.round(effective_price * 100) / 100,
      margin_before:   margin_before != null ? Math.round(margin_before * 10) / 10 : null,
      margin_after:    margin_after  != null ? Math.round(margin_after  * 10) / 10 : null,
    };
  });

  res.json({ count: result.length, discount_pct, stations: result });
});

// ── PATCH /api/promos/:id ─────────────────────────────────────────────────────
router.patch("/promos/:id", adminAuth, async (req, res): Promise<void> => {
  const p = PromoIdParam.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = PromoBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [promo] = await db.update(promosTable).set(parsed.data as any).where(eq(promosTable.id, p.data.id)).returning();
  if (!promo) { res.status(404).json({ error: "Promo not found" }); return; }
  res.json(promo);
});

// ── DELETE /api/promos/:id ────────────────────────────────────────────────────
router.delete("/promos/:id", adminAuth, async (req, res): Promise<void> => {
  const p = PromoIdParam.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(promosTable).where(eq(promosTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
