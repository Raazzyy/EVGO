import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  sessionsTable,
  stationsTable,
  operatorsTable,
  connectorsTable,
  connectorWatchersTable,
} from "@workspace/db";
import {
  StartSessionBody,
  GetSessionParams,
  StopSessionParams,
  GetSessionsQueryParams,
} from "@workspace/api-zod";

import { requireAuth, requireUserOrAdmin } from "../middlewares/requireAuth";
import { notifyUser, notifyConnectorWatchers } from "../lib/push";

const router: IRouter = Router();

/**
 * Сессия зарядки принадлежит пользователю, который её начал. Владелец берётся
 * из токена; администратор видит и останавливает любые — это его работа.
 */
function ownsSession(
  req: { userId?: string; isAdmin?: boolean },
  session: { user_id: string | null },
): boolean {
  if (req.isAdmin) return true;
  return Boolean(req.userId) && session.user_id === req.userId;
}

async function getStationForSession(stationId: number) {
  const [row] = await db
    .select({ station: stationsTable, operator: operatorsTable })
    .from(stationsTable)
    .leftJoin(operatorsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .where(eq(stationsTable.id, stationId));
  if (!row) return null;
  return {
    ...row.station,
    operator: row.operator ? { id: row.operator.id, name: row.operator.name, logo_url: row.operator.logo_url, station_count: 0 } : undefined,
    distance_km: null,
  };
}

router.get("/sessions", requireUserOrAdmin, async (req, res): Promise<void> => {
  const q = GetSessionsQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }

  const conditions = [];
  if (q.data.status) conditions.push(eq(sessionsTable.status, q.data.status));
  if (q.data.station_id) conditions.push(eq(sessionsTable.station_id, q.data.station_id));

  if (req.isAdmin) {
    // Админке нужны все сессии, при желании — с фильтром по пользователю.
    if (q.data.user_id) conditions.push(eq(sessionsTable.user_id, q.data.user_id));
  } else {
    // Пользователю — только свои. Параметр user_id из запроса игнорируется:
    // раньше по нему можно было прочитать чужую историю зарядок.
    conditions.push(eq(sessionsTable.user_id, req.userId as string));
  }

  const rows = await db
    .select({ session: sessionsTable, station: stationsTable, operator: operatorsTable })
    .from(sessionsTable)
    .leftJoin(stationsTable, eq(sessionsTable.station_id, stationsTable.id))
    .leftJoin(operatorsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sessionsTable.started_at);

  const result = rows.map(r => ({
    ...r.session,
    station: r.station ? {
      ...r.station,
      operator: r.operator ? { id: r.operator.id, name: r.operator.name, logo_url: r.operator.logo_url, station_count: 0 } : undefined,
      distance_km: null,
    } : undefined,
  }));

  res.json(result);
});

router.post("/sessions", requireAuth, async (req, res): Promise<void> => {
  const parsed = StartSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const connectorId: number | undefined = (parsed.data as any).connector_id;

  const [session] = await db.insert(sessionsTable).values({
    station_id: parsed.data.station_id,
    user_id: req.userId as string,
    connector_type: parsed.data.connector_type ?? null,
    connector_id: connectorId ?? null,
    payment_method_id: parsed.data.payment_method_id ?? null,
    status: "active",
  }).returning();

  // Mark station as occupied
  await db.update(stationsTable)
    .set({ status: "occupied", updated_at: new Date() })
    .where(eq(stationsTable.id, parsed.data.station_id));

  // Mark individual connector as occupied and link session
  if (connectorId) {
    await db.update(connectorsTable)
      .set({ status: "occupied", current_session_id: session.id, reserved_by_user_id: null, reserved_until: null, updated_at: new Date() })
      .where(eq(connectorsTable.id, connectorId));

    // Notify any watchers (fire & forget — push notifications are mock)
    // Remove watchers since connector became occupied (they'll be notified when free)
  }

  const station = await getStationForSession(parsed.data.station_id);
  res.status(201).json({ ...session, station });
});

/** Compute progress_pct server-side: mock simulation based on elapsed time + station power */
function computeProgressPct(session: typeof sessionsTable.$inferSelect, powerKw: number): number {
  if (session.status !== "active") return 100;
  const CAR_BATTERY_KWH = 77.4; // IONIQ 5 default
  const startPct = 45; // assume starting at 45%
  const elapsedH = (Date.now() - session.started_at.getTime()) / 3_600_000;
  const cappedH = Math.min(elapsedH, 0.5); // cap at 30 min for demo realism
  const addedKwh = cappedH * powerKw;
  const currentKwh = (startPct / 100) * CAR_BATTERY_KWH + addedKwh;
  return Math.min(95, Math.round((currentKwh / CAR_BATTERY_KWH) * 100));
}

