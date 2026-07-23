import { Router, type IRouter } from "express";
import { eq, ilike, and } from "drizzle-orm";
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

// ── API Ninjas electricvehicle type ──────────────────────────────────────
interface ApiNinjasEV {
  make: string;
  model: string;
  year?: number;
  range?: number;                       // miles (electricvehicle endpoint)
  battery_capacity?: number | string;   // kWh — OR premium-gate string on basic plan
}

/**
 * Safely extract a numeric battery capacity from the API response.
 * Falls back to the VEHICLE_OVERRIDES table, then to a class-based estimate.
 * Returns { kwh, estimated } so callers know whether the value is real.
 */
function parseBatteryCapacity(
  raw: number | string | undefined,
  vehicleName: string,
): { kwh: number; estimated: boolean } {
  // 1. API returned a real number
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return { kwh: raw, estimated: false };
  }
  // 2. Check override table (covers all common UZ-market models)
  const lower = vehicleName.toLowerCase();
  let bestKey = "";
  let bestOverride: typeof VEHICLE_OVERRIDES[string] | null = null;
  for (const [pattern, override] of Object.entries(VEHICLE_OVERRIDES)) {
    if (lower.includes(pattern) && pattern.length > bestKey.length) {
      bestKey = pattern;
      bestOverride = override;
    }
  }
  if (bestOverride) return { kwh: bestOverride.battery_kwh, estimated: false };
  // 3. Class-based fallback (premium-gate or unknown model)
  return { kwh: 60, estimated: true };
}

// ── Popular vehicles list (built from VEHICLE_OVERRIDES, grouped by make) ─
// GET /vehicles/popular
const POPULAR_MAKES = ["BYD", "Hyundai", "Kia", "Tesla", "Chevrolet", "Volkswagen",
  "Nissan", "BMW", "Audi", "Porsche", "Mercedes-Benz", "Volvo", "Polestar", "Mitsubishi"];

function buildPopularList() {
  const list: Array<{ name: string; battery_kwh: number; range_km: number; connector_type: string; current_battery_pct: null }> = [];
  for (const [pattern, specs] of Object.entries(VEHICLE_OVERRIDES)) {
    // Only use entries with a specific model (not catch-alls like "volkswagen id.")
    if (!pattern.includes(" ") || pattern.endsWith(".")) continue;
    const words = pattern.split(" ");
    const make = words[0][0].toUpperCase() + words[0].slice(1);
    const model = words.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    // map known lowercase make prefixes → proper display names
    const makeDisplay =
      make === "Byd" ? "BYD"
      : make === "Mercedes-benz" ? "Mercedes-Benz"
      : make;
    list.push({
      name: `${makeDisplay} ${model}`,
      battery_kwh: specs.battery_kwh,
      range_km: specs.range_km ?? 300,
      connector_type: specs.connector_type,
      current_battery_pct: null,
    });
  }
  return list;
}

router.get("/vehicles/popular", (_req, res): void => {
  const list = buildPopularList();
  // Group by make for the client
  const byMake: Record<string, typeof list> = {};
  for (const v of list) {
    const make = v.name.split(" ")[0];
    if (!byMake[make]) byMake[make] = [];
    byMake[make].push(v);
  }
  // Sort makes by POPULAR_MAKES order
  const sorted = POPULAR_MAKES
    .filter(m => byMake[m])
    .map(make => ({ make, vehicles: byMake[make] }));
  // Append any makes not in POPULAR_MAKES
  for (const [make, vehicles] of Object.entries(byMake)) {
    if (!POPULAR_MAKES.includes(make)) sorted.push({ make, vehicles });
  }
  res.json(sorted);
});

// ── Search helpers ────────────────────────────────────────────────────────

/**
 * Search local DB with AND logic: every word in the query must appear
 * somewhere in the vehicle name (case-insensitive).
 */
