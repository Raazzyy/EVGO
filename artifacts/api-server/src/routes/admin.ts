import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, count, sum } from "drizzle-orm";
import { db, stationsTable, sessionsTable, usersTable, operatorsTable, adminUsersTable } from "@workspace/db";
import { AdminLoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

// ── Token helpers ──────────────────────────────────────────────────────────────
// Token format: base64(email + ":" + issuedAtMs) + "." + hmac
// No JWT library needed — Node's built-in crypto is enough for an MVP admin panel.

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
    // Constant-time compare to prevent timing attacks
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

  // 1. Master credentials from environment (highest priority — changeable via secrets)
  const masterEmail = process.env.ADMIN_EMAIL;
  const masterPass  = process.env.ADMIN_PASSWORD;

  if (masterEmail && masterPass) {
    if (email === masterEmail && password === masterPass) {
      res.json({ token: signToken(email), email });
      return;
    }
  }

  // 2. DB fallback — admin_users table (legacy / additional accounts)
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
  const [stationStats] = await db.select({ total: count() }).from(stationsTable);
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

export default router;
