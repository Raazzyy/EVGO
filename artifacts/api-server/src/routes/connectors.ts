import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, connectorsTable, connectorWatchersTable, stationsTable, sessionsTable } from "@workspace/db";

import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Бронь и отслеживание коннектора привязаны к владельцу из токена: раньше
// user_id приходил в запросе, и чужую бронь можно было снять, подставив
// чужой идентификатор.

// ── GET /connectors?station_id=N ─────────────────────────────────────────────
router.get("/connectors", async (req, res): Promise<void> => {
  const stationId = parseInt(req.query.station_id as string, 10);
  if (isNaN(stationId)) { res.status(400).json({ error: "station_id required" }); return; }

  const now = new Date();
  const rows = await db.select().from(connectorsTable)
    .where(eq(connectorsTable.station_id, stationId))
    .orderBy(connectorsTable.label);

  // Expire stale reservations lazily
  for (const c of rows) {
    if (c.status === "reserved" && c.reserved_until && c.reserved_until < now) {
      await db.update(connectorsTable)
        .set({ status: "free", reserved_by_user_id: null, reserved_until: null, updated_at: now })
        .where(eq(connectorsTable.id, c.id));
      c.status = "free";
      c.reserved_by_user_id = null;
      c.reserved_until = null;
    }
  }

  res.json(rows);
});

// ── POST /connectors/:id/reserve ─────────────────────────────────────────────
router.post<{ id: string }>("/connectors/:id/reserve", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid connector id" }); return; }

  const user_id = req.userId as string;

  const [connector] = await db.select().from(connectorsTable).where(eq(connectorsTable.id, id));
  if (!connector) { res.status(404).json({ error: "Connector not found" }); return; }

  const now = new Date();

  // Check if reservation expired (lazy cleanup)
  if (connector.status === "reserved" && connector.reserved_until && connector.reserved_until < now) {
    await db.update(connectorsTable)
      .set({ status: "free", reserved_by_user_id: null, reserved_until: null, updated_at: now })
      .where(eq(connectorsTable.id, id));
    connector.status = "free";
  }

  if (connector.status !== "free") {
    res.status(409).json({ error: "Connector is not available for reservation" }); return;
  }

  // Check station supports_reservation
  const [station] = await db.select().from(stationsTable).where(eq(stationsTable.id, connector.station_id));
  if (!station?.supports_reservation) {
    res.status(400).json({ error: "Station does not support reservations" }); return;
  }

  const reservedUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  const [updated] = await db.update(connectorsTable)
    .set({
      status: "reserved",
      reserved_by_user_id: user_id,
      reserved_until: reservedUntil,
      updated_at: now,
    })
    .where(eq(connectorsTable.id, id))
    .returning();

  res.status(201).json({
    ...updated,
    reservation_cost: 5000, // mock cost in UZS
    expires_at: reservedUntil.toISOString(),
  });
});

// ── DELETE /connectors/:id/reserve ───────────────────────────────────────────
router.delete<{ id: string }>("/connectors/:id/reserve", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid connector id" }); return; }

  const user_id = req.userId as string;

  const [connector] = await db.select().from(connectorsTable).where(eq(connectorsTable.id, id));
  if (!connector) { res.status(404).json({ error: "Connector not found" }); return; }
  if (connector.reserved_by_user_id !== user_id) {
    res.status(403).json({ error: "You did not reserve this connector" }); return;
  }

  await db.update(connectorsTable)
    .set({ status: "free", reserved_by_user_id: null, reserved_until: null, updated_at: new Date() })
    .where(eq(connectorsTable.id, id));

  res.sendStatus(204);
});

// ── POST /connector-watchers ─────────────────────────────────────────────────
router.post("/connector-watchers", requireAuth, async (req, res): Promise<void> => {
  const user_id = req.userId as string;
  const { connector_id } = req.body ?? {};
  if (!connector_id) { res.status(400).json({ error: "connector_id required" }); return; }

  // Upsert — ignore duplicate
  const existing = await db.select().from(connectorWatchersTable)
    .where(and(
      eq(connectorWatchersTable.user_id, user_id),
      eq(connectorWatchersTable.connector_id, connector_id),
    ));

  if (existing.length > 0) { res.status(200).json(existing[0]); return; }

  const [row] = await db.insert(connectorWatchersTable)
    .values({ user_id, connector_id })
    .returning();

  res.status(201).json(row);
});

// ── DELETE /connector-watchers ───────────────────────────────────────────────
router.delete("/connector-watchers", requireAuth, async (req, res): Promise<void> => {
  const user_id = req.userId as string;
  const connector_id = parseInt(req.query.connector_id as string, 10);
  if (isNaN(connector_id)) { res.status(400).json({ error: "connector_id required" }); return; }

  await db.delete(connectorWatchersTable)
    .where(and(
      eq(connectorWatchersTable.user_id, user_id),
      eq(connectorWatchersTable.connector_id, connector_id),
    ));

  res.sendStatus(204);
});

// ── GET /connector-watchers?user_id=&connector_id= ──────────────────────────
router.get("/connector-watchers", requireAuth, async (req, res): Promise<void> => {
  const user_id = req.userId as string;
  const connector_id = parseInt(req.query.connector_id as string, 10);

  if (isNaN(connector_id)) { res.status(400).json({ error: "connector_id required" }); return; }

  const rows = await db.select().from(connectorWatchersTable)
    .where(and(
      eq(connectorWatchersTable.user_id, user_id),
      eq(connectorWatchersTable.connector_id, connector_id),
    ));

  res.json({ watching: rows.length > 0 });
});

export default router;