router.get("/sessions/:id", requireUserOrAdmin, async (req, res): Promise<void> => {
  const p = GetSessionParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }

  const [row] = await db
    .select({ session: sessionsTable, station: stationsTable, operator: operatorsTable })
    .from(sessionsTable)
    .leftJoin(stationsTable, eq(sessionsTable.station_id, stationsTable.id))
    .leftJoin(operatorsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .where(eq(sessionsTable.id, p.data.id));

  if (!row) { res.status(404).json({ error: "Session not found" }); return; }
  if (!ownsSession(req, row.session)) { res.status(404).json({ error: "Session not found" }); return; }

  const powerKw = row.station?.power_kw ?? 50;
  const progress_pct = computeProgressPct(row.session, powerKw);

  res.json({
    ...row.session,
    progress_pct,
    station: row.station ? {
      ...row.station,
      operator: row.operator ? { id: row.operator.id, name: row.operator.name, logo_url: row.operator.logo_url, station_count: 0 } : undefined,
      distance_km: null,
    } : undefined,
  });
});

// POST /sessions/:id/pay — mock payment confirmation
router.post<{ id: string }>("/sessions/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const [existing] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Session not found" }); return; }
  if (!ownsSession(req, existing)) { res.status(404).json({ error: "Session not found" }); return; }

  // Mock: mark session as paid by setting status to completed if still active
  let session = existing;
  if (existing.status === "active") {
    const station = await getStationForSession(existing.station_id);
    const powerKw = (station as { power_kw?: number })?.power_kw ?? 50;
    const pricePerKwh = (station as { price_per_kwh?: number })?.price_per_kwh ?? 2000;
    const durationH = Math.min((Date.now() - existing.started_at.getTime()) / 3_600_000, 0.5);
    const energy = parseFloat((durationH * powerKw).toFixed(2));
    const cost = parseFloat((energy * pricePerKwh).toFixed(2));
    const [updated] = await db
      .update(sessionsTable)
      .set({ status: "completed", ended_at: new Date(), energy_kwh: energy, cost })
      .where(eq(sessionsTable.id, id))
      .returning();
    await db.update(stationsTable).set({ status: "free", updated_at: new Date() }).where(eq(stationsTable.id, existing.station_id));
    session = updated;
  }

  res.json({ ...session, progress_pct: 100 });
});

router.patch("/sessions/:id/stop", requireUserOrAdmin, async (req, res): Promise<void> => {
  const p = StopSessionParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }

  const [existing] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, p.data.id));
  if (!existing) { res.status(404).json({ error: "Session not found" }); return; }
  if (!ownsSession(req, existing)) { res.status(404).json({ error: "Session not found" }); return; }

  const durationHours = (Date.now() - existing.started_at.getTime()) / 3600000;
  const station = await getStationForSession(existing.station_id);
  const pricePerKwh = (station as { price_per_kwh?: number })?.price_per_kwh ?? 2000;
  const powerKw = (station as { power_kw?: number })?.power_kw ?? 50;
  const energyKwh = parseFloat((powerKw * durationHours).toFixed(2));
  const cost = parseFloat((energyKwh * pricePerKwh).toFixed(2));

  const [session] = await db
    .update(sessionsTable)
    .set({
      status: "completed",
      ended_at: new Date(),
      energy_kwh: energyKwh,
      cost,
    })
    .where(eq(sessionsTable.id, p.data.id))
    .returning();

  // Free the station
  await db.update(stationsTable)
    .set({ status: "free", updated_at: new Date() })
    .where(eq(stationsTable.id, existing.station_id));

  // Free the individual connector if linked
  if (existing.connector_id) {
    await db.update(connectorsTable)
      .set({ status: "free", current_session_id: null, updated_at: new Date() })
      .where(eq(connectorsTable.id, existing.connector_id));
  }

  const stationName = (station as { name?: string })?.name ?? "";

  // Уведомления не должны задерживать ответ: человек уже нажал «Стоп» и ждёт
  // экран с чеком. Отправляем следом, ошибки гасятся внутри notifyUser.
  res.json({ ...session, station });

  if (existing.user_id) {
    void notifyUser(existing.user_id, "session_ended", {
      station: stationName,
      energy: energyKwh.toFixed(1),
      cost: `${Math.round(cost).toLocaleString("ru-RU")} сум`,
    }, { sessionId: session?.id });
  }

  // Тем, кто ждал этот коннектор, — что он освободился. Подписки снимаются
  // внутри: она одноразовая, иначе человек получал бы уведомление при каждом
  // освобождении этой станции.
  if (existing.connector_id) {
    void notifyConnectorWatchers(existing.connector_id, stationName);
  }
});

export default router;
