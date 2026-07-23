import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, favoritesTable, stationsTable } from "@workspace/db";

const router: IRouter = Router();

// GET /favorites?user_id=…  — list favorites with full station data
router.get("/favorites", async (req, res): Promise<void> => {
  const user_id = (req.query.user_id as string | undefined)?.trim();
  if (!user_id) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }
  const rows = await db
    .select({
      favorite_id: favoritesTable.id,
      created_at: favoritesTable.created_at,
      station: stationsTable,
    })
    .from(favoritesTable)
    .innerJoin(stationsTable, eq(favoritesTable.station_id, stationsTable.id))
    .where(eq(favoritesTable.user_id, user_id))
    .orderBy(favoritesTable.created_at);

  res.json(rows.map(r => ({ ...r.station, favorite_id: r.favorite_id })));
});

// POST /favorites  { user_id, station_id }  — add favorite (idempotent)
router.post("/favorites", async (req, res): Promise<void> => {
  const { user_id, station_id } = req.body ?? {};
  if (!user_id || !station_id) {
    res.status(400).json({ error: "user_id and station_id are required" });
    return;
  }
  try {
    const [row] = await db
      .insert(favoritesTable)
      .values({ user_id: String(user_id), station_id: Number(station_id) })
      .onConflictDoNothing()
      .returning();
    res.status(201).json(row ?? { user_id, station_id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Insert failed" });
  }
});

// DELETE /favorites/:station_id?user_id=…  — remove favorite
router.delete("/favorites/:station_id", async (req, res): Promise<void> => {
  const station_id = Number(req.params.station_id);
  const user_id = (req.query.user_id as string | undefined)?.trim();
  if (!user_id || isNaN(station_id)) {
    res.status(400).json({ error: "user_id and valid station_id are required" });
    return;
  }
  await db
    .delete(favoritesTable)
    .where(and(eq(favoritesTable.user_id, user_id), eq(favoritesTable.station_id, station_id)));
  res.sendStatus(204);
});

export default router;
