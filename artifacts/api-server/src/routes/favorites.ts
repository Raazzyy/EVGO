import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, favoritesTable, stationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Владелец берётся из токена. Раньше `user_id` приходил в запросе, и подстановка
// чужого значения открывала чужое избранное.

// GET /favorites — избранные станции текущего пользователя
router.get("/favorites", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      favorite_id: favoritesTable.id,
      created_at: favoritesTable.created_at,
      station: stationsTable,
    })
    .from(favoritesTable)
    .innerJoin(stationsTable, eq(favoritesTable.station_id, stationsTable.id))
    .where(eq(favoritesTable.user_id, req.userId as string))
    .orderBy(favoritesTable.created_at);

  res.json(rows.map(r => ({ ...r.station, favorite_id: r.favorite_id })));
});

// POST /favorites  { station_id }
router.post("/favorites", requireAuth, async (req, res): Promise<void> => {
  const stationId = Number(req.body?.station_id);
  if (!Number.isInteger(stationId) || stationId <= 0) {
    res.status(400).json({ error: "station_id is required" });
    return;
  }

  const [row] = await db
    .insert(favoritesTable)
    .values({ user_id: req.userId as string, station_id: stationId })
    .onConflictDoNothing()
    .returning();

  // onConflictDoNothing возвращает пусто, если запись уже была — повторное
  // добавление в избранное не ошибка, отвечаем тем же результатом.
  res.status(201).json(row ?? { user_id: req.userId, station_id: stationId });
});

// DELETE /favorites/:station_id
router.delete("/favorites/:station_id", requireAuth, async (req, res): Promise<void> => {
  const stationId = Number(req.params.station_id);
  if (!Number.isInteger(stationId)) {
    res.status(400).json({ error: "valid station_id is required" });
    return;
  }

  await db
    .delete(favoritesTable)
    .where(and(
      eq(favoritesTable.user_id, req.userId as string),
      eq(favoritesTable.station_id, stationId),
    ));

  res.sendStatus(204);
});

export default router;
