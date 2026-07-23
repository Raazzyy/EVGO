import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, count, sum, gte, lte, and, sql } from "drizzle-orm";
import { db, stationsTable, sessionsTable, usersTable, operatorsTable, adminUsersTable, vehiclesTable } from "@workspace/db";
import { AdminLoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

// ── Token helpers ──────────────────────────────────────────────────────────────
const JWT_SECRET = (): string =>
  process.env.ADMIN_JWT_SECRET ?? "ion_admin_fallback_dev_secret_change_me";

function signToken(email: string): string {
  const payload = Buffer.from(`${email}:${Date.now()}`).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", JWT_SECRET()).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
    const [email] = Buffer.from(payload, "base64url").toString().split(":");
    return email ?? null;
  } catch {
    return null;
  }
}

// ── Auth middleware ────────────────────────────────────────────────────────────
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"] ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ── Login ─────────────────────────────────────────────────────────────────────
router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email, password } = parsed.data;

  const masterEmail = process.env.ADMIN_EMAIL;
  const masterPass  = process.env.ADMIN_PASSWORD;

  if (masterEmail && masterPass) {
    if (email === masterEmail && password === masterPass) {
      res.json({ token: signToken(email), email });
      return;
    }
  }

  const [admin] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.email, email));

  if (!admin || admin.password_hash !== password) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }

  res.json({ token: signToken(admin.email), email: admin.email });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/admin/dashboard", adminAuth, async (_req, res): Promise<void> => {
  const [stationStats]   = await db.select({ total: count() }).from(stationsTable);
  const freeStations     = await db.select({ count: count() }).from(stationsTable).where(eq(stationsTable.status, "free"));
  const occupiedStations = await db.select({ count: count() }).from(stationsTable).where(eq(stationsTable.status, "occupied"));
  const offlineStations  = await db.select({ count: count() }).from(stationsTable).where(eq(stationsTable.status, "offline"));
  const activeSessions   = await db.select({ count: count() }).from(sessionsTable).where(eq(sessionsTable.status, "active"));
  const totalSessions    = await db.select({ count: count() }).from(sessionsTable);
  const [totalUsers]     = await db.select({ count: count() }).from(usersTable);
  const [revenue]        = await db.select({ total: sum(sessionsTable.cost) }).from(sessionsTable).where(eq(sessionsTable.status, "completed"));

  const topOperators = await db
    .select({ id: operatorsTable.id, name: operatorsTable.name, logo_url: operatorsTable.logo_url, station_count: count(stationsTable.id) })
    .from(operatorsTable)
    .leftJoin(stationsTable, eq(stationsTable.operator_id, operatorsTable.id))
    .groupBy(operatorsTable.id)
    .limit(5);

  res.json({
    total_stations:    stationStats?.total ?? 0,
    free_stations:     freeStations[0]?.count ?? 0,
    occupied_stations: occupiedStations[0]?.count ?? 0,
    offline_stations:  offlineStations[0]?.count ?? 0,
    active_sessions:   activeSessions[0]?.count ?? 0,
    total_sessions:    totalSessions[0]?.count ?? 0,
    total_users:       totalUsers?.count ?? 0,
    total_revenue:     parseFloat(String(revenue?.total ?? 0)),
    revenue_today:     0,
    sessions_today:    totalSessions[0]?.count ?? 0,
    top_operators:     topOperators.map(o => ({ ...o, station_count: Number(o.station_count) })),
  });
});

