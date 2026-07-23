import { Router, type IRouter } from "express";
import { eq, ilike } from "drizzle-orm";
import { db, vehiclesTable } from "@workspace/db";
import {
  CreateVehicleBody,
  UpdateVehicleBody,
  GetVehicleParams,
  UpdateVehicleParams,
  DeleteVehicleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Override table ────────────────────────────────────────────────────────
// API Ninjas basic plan omits battery_kwh and connector_type.
// This table patches those values for models common in the UZ market.
// Match is substring of lowercased "make model" name.
const VEHICLE_OVERRIDES: Record<string, { battery_kwh: number; connector_type: string; range_km?: number }> = {
  // ── BYD ──────────────────────────────────────────────────────────────
  "byd atto 3":  { battery_kwh: 60.5, connector_type: "CCS2",  range_km: 480 },
  "byd han":     { battery_kwh: 85.4, connector_type: "CCS2",  range_km: 605 },
  "byd tang":    { battery_kwh: 86.4, connector_type: "CCS2",  range_km: 505 },
  "byd dolphin": { battery_kwh: 60.4, connector_type: "CCS2",  range_km: 427 },
  "byd seal":    { battery_kwh: 82.5, connector_type: "CCS2",  range_km: 570 },
  "byd song":    { battery_kwh: 87.3, connector_type: "CCS2",  range_km: 500 },
  "byd yuan":    { battery_kwh: 50.1, connector_type: "CCS2",  range_km: 401 },
  "byd seagull": { battery_kwh: 38.8, connector_type: "GB-T",  range_km: 405 },
  "byd e2":      { battery_kwh: 40.5, connector_type: "GB-T",  range_km: 405 },
  // ── Hyundai ──────────────────────────────────────────────────────────
  "hyundai ioniq 5": { battery_kwh: 77.4, connector_type: "CCS2", range_km: 507 },
  "hyundai ioniq 6": { battery_kwh: 77.4, connector_type: "CCS2", range_km: 614 },
  "hyundai ioniq":   { battery_kwh: 38.3, connector_type: "CCS2", range_km: 311 },
  "hyundai kona":    { battery_kwh: 64.8, connector_type: "CCS2", range_km: 514 },
  // ── Kia ──────────────────────────────────────────────────────────────
  "kia ev6":  { battery_kwh: 77.4, connector_type: "CCS2", range_km: 528 },
  "kia ev9":  { battery_kwh: 99.8, connector_type: "CCS2", range_km: 541 },
  "kia niro": { battery_kwh: 64.8, connector_type: "CCS2", range_km: 463 },
  "kia soul": { battery_kwh: 64.0, connector_type: "CCS2", range_km: 452 },
  // ── Tesla ─────────────────────────────────────────────────────────────
  "tesla model 3": { battery_kwh: 82.0, connector_type: "CCS2", range_km: 576 },
  "tesla model y": { battery_kwh: 82.0, connector_type: "CCS2", range_km: 533 },
  "tesla model s": { battery_kwh: 100,  connector_type: "CCS2", range_km: 652 },
  "tesla model x": { battery_kwh: 100,  connector_type: "CCS2", range_km: 576 },
  // ── Chevrolet ─────────────────────────────────────────────────────────
  "chevrolet bolt": { battery_kwh: 65, connector_type: "CCS2", range_km: 417 },
  // ── Volkswagen ────────────────────────────────────────────────────────
  "volkswagen id.4": { battery_kwh: 77.0, connector_type: "CCS2", range_km: 528 },
  "volkswagen id.3": { battery_kwh: 58.0, connector_type: "CCS2", range_km: 426 },
  "volkswagen id.6": { battery_kwh: 84.8, connector_type: "CCS2", range_km: 588 },
  "volkswagen id.":  { battery_kwh: 77.0, connector_type: "CCS2" }, // catch-all for other ID.*
  // ── Audi ──────────────────────────────────────────────────────────────
  "audi e-tron":    { battery_kwh: 95,   connector_type: "CCS2", range_km: 436 },
  "audi q4 e-tron": { battery_kwh: 77,   connector_type: "CCS2", range_km: 520 },
  "audi q8 e-tron": { battery_kwh: 114,  connector_type: "CCS2", range_km: 582 },
  // ── Porsche ───────────────────────────────────────────────────────────
  "porsche taycan": { battery_kwh: 93.4, connector_type: "CCS2", range_km: 484 },
  // ── Mercedes-Benz ─────────────────────────────────────────────────────
  "mercedes-benz eqc": { battery_kwh: 80,    connector_type: "CCS2", range_km: 410 },
  "mercedes-benz eqs": { battery_kwh: 107.8, connector_type: "CCS2", range_km: 770 },
  "mercedes-benz eqa": { battery_kwh: 66.5,  connector_type: "CCS2", range_km: 426 },
  "mercedes-benz eqb": { battery_kwh: 66.5,  connector_type: "CCS2", range_km: 419 },
  // ── BMW ───────────────────────────────────────────────────────────────
  "bmw ix3": { battery_kwh: 80,    connector_type: "CCS2", range_km: 461 },
  "bmw i4":  { battery_kwh: 83.9,  connector_type: "CCS2", range_km: 590 },
  "bmw ix":  { battery_kwh: 111.5, connector_type: "CCS2", range_km: 630 },
  "bmw i3":  { battery_kwh: 42.2,  connector_type: "CCS2", range_km: 246 },
  // ── Nissan ────────────────────────────────────────────────────────────
  "nissan leaf":  { battery_kwh: 62,  connector_type: "CHAdeMO", range_km: 385 },
  "nissan ariya": { battery_kwh: 87,  connector_type: "CHAdeMO", range_km: 533 },
  // ── Mitsubishi ────────────────────────────────────────────────────────
  "mitsubishi outlander": { battery_kwh: 20,   connector_type: "CHAdeMO", range_km: 55 },
  "mitsubishi i-miev":    { battery_kwh: 16,   connector_type: "CHAdeMO", range_km: 150 },
  // ── Volvo ─────────────────────────────────────────────────────────────
  "volvo xc40 recharge": { battery_kwh: 82.0, connector_type: "CCS2", range_km: 418 },
  "volvo c40":           { battery_kwh: 82.0, connector_type: "CCS2", range_km: 438 },
  // ── Polestar ──────────────────────────────────────────────────────────
  "polestar 2": { battery_kwh: 82.0, connector_type: "CCS2", range_km: 551 },
  "polestar 3": { battery_kwh: 111,  connector_type: "CCS2", range_km: 561 },
};

/** Apply VEHICLE_OVERRIDES to a vehicle name, patching battery/connector/range. */
function applyOverride<T extends { name: string; battery_kwh: number; connector_type: string; range_km: number }>(v: T): T {
  const lower = v.name.toLowerCase();
  // Longest matching key wins (avoids "byd" matching before "byd dolphin")
  let bestKey = "";
  let bestOverride: typeof VEHICLE_OVERRIDES[string] | null = null;
  for (const [pattern, override] of Object.entries(VEHICLE_OVERRIDES)) {
    if (lower.includes(pattern) && pattern.length > bestKey.length) {
      bestKey    = pattern;
      bestOverride = override;
    }
  }
  if (!bestOverride) return v;
  return {
    ...v,
    battery_kwh:    bestOverride.battery_kwh,
    connector_type: bestOverride.connector_type,
    range_km:       bestOverride.range_km ?? v.range_km,
  };
}

// ── API Ninjas type ───────────────────────────────────────────────────────
interface ApiNinjasEV {
  make: string;
  model: string;
  year?: number;
  range?: number; // miles
}

// ── Search endpoint ───────────────────────────────────────────────────────
// GET /vehicles/search?q=
router.get("/vehicles/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  // 1. Pull cache — we'll merge with API results, not short-circuit
  const cached = await db
    .select()
    .from(vehiclesTable)
    .where(ilike(vehiclesTable.name, `%${q}%`));

  // 2. Always hit API Ninjas — parallel: search by model AND by make
  const apiKey = process.env.EV_API_KEY;
  const apiRows: (typeof vehiclesTable.$inferSelect)[] = [];

  if (apiKey) {
    try {
      const base = "https://api.api-ninjas.com/v1/cars";
      const headers = { "X-Api-Key": apiKey };

      const [byModel, byMake] = await Promise.allSettled([
        fetch(`${base}?model=${encodeURIComponent(q)}&fuel_type=electric&limit=10`, { headers, signal: AbortSignal.timeout(5000) }),
        fetch(`${base}?make=${encodeURIComponent(q)}&fuel_type=electric&limit=10`,  { headers, signal: AbortSignal.timeout(5000) }),
      ]);

      // Collect results from both calls
      const raw: ApiNinjasEV[] = [];
      for (const result of [byModel, byMake]) {
        if (result.status === "fulfilled" && result.value.ok) {
          const json = await result.value.json() as ApiNinjasEV[];
          if (Array.isArray(json)) raw.push(...json);
        }
      }

      // Dedupe by "make model year" across both queries
      const seen = new Set<string>();
      const deduped = raw.filter(v => {
        const key = `${v.make} ${v.model} ${v.year ?? ""}`.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Map to our schema, then apply overrides for real battery/connector data
      const mapped = deduped.map(v => {
        const base = {
          name:                `${v.make} ${v.model}`,
          battery_kwh:         60,         // API Ninjas basic: always missing
          range_km:            Math.round((v.range ?? 300) * 1.609),
          connector_type:      "CCS2" as const,
          current_battery_pct: null as number | null,
        };
        return applyOverride(base);
      });

      // Upsert into cache (insert new, skip existing; update specs if override differs)
      for (const v of mapped) {
        const existing = await db
          .select()
          .from(vehiclesTable)
          .where(ilike(vehiclesTable.name, v.name));

        if (existing.length === 0) {
          const [row] = await db.insert(vehiclesTable).values(v).returning();
          apiRows.push(row);
        } else {
          // Update cached row if override gives better spec data
          const cur = existing[0];
          if (
            cur.battery_kwh !== v.battery_kwh ||
            cur.connector_type !== v.connector_type
          ) {
            const [updated] = await db
              .update(vehiclesTable)
              .set({ battery_kwh: v.battery_kwh, connector_type: v.connector_type, range_km: v.range_km })
              .where(eq(vehiclesTable.id, cur.id))
              .returning();
            apiRows.push(updated);
          } else {
            apiRows.push(cur);
          }
        }
      }
    } catch (err: any) {
      console.error("[vehicles/search] API Ninjas error:", err?.message ?? err);
      // Fall through to cache-only
    }
  }

  // 3. Merge: API-sourced rows + cached rows not covered by API, apply overrides to all
  const apiNames = new Set(apiRows.map(v => v.name.toLowerCase()));
  const cacheOnly = cached.filter(v => !apiNames.has(v.name.toLowerCase()));
  const merged = [...apiRows, ...cacheOnly];

  // Apply overrides to cached rows too (in case they were stored with defaults)
  const result = merged.map(v => applyOverride({ ...v, range_km: v.range_km ?? 300 }));

  res.json(result);
});

// ── CRUD ──────────────────────────────────────────────────────────────────

router.get("/vehicles", async (_req, res): Promise<void> => {
  const rows = await db.select().from(vehiclesTable);
  res.json(rows);
});

router.post("/vehicles", async (req, res): Promise<void> => {
  const parsed = CreateVehicleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [v] = await db.insert(vehiclesTable).values(parsed.data).returning();
  res.status(201).json(v);
});

router.get("/vehicles/:id", async (req, res): Promise<void> => {
  const p = GetVehicleParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, p.data.id));
  if (!v) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.json(v);
});

router.put("/vehicles/:id", async (req, res): Promise<void> => {
  const p = UpdateVehicleParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = UpdateVehicleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [v] = await db.update(vehiclesTable).set(parsed.data).where(eq(vehiclesTable.id, p.data.id)).returning();
  if (!v) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.json(v);
});

router.delete("/vehicles/:id", async (req, res): Promise<void> => {
  const p = DeleteVehicleParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(vehiclesTable).where(eq(vehiclesTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
