import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, stationReportsTable, stationsTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { adminAuth } from "./admin";

const router: IRouter = Router();

const REASONS = [
  "not_working",
  "wrong_price",
  "wrong_location",
  "wrong_connectors",
  "permanently_closed",
  "other",
] as const;

const CreateReportBody = z.object({
  reason: z.enum(REASONS),
  comment: z.string().trim().max(1000).optional(),
});

// ── POST /api/stations/:id/report ────────────────────────────────────────────
// Пользователь сообщает, что данные станции неверны.
router.post<{ id: string }>("/stations/:id/report", requireAuth, async (req, res): Promise<void> => {
  const p = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }

  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [station] = await db
    .select({ id: stationsTable.id })
    .from(stationsTable)
    .where(eq(stationsTable.id, p.data.id));
  if (!station) { res.status(404).json({ error: "Station not found" }); return; }

  const userId = req.userId as string;

  // Один человек не должен засыпать одну станцию жалобами: если его прошлая
  // жалоба ещё не разобрана, обновляем её вместо создания новой.
  const [pending] = await db
    .select()
    .from(stationReportsTable)
    .where(and(
      eq(stationReportsTable.station_id, p.data.id),
      eq(stationReportsTable.user_id, userId),
      eq(stationReportsTable.status, "new"),
    ));

  if (pending) {
    const [updated] = await db
      .update(stationReportsTable)
      .set({ reason: parsed.data.reason, comment: parsed.data.comment ?? null })
      .where(eq(stationReportsTable.id, pending.id))
      .returning();
    res.json(updated);
    return;
  }

  const [report] = await db
    .insert(stationReportsTable)
    .values({
      station_id: p.data.id,
      user_id: userId,
      reason: parsed.data.reason,
      comment: parsed.data.comment ?? null,
    })
    .returning();

  res.status(201).json(report);
});

// ── GET /api/admin/station-reports ───────────────────────────────────────────
// Очередь жалоб для админки. По умолчанию — только неразобранные.
router.get("/admin/station-reports", adminAuth, async (req, res): Promise<void> => {
  const q = z.object({
    status: z.enum(["new", "confirmed", "rejected"]).optional(),
  }).safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }

  const rows = await db
    .select({
      report: stationReportsTable,
      station: {
        id: stationsTable.id,
        name: stationsTable.name,
        address: stationsTable.address,
        verified_at: stationsTable.verified_at,
      },
    })
    .from(stationReportsTable)
    .leftJoin(stationsTable, eq(stationReportsTable.station_id, stationsTable.id))
    .where(eq(stationReportsTable.status, q.data.status ?? "new"))
    .orderBy(desc(stationReportsTable.created_at));

  res.json(rows.map(r => ({ ...r.report, station: r.station ?? undefined })));
});

// ── PATCH /api/admin/station-reports/:id ─────────────────────────────────────
// Разобрать жалобу: подтвердить (данные исправлены) или отклонить.
router.patch<{ id: string }>("/admin/station-reports/:id", adminAuth, async (req, res): Promise<void> => {
  const p = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }

  const parsed = z.object({
    status: z.enum(["confirmed", "rejected"]),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [report] = await db
    .update(stationReportsTable)
    .set({
      status: parsed.data.status,
      resolved_by: req.adminEmail ?? null,
      resolved_at: new Date(),
    })
    .where(eq(stationReportsTable.id, p.data.id))
    .returning();

  if (!report) { res.status(404).json({ error: "Report not found" }); return; }
  res.json(report);
});

// ── GET /api/admin/station-reports/count ─────────────────────────────────────
// Счётчик для бейджа в меню админки.
router.get("/admin/station-reports/count", adminAuth, async (_req, res): Promise<void> => {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(stationReportsTable)
    .where(eq(stationReportsTable.status, "new"));

  res.json({ new: row?.count ?? 0 });
});

export default router;
