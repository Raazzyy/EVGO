import { Router, type IRouter } from "express";
import { eq, count, sum } from "drizzle-orm";
import { db, stationsTable, sessionsTable, usersTable, operatorsTable, adminUsersTable } from "@workspace/db";
import { AdminLoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [admin] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, parsed.data.email));
  // Simple password check (in production, use bcrypt)
  if (!admin || admin.password_hash !== parsed.data.password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = `admin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  res.json({ token, email: admin.email });
});

router.get("/admin/dashboard", async (_req, res): Promise<void> => {
  const [stationStats] = await db
    .select({
      total: count(),
    })
    .from(stationsTable);

  const freeStations = await db.select({ count: count() }).from(stationsTable).where(eq(stationsTable.status, "free"));
  const occupiedStations = await db.select({ count: count() }).from(stationsTable).where(eq(stationsTable.status, "occupied"));
  const offlineStations = await db.select({ count: count() }).from(stationsTable).where(eq(stationsTable.status, "offline"));

  const activeSessions = await db.select({ count: count() }).from(sessionsTable).where(eq(sessionsTable.status, "active"));
  const totalSessions = await db.select({ count: count() }).from(sessionsTable);

  const [totalUsers] = await db.select({ count: count() }).from(usersTable);

  const [revenue] = await db.select({ total: sum(sessionsTable.cost) }).from(sessionsTable).where(eq(sessionsTable.status, "completed"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySessions = await db.select({ count: count() }).from(sessionsTable);
  const todayRevenue = await db.select({ total: sum(sessionsTable.cost) }).from(sessionsTable).where(eq(sessionsTable.status, "completed"));

  const topOperators = await db
    .select({
      id: operatorsTable.id,
      name: operatorsTable.name,
      logo_url: operatorsTable.logo_url,
      station_count: count(stationsTable.id),
    })
    .from(operatorsTable)
    .leftJoin(stationsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .groupBy(operatorsTable.id)
    .limit(5);

  res.json({
    total_stations: stationStats?.total ?? 0,
    free_stations: freeStations[0]?.count ?? 0,
    occupied_stations: occupiedStations[0]?.count ?? 0,
    offline_stations: offlineStations[0]?.count ?? 0,
    active_sessions: activeSessions[0]?.count ?? 0,
    total_sessions: totalSessions[0]?.count ?? 0,
    total_users: totalUsers?.count ?? 0,
    total_revenue: parseFloat(String(revenue?.total ?? 0)),
    revenue_today: parseFloat(String(todayRevenue[0]?.total ?? 0)),
    sessions_today: todaySessions[0]?.count ?? 0,
    top_operators: topOperators.map(o => ({ ...o, station_count: Number(o.station_count) })),
  });
});

export default router;
