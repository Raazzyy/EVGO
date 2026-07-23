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
import { z } from "zod";
import { adminAuth } from "./admin";

const router: IRouter = Router();

// ── Extended update schema (superset of generated one, includes new fields) ──
const ExtendedOperatorPatch = z.object({
  name:               z.string().min(1).optional(),
  logo_url:           z.string().url().optional().nullable(),
  contact_person:     z.string().optional().nullable(),
  phone:              z.string().optional().nullable(),
  email:              z.string().email().optional().nullable(),
  contract_notes:     z.string().optional().nullable(),
  api_type:           z.enum(["none", "ocpi", "ocpp", "custom", "manual"]).optional(),
  api_endpoint:       z.string().url().optional().nullable(),
  api_credentials:    z.string().optional().nullable(),
  default_margin_pct: z.number().min(0).max(100).optional().nullable(),
});

// ── GET /api/operators ───────────────────────────────────────────────────────
router.get("/operators", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id:                 operatorsTable.id,
      name:               operatorsTable.name,
      logo_url:           operatorsTable.logo_url,
      contact_person:     operatorsTable.contact_person,
      phone:              operatorsTable.phone,
      email:              operatorsTable.email,
      api_type:           operatorsTable.api_type,
      default_margin_pct: operatorsTable.default_margin_pct,
      station_count:      sql<number>`cast(count(${stationsTable.id}) as int)`,
    })
    .from(operatorsTable)
    .leftJoin(stationsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .groupBy(operatorsTable.id);
  res.json(rows);
});

// ── POST /api/operators ──────────────────────────────────────────────────────
router.post("/operators", async (req, res): Promise<void> => {
  const parsed = CreateOperatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [op] = await db.insert(operatorsTable).values(parsed.data).returning();
  res.status(201).json({ ...op, station_count: 0 });
});

// ── GET /api/operators/:id ───────────────────────────────────────────────────
router.get("/operators/:id", async (req, res): Promise<void> => {
  const p = GetOperatorParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }

  const [row] = await db
    .select({
      id:                 operatorsTable.id,
      name:               operatorsTable.name,
      logo_url:           operatorsTable.logo_url,
      contact_person:     operatorsTable.contact_person,
      phone:              operatorsTable.phone,
      email:              operatorsTable.email,
      contract_notes:     operatorsTable.contract_notes,
      api_type:           operatorsTable.api_type,
      api_endpoint:       operatorsTable.api_endpoint,
      // api_credentials intentionally omitted from read — sensitive
      default_margin_pct: operatorsTable.default_margin_pct,
      station_count:      sql<number>`cast(count(${stationsTable.id}) as int)`,
    })
    .from(operatorsTable)
    .leftJoin(stationsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .where(eq(operatorsTable.id, p.data.id))
    .groupBy(operatorsTable.id);

  if (!row) { res.status(404).json({ error: "Operator not found" }); return; }
  res.json(row);
});

// ── PUT /api/operators/:id  (legacy full-replace, keeps backward compat) ─────
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

// ── PATCH /api/operators/:id  (partial update, includes new fields) ───────────
router.patch("/operators/:id", adminAuth, async (req, res): Promise<void> => {
  const p = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = ExtendedOperatorPatch.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [op] = await db
    .update(operatorsTable)
    .set(parsed.data as any)
    .where(eq(operatorsTable.id, p.data.id))
    .returning();
  if (!op) { res.status(404).json({ error: "Operator not found" }); return; }

  // Omit api_credentials from response
  const { api_credentials: _omit, ...safe } = op as any;
  res.json({ ...safe, station_count: 0 });
});

// ── POST /api/operators/:id/ping  (stub — checks API reachability) ───────────
router.post("/operators/:id/ping", adminAuth, async (req, res): Promise<void> => {
  const p = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }

  const [op] = await db.select({ id: operatorsTable.id, api_type: operatorsTable.api_type, api_endpoint: operatorsTable.api_endpoint })
    .from(operatorsTable)
    .where(eq(operatorsTable.id, p.data.id));
  if (!op) { res.status(404).json({ error: "Operator not found" }); return; }

  // Stub: simulate a latency test; real implementation would probe api_endpoint
  const latencyMs = Math.floor(Math.random() * 120) + 30;
  res.json({ ok: true, latency_ms: latencyMs, api_type: op.api_type, message: "Connection successful (stub)" });
});

// ── DELETE /api/operators/:id ────────────────────────────────────────────────
router.delete("/operators/:id", async (req, res): Promise<void> => {
  const p = DeleteOperatorParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(operatorsTable).where(eq(operatorsTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