// ── Finance summary ───────────────────────────────────────────────────────────
// GET /api/admin/finance?period=day|week|month|custom&from=ISO&to=ISO
router.get("/admin/finance", adminAuth, async (req, res): Promise<void> => {
  const period = (req.query.period as string) ?? "month";
  const now = new Date();

  let fromDate: Date;
  let toDate: Date = now;

  if (period === "custom") {
    const fromStr = req.query.from as string | undefined;
    const toStr   = req.query.to   as string | undefined;
    if (!fromStr || !toStr) {
      res.status(400).json({ error: "custom period requires from and to ISO dates" });
      return;
    }
    fromDate = new Date(fromStr);
    toDate   = new Date(toStr);
  } else if (period === "day") {
    fromDate = new Date(now); fromDate.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    fromDate = new Date(now); fromDate.setDate(now.getDate() - 7);
  } else {
    // month (default)
    fromDate = new Date(now); fromDate.setDate(now.getDate() - 30);
  }

  // ── Core aggregates from sessions ─────────────────────────────────────────
  const [agg] = await db
    .select({
      total_revenue:   sum(sessionsTable.cost),
      total_kwh:       sum(sessionsTable.energy_kwh),
      session_count:   count(),
      unique_users:    sql<number>`cast(count(distinct ${sessionsTable.user_id}) as int)`,
    })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.status, "completed"),
        gte(sessionsTable.started_at, fromDate),
        lte(sessionsTable.started_at, toDate),
      )
    );

  const totalRevenue  = parseFloat(String(agg?.total_revenue  ?? 0));
  const totalKwh      = parseFloat(String(agg?.total_kwh      ?? 0));
  const sessionCount  = Number(agg?.session_count ?? 0);
  const avgCheck      = sessionCount > 0 ? totalRevenue / sessionCount : 0;

  // ── Daily time-series (revenue + sessions per day) ─────────────────────────
  const dailyRows = await db
    .select({
      day:     sql<string>`to_char(date_trunc('day', ${sessionsTable.started_at}), 'YYYY-MM-DD')`,
      revenue: sum(sessionsTable.cost),
      kwh:     sum(sessionsTable.energy_kwh),
      sessions: count(),
    })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.status, "completed"),
        gte(sessionsTable.started_at, fromDate),
        lte(sessionsTable.started_at, toDate),
      )
    )
    .groupBy(sql`date_trunc('day', ${sessionsTable.started_at})`)
    .orderBy(sql`date_trunc('day', ${sessionsTable.started_at})`);

  // ── Top-20 stations by revenue ─────────────────────────────────────────────
  const topStations = await db
    .select({
      station_id: sessionsTable.station_id,
      name:       stationsTable.name,
      revenue:    sum(sessionsTable.cost),
      sessions:   count(),
      kwh:        sum(sessionsTable.energy_kwh),
    })
    .from(sessionsTable)
    .leftJoin(stationsTable, eq(stationsTable.id, sessionsTable.station_id))
    .where(
      and(
        eq(sessionsTable.status, "completed"),
        gte(sessionsTable.started_at, fromDate),
        lte(sessionsTable.started_at, toDate),
      )
    )
    .groupBy(sessionsTable.station_id, stationsTable.name)
    .orderBy(sql`sum(${sessionsTable.cost}) desc nulls last`)
    .limit(20);

  // ── Top-10 vehicle models by connector type ────────────────────────────────
  const topVehicles = await db
    .select({
      connector_type: vehiclesTable.connector_type,
      count:          count(),
    })
    .from(vehiclesTable)
    .groupBy(vehiclesTable.connector_type)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // ── Connector split from sessions ──────────────────────────────────────────
  const connectorSplit = await db
    .select({
      connector_type: sessionsTable.connector_type,
      sessions:       count(),
      revenue:        sum(sessionsTable.cost),
    })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.status, "completed"),
        gte(sessionsTable.started_at, fromDate),
        lte(sessionsTable.started_at, toDate),
      )
    )
    .groupBy(sessionsTable.connector_type)
    .orderBy(sql`count(*) desc`);

  res.json({
    period,
    from: fromDate.toISOString(),
    to:   toDate.toISOString(),
    summary: {
      total_revenue:  Math.round(totalRevenue),
      total_kwh:      Math.round(totalKwh * 10) / 10,
      session_count:  sessionCount,
      avg_check:      Math.round(avgCheck),
      unique_users:   Number(agg?.unique_users ?? 0),
    },
    daily: dailyRows.map(r => ({
      day:      r.day,
      revenue:  Math.round(parseFloat(String(r.revenue ?? 0))),
      kwh:      Math.round(parseFloat(String(r.kwh ?? 0)) * 10) / 10,
      sessions: Number(r.sessions),
    })),
    top_stations: topStations.map(s => ({
      station_id: s.station_id,
      name:       s.name ?? "Unknown",
      revenue:    Math.round(parseFloat(String(s.revenue ?? 0))),
      sessions:   Number(s.sessions),
      kwh:        Math.round(parseFloat(String(s.kwh ?? 0)) * 10) / 10,
    })),
    top_vehicles:    topVehicles.map(v => ({ connector_type: v.connector_type, count: Number(v.count) })),
    connector_split: connectorSplit.map(c => ({
      connector_type: c.connector_type ?? "unknown",
      sessions:       Number(c.sessions),
      revenue:        Math.round(parseFloat(String(c.revenue ?? 0))),
    })),
  });
});

export default router;