async function searchLocalDB(words: string[]) {
  if (words.length === 0) return [];
  const conditions = words.map(w => ilike(vehiclesTable.name, `%${w}%`));
  return db
    .select()
    .from(vehiclesTable)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions));
}

/**
 * Search VEHICLE_OVERRIDES (openev-quality in-memory data).
 * Returns synthetic vehicle objects for any pattern where every query word
 * appears in the pattern, OR where the pattern appears as a substring of the query.
 */
function searchOverrides(words: string[]): Array<{
  name: string; battery_kwh: number; range_km: number;
  connector_type: string; current_battery_pct: null;
}> {
  const results = [];
  for (const [pattern, specs] of Object.entries(VEHICLE_OVERRIDES)) {
    // Every word must appear in the pattern, OR the whole query is a substring of pattern
    const allWordsInPattern = words.every(w => pattern.includes(w));
    if (!allWordsInPattern) continue;
    // Build display name from pattern
    const pw = pattern.split(" ");
    const make0 = pw[0][0].toUpperCase() + pw[0].slice(1);
    const makeDisplay =
      make0 === "Byd" ? "BYD" : make0 === "Mercedes-benz" ? "Mercedes-Benz" : make0;
    const model = pw.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    results.push({
      name: `${makeDisplay} ${model}`,
      battery_kwh: specs.battery_kwh,
      range_km: specs.range_km ?? 300,
      connector_type: specs.connector_type,
      current_battery_pct: null as null,
    });
  }
  return results;
}

/**
 * Fetch from API Ninjas /v1/electricvehicle.
 * For a multi-word query like "BYD Han" we try:
 *   - make=BYD  model=Han   (first word / rest split)
 *   - make=BYD Han           (whole string as make)
 *   - model=BYD Han          (whole string as model)
 * Returns raw de-duped ApiNinjasEV records (not yet mapped or persisted).
 */
async function fetchApiNinjas(q: string, words: string[]): Promise<ApiNinjasEV[]> {
  const apiKey = process.env.EV_API_KEY;
  if (!apiKey) {
    console.warn("[vehicles/search] EV_API_KEY not set — skipping API Ninjas");
    return [];
  }
  const base = "https://api.api-ninjas.com/v1/electricvehicle";
  const hdrs = { "X-Api-Key": apiKey };
  const timeout = { signal: AbortSignal.timeout(5000) };

  // Build request URLs
  const urls: string[] = [
    `${base}?make=${encodeURIComponent(q)}&limit=30`,
    `${base}?model=${encodeURIComponent(q)}&limit=30`,
  ];
  if (words.length >= 2) {
    const make  = words[0];
    const model = words.slice(1).join(" ");
    urls.push(`${base}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&limit=30`);
  }

  const results = await Promise.allSettled(
    urls.map(url => fetch(url, { ...timeout, headers: hdrs }))
  );

  const raw: ApiNinjasEV[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      const json = await r.value.json() as ApiNinjasEV[];
      if (Array.isArray(json)) raw.push(...json);
    }
  }

  // Deduplicate by "make model" (ignore year)
  const seen = new Set<string>();
  return raw.filter(v => {
    const key = `${v.make} ${v.model}`.toLowerCase().trim();
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

/**
 * Upsert a list of API Ninjas records into the DB cache.
 * Returns the persisted rows (either newly inserted or updated).
 */
async function upsertApiRows(
  mapped: Array<{ name: string; battery_kwh: number; range_km: number; connector_type: "CCS2" | "CHAdeMO" | "Type2" | "GB-T"; current_battery_pct: number | null }>
): Promise<(typeof vehiclesTable.$inferSelect)[]> {
  const rows: (typeof vehiclesTable.$inferSelect)[] = [];
  for (const v of mapped) {
    const existing = await db
      .select()
      .from(vehiclesTable)
      .where(ilike(vehiclesTable.name, v.name));
    if (existing.length === 0) {
      const [row] = await db.insert(vehiclesTable).values(v).returning();
      rows.push(row);
    } else {
      const cur = existing[0];
      if (cur.battery_kwh !== v.battery_kwh || cur.connector_type !== v.connector_type) {
        const [updated] = await db
          .update(vehiclesTable)
          .set({ battery_kwh: v.battery_kwh, connector_type: v.connector_type, range_km: v.range_km })
          .where(eq(vehiclesTable.id, cur.id))
          .returning();
        rows.push(updated);
      } else {
        rows.push(cur);
      }
    }
  }
  return rows;
}

// ── Search endpoint ───────────────────────────────────────────────────────
// GET /vehicles/search?q=
//
// Priority of data sources (highest quality first):
//   1. VEHICLE_OVERRIDES (in-memory, openev-quality — exact battery/connector data)
//   2. Local DB cache   (previously fetched from API Ninjas and persisted)
//   3. Live API Ninjas  (only called when local sources return nothing)
//
// Multi-word queries ("BYD Han") are split so each word must appear in the name
// AND the API is called with a proper make/model split, not the full string as make.
router.get("/vehicles/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);

  try {
    // ── 1. Local sources (parallel) ────────────────────────────────────────
    const [localRows, overrideHits] = await Promise.all([
      searchLocalDB(words),
      Promise.resolve(searchOverrides(words)),
    ]);
    console.log(`[vehicles/search] q="${q}" — local DB: ${localRows.length}, overrides: ${overrideHits.length}`);

    // ── 2. Live API — only if both local sources are empty ─────────────────
    let apiPersistedRows: (typeof vehiclesTable.$inferSelect)[] = [];
    if (localRows.length === 0 && overrideHits.length === 0) {
      const rawApi = await fetchApiNinjas(q, words);
      console.log(`[vehicles/search] API Ninjas raw: ${rawApi.length} records`);

      if (rawApi.length > 0) {
        const mapped = rawApi.map(v => {
          const name = `${v.make} ${v.model}`;
          const { kwh } = parseBatteryCapacity(v.battery_capacity, name);
          const base = {
            name,
            battery_kwh:         kwh,
            range_km:            Math.round((v.range ?? 300) * 1.609),
            connector_type:      "CCS2" as "CCS2" | "CHAdeMO" | "Type2" | "GB-T",
            current_battery_pct: null as number | null,
          };
          return applyOverride(base);
        });
        apiPersistedRows = await upsertApiRows(mapped);
        console.log(`[vehicles/search] persisted ${apiPersistedRows.length} rows from API`);
      }
    } else {
      console.log(`[vehicles/search] local data found — skipping API Ninjas`);
    }

    // ── 3. Merge: overrides > localDB > liveAPI; deduplicate by name ───────
    // Convert override hits to the same shape as DB rows for uniform handling
    const overrideAsRows = overrideHits.map(o => ({
      id:                  -1 as unknown as number,
      name:                o.name,
      battery_kwh:         o.battery_kwh,
      range_km:            o.range_km,
      connector_type:      o.connector_type as "CCS2" | "CHAdeMO" | "Type2" | "GB-T",
      current_battery_pct: null as number | null,
    }));

    const seen = new Set<string>();
    const merged: typeof overrideAsRows = [];

    for (const v of [...overrideAsRows, ...localRows, ...apiPersistedRows]) {
      const key = v.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(v);
      }
    }

    // Apply overrides one final time to ensure connector/battery are correct
    const result = merged.map(v =>
      applyOverride({ ...v, range_km: v.range_km ?? 300 })
    );

    console.log(
      `[vehicles/search] final: ${result.length} unique ` +
      `(${overrideHits.length} overrides, ${localRows.length} local DB, ${apiPersistedRows.length} live API)`
    );

    res.json(result);
  } catch (err: any) {
    console.error("[vehicles/search] unexpected error:", err?.message ?? err);
    res.status(500).json({ error: "Search failed" });
  }
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
