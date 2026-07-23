import { Router, type IRouter } from "express";
import { eq, ilike, and, or, sql, count } from "drizzle-orm";
import { db, vehiclesTable, vehicleAliasesTable } from "@workspace/db";
import {
  CreateVehicleBody,
  UpdateVehicleBody,
  GetVehicleParams,
  UpdateVehicleParams,
  DeleteVehicleParams,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

// ── Override table ────────────────────────────────────────────────────────
const VEHICLE_OVERRIDES: Record<string, { battery_kwh: number; connector_type: string; range_km?: number }> = {
  "byd atto 3":  { battery_kwh: 60.5, connector_type: "CCS2",  range_km: 480 },
  "byd han":     { battery_kwh: 85.4, connector_type: "CCS2",  range_km: 605 },
  "byd tang":    { battery_kwh: 86.4, connector_type: "CCS2",  range_km: 505 },
  "byd dolphin": { battery_kwh: 60.4, connector_type: "CCS2",  range_km: 427 },
  "byd seal":    { battery_kwh: 82.5, connector_type: "CCS2",  range_km: 570 },
  "byd song":    { battery_kwh: 87.3, connector_type: "CCS2",  range_km: 500 },
  "byd yuan":    { battery_kwh: 50.1, connector_type: "CCS2",  range_km: 401 },
  "byd seagull": { battery_kwh: 38.8, connector_type: "GB-T",  range_km: 405 },
  "byd e2":      { battery_kwh: 40.5, connector_type: "GB-T",  range_km: 405 },
  "hyundai ioniq 5": { battery_kwh: 77.4, connector_type: "CCS2", range_km: 507 },
  "hyundai ioniq 6": { battery_kwh: 77.4, connector_type: "CCS2", range_km: 614 },
  "hyundai ioniq":   { battery_kwh: 38.3, connector_type: "CCS2", range_km: 311 },
  "hyundai kona":    { battery_kwh: 64.8, connector_type: "CCS2", range_km: 514 },
  "kia ev6":  { battery_kwh: 77.4, connector_type: "CCS2", range_km: 528 },
  "kia ev9":  { battery_kwh: 99.8, connector_type: "CCS2", range_km: 541 },
  "kia niro": { battery_kwh: 64.8, connector_type: "CCS2", range_km: 463 },
  "kia soul": { battery_kwh: 64.0, connector_type: "CCS2", range_km: 452 },
  "tesla model 3": { battery_kwh: 82.0, connector_type: "CCS2", range_km: 576 },
  "tesla model y": { battery_kwh: 82.0, connector_type: "CCS2", range_km: 533 },
  "tesla model s": { battery_kwh: 100,  connector_type: "CCS2", range_km: 652 },
  "tesla model x": { battery_kwh: 100,  connector_type: "CCS2", range_km: 576 },
  "chevrolet bolt": { battery_kwh: 65,   connector_type: "CCS2", range_km: 417 },
  "volkswagen id.4": { battery_kwh: 77.0, connector_type: "CCS2", range_km: 528 },
  "volkswagen id.3": { battery_kwh: 58.0, connector_type: "CCS2", range_km: 426 },
  "volkswagen id.6": { battery_kwh: 84.8, connector_type: "CCS2", range_km: 588 },
  "volkswagen id.":  { battery_kwh: 77.0, connector_type: "CCS2" },
  "audi e-tron":    { battery_kwh: 95,   connector_type: "CCS2", range_km: 436 },
  "audi q4 e-tron": { battery_kwh: 77,   connector_type: "CCS2", range_km: 520 },
  "audi q8 e-tron": { battery_kwh: 114,  connector_type: "CCS2", range_km: 582 },
  "porsche taycan": { battery_kwh: 93.4, connector_type: "CCS2", range_km: 484 },
  "mercedes-benz eqc": { battery_kwh: 80,   connector_type: "CCS2", range_km: 410 },
  "mercedes-benz eqs": { battery_kwh: 107.8, connector_type: "CCS2", range_km: 780 },
  "mercedes-benz eqa": { battery_kwh: 66.5, connector_type: "CCS2", range_km: 426 },
  "mercedes-benz eqb": { battery_kwh: 66.5, connector_type: "CCS2", range_km: 419 },
  "mercedes-benz":     { battery_kwh: 80,   connector_type: "CCS2" },
  "nissan leaf":  { battery_kwh: 62,   connector_type: "CHAdeMO", range_km: 385 },
  "nissan ariya": { battery_kwh: 91,   connector_type: "CCS2",    range_km: 520 },
  "bmw i3":  { battery_kwh: 42.2, connector_type: "CCS2", range_km: 246 },
  "bmw i4":  { battery_kwh: 83.9, connector_type: "CCS2", range_km: 590 },
  "bmw ix":  { battery_kwh: 111.5, connector_type: "CCS2", range_km: 630 },
  "bmw ix3": { battery_kwh: 80,   connector_type: "CCS2", range_km: 460 },
  "volvo xc40": { battery_kwh: 82, connector_type: "CCS2", range_km: 418 },
  "volvo c40":  { battery_kwh: 82, connector_type: "CCS2", range_km: 437 },
  "polestar 2": { battery_kwh: 82, connector_type: "CCS2", range_km: 540 },
  "mitsubishi outlander": { battery_kwh: 20, connector_type: "CHAdeMO", range_km: 55 },
  "mitsubishi eclipse":   { battery_kwh: 13.8, connector_type: "CHAdeMO", range_km: 50 },
  "exeed lx":    { battery_kwh: 64, connector_type: "CCS2", range_km: 440 },
  "exeed rx":    { battery_kwh: 64, connector_type: "CCS2", range_km: 440 },
  "exeed txl":   { battery_kwh: 64, connector_type: "CCS2", range_km: 400 },
};

function applyOverride<T extends { name: string; battery_kwh: number; connector_type: string; range_km?: number }>(v: T): T {
  const lower = v.name.toLowerCase();
  let bestKey = "", bestOverride: typeof VEHICLE_OVERRIDES[string] | null = null;
  for (const [pattern, override] of Object.entries(VEHICLE_OVERRIDES)) {
    if (lower.includes(pattern) && pattern.length > bestKey.length) {
      bestKey = pattern; bestOverride = override;
    }
  }
  if (!bestOverride) return v;
  return {
    ...v,
    battery_kwh:    bestOverride.battery_kwh,
    connector_type: bestOverride.connector_type,
    ...(bestOverride.range_km != null ? { range_km: bestOverride.range_km } : {}),
  };
}

// ── Alias resolution ──────────────────────────────────────────────────────
async function resolveAliases(words: string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const w of words) {
    const rows = await db
      .select({ canonical: vehicleAliasesTable.canonical })
      .from(vehicleAliasesTable)
      .where(eq(vehicleAliasesTable.alias, w.toLowerCase()));
    resolved.push(rows[0]?.canonical ?? w);
  }
  return [...new Set(resolved)]; // deduplicate
}

// ── Local DB search (exact ilike) ─────────────────────────────────────────
async function searchLocalDB(words: string[]) {
  if (words.length === 0) return [];
  const conditions = words.map(w => ilike(vehiclesTable.name, `%${w}%`));
  return db.select().from(vehiclesTable)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions));
}

// ── Fuzzy search via pg_trgm ──────────────────────────────────────────────
async function searchFuzzy(q: string) {
  return db
    .select()
    .from(vehiclesTable)
    .where(sql`similarity(lower(${vehiclesTable.name}), lower(${q})) > 0.2`)
    .orderBy(sql`similarity(lower(${vehiclesTable.name}), lower(${q})) DESC`)
    .limit(15);
}

// ── Override search ───────────────────────────────────────────────────────
function searchOverrides(words: string[]) {
  const results: Array<{ id: number; name: string; battery_kwh: number; range_km: number; connector_type: string; current_battery_pct: null; data_source: string; is_verified: boolean }> = [];
  for (const [pattern, specs] of Object.entries(VEHICLE_OVERRIDES)) {
    if (!words.every(w => pattern.includes(w))) continue;
    const pw = pattern.split(" ");
    const make0 = pw[0][0].toUpperCase() + pw[0].slice(1);
    const makeDisplay = make0 === "Byd" ? "BYD" : make0 === "Mercedes-benz" ? "Mercedes-Benz" : make0;
    const model = pw.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    results.push({
      id: -1 as unknown as number,
      name: `${makeDisplay} ${model}`,
      battery_kwh: specs.battery_kwh,
      range_km: specs.range_km ?? 300,
      connector_type: specs.connector_type,
      current_battery_pct: null,
      data_source: "override",
      is_verified: true,
    });
  }
  return results;
}

// ── API Ninjas ────────────────────────────────────────────────────────────
interface ApiNinjasEV { make: string; model: string; year?: number; range?: number; battery_capacity?: number | string }

async function fetchApiNinjas(q: string, words: string[]): Promise<ApiNinjasEV[]> {
  const apiKey = process.env.EV_API_KEY;
  if (!apiKey) { console.warn("[vehicles/search] EV_API_KEY not set"); return []; }
  const base = "https://api.api-ninjas.com/v1/electricvehicle";
  const hdrs = { "X-Api-Key": apiKey };
  const timeout = { signal: AbortSignal.timeout(5000) };
  const urls: string[] = [
    `${base}?make=${encodeURIComponent(q)}&limit=30`,
    `${base}?model=${encodeURIComponent(q)}&limit=30`,
  ];
  if (words.length >= 2) urls.push(`${base}?make=${encodeURIComponent(words[0])}&model=${encodeURIComponent(words.slice(1).join(" "))}&limit=30`);
  const results = await Promise.allSettled(urls.map(url => fetch(url, { ...timeout, headers: hdrs })));
  const raw: ApiNinjasEV[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      const json = await r.value.json() as ApiNinjasEV[];
      if (Array.isArray(json)) raw.push(...json);
    }
  }
  const seen = new Set<string>();
  return raw.filter(v => { const k = `${v.make} ${v.model}`.toLowerCase(); return seen.has(k) ? false : (seen.add(k), true); });
}

// ── OpenEV live API (supplement) ──────────────────────────────────────────
interface OpenEvApiVehicle { make?: string; model?: string; year?: number; range_km?: number; battery_kwh?: number; connector_type?: string }

async function fetchOpenEvApi(makeSlug: string): Promise<OpenEvApiVehicle[]> {
  try {
    const res = await fetch(
      `https://api.open-ev-data.org/v1/vehicles?make=${encodeURIComponent(makeSlug)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const json = await res.json() as { vehicles?: OpenEvApiVehicle[] } | OpenEvApiVehicle[];
    return Array.isArray(json) ? json : (json.vehicles ?? []);
  } catch { return []; }
}

// ── Upsert API Ninjas rows ────────────────────────────────────────────────
function parseBatteryCapacity(raw: number | string | undefined, vehicleName: string): { kwh: number } {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return { kwh: raw };
  const lower = vehicleName.toLowerCase();
  let bestKey = "", bestOverride: typeof VEHICLE_OVERRIDES[string] | null = null;
  for (const [pattern, override] of Object.entries(VEHICLE_OVERRIDES)) {
    if (lower.includes(pattern) && pattern.length > bestKey.length) { bestKey = pattern; bestOverride = override; }
  }
  if (bestOverride) return { kwh: bestOverride.battery_kwh };
  return { kwh: 60 };
}

async function upsertApiRow(v: { name: string; battery_kwh: number; range_km: number; connector_type: "CCS2" | "CHAdeMO" | "Type2" | "GB-T"; data_source: string }) {
  const existing = await db.select().from(vehiclesTable).where(ilike(vehiclesTable.name, v.name));
  if (existing.length === 0) {
    const [row] = await db.insert(vehiclesTable).values({ ...v, is_verified: true }).returning();
    return row;
  }
  const cur = existing[0];
  if (cur.battery_kwh !== v.battery_kwh || cur.connector_type !== v.connector_type) {
    const [updated] = await db.update(vehiclesTable).set({ battery_kwh: v.battery_kwh, connector_type: v.connector_type, range_km: v.range_km }).where(eq(vehiclesTable.id, cur.id)).returning();
    return updated;
  }
  return cur;
}

// ── Popular list ──────────────────────────────────────────────────────────
const POPULAR_MAKES = ["BYD", "Hyundai", "Kia", "Tesla", "Chevrolet", "Volkswagen",
  "Nissan", "BMW", "Audi", "Porsche", "Mercedes-Benz", "Volvo", "Polestar", "Mitsubishi", "EXEED"];

router.get("/vehicles/popular", (_req, res): void => {
  const list: Array<{ name: string; battery_kwh: number; range_km: number; connector_type: string; current_battery_pct: null; data_source: string }> = [];
  for (const [pattern, specs] of Object.entries(VEHICLE_OVERRIDES)) {
    if (!pattern.includes(" ") || pattern.endsWith(".")) continue;
    const pw = pattern.split(" ");
    const make0 = pw[0][0].toUpperCase() + pw[0].slice(1);
    const makeDisplay = make0 === "Byd" ? "BYD" : make0 === "Mercedes-benz" ? "Mercedes-Benz" : make0 === "Exeed" ? "EXEED" : make0;
    const model = pw.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    list.push({ name: `${makeDisplay} ${model}`, battery_kwh: specs.battery_kwh, range_km: specs.range_km ?? 300, connector_type: specs.connector_type, current_battery_pct: null, data_source: "override" });
  }
  const byMake: Record<string, typeof list> = {};
  for (const v of list) { const m = v.name.split(" ")[0]; if (!byMake[m]) byMake[m] = []; byMake[m].push(v); }
  const sorted = POPULAR_MAKES.filter(m => byMake[m]).map(make => ({ make, vehicles: byMake[make] }));
  for (const [make, vehicles] of Object.entries(byMake)) if (!POPULAR_MAKES.includes(make)) sorted.push({ make, vehicles });
  res.json(sorted);
});

// ── Search ────────────────────────────────────────────────────────────────
router.get("/vehicles/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) { res.status(400).json({ error: "Query must be at least 2 characters" }); return; }

  try {
    // 1. Resolve aliases (Cyrillic + typos → Latin)
    const rawWords = q.toLowerCase().split(/\s+/).filter(Boolean);
    const words = await resolveAliases(rawWords);
    const resolvedQ = words.join(" ");
    const isDifferent = resolvedQ !== q.toLowerCase();
    if (isDifferent) console.log(`[vehicles/search] q="${q}" → resolved="${resolvedQ}"`);

    // 2. Local sources + live APIs in parallel
    const [localRows, overrideHits, apiNinjasRaw] = await Promise.all([
      searchLocalDB(words),
      Promise.resolve(searchOverrides(words)),
      fetchApiNinjas(resolvedQ, words),
    ]);

    // OpenEV live API — only for first word (make slug)
    const openEvRaw = words.length > 0 ? await fetchOpenEvApi(words[0]) : [];

    console.log(`[vehicles/search] q="${q}" — local DB: ${localRows.length}, overrides: ${overrideHits.length}, apiNinjas: ${apiNinjasRaw.length}, openEvApi: ${openEvRaw.length}`);

    // 3. Fuzzy fallback if nothing found so far
    let fuzzyRows: typeof localRows = [];
    const directHit = localRows.length > 0 || overrideHits.length > 0;
    if (!directHit) {
      fuzzyRows = await searchFuzzy(resolvedQ);
      console.log(`[vehicles/search] fuzzy fallback: ${fuzzyRows.length} results`);
    }

    // 4. Upsert API Ninjas results
    const persistedNinjas: typeof localRows = [];
    for (const v of apiNinjasRaw) {
      const name = `${v.make} ${v.model}`;
      const { kwh } = parseBatteryCapacity(v.battery_capacity, name);
      const base = { name, battery_kwh: kwh, range_km: Math.round((v.range ?? 300) * 1.609), connector_type: "CCS2" as const, data_source: "api_ninjas" };
      try { persistedNinjas.push(await upsertApiRow(applyOverride(base))); } catch { /* ignore */ }
    }

    // 5. Merge: overrides > openev DB > local DB > api_ninjas > fuzzy
    // Sort local rows: openev first, then api_ninjas, then manual
    const sourceOrder: Record<string, number> = { override: 0, openev: 1, api_ninjas: 2, manual: 3 };
    const sortedLocal = [...localRows].sort((a, b) =>
      (sourceOrder[(a as any).data_source ?? "manual"] ?? 3) - (sourceOrder[(b as any).data_source ?? "manual"] ?? 3)
    );

    const overrideAsRows = overrideHits.map(o => ({ ...o, id: -1 as unknown as number }));
    const seen = new Set<string>();
    const merged: Array<typeof overrideAsRows[0]> = [];

    for (const v of [...overrideAsRows, ...sortedLocal, ...persistedNinjas, ...fuzzyRows]) {
      const key = (v.name ?? "").toLowerCase().trim();
      if (key && !seen.has(key)) { seen.add(key); merged.push(v as any); }
    }

    const result = merged.map(v => applyOverride({ ...v, range_km: v.range_km ?? 300 }));

    console.log(`[vehicles/search] final: ${result.length} unique — direct: ${directHit}, fuzzy: ${fuzzyRows.length}, after dedup from ${merged.length}`);

    // Attach fuzzy suggestion flag when using fuzzy results only
    const isFuzzy = !directHit && fuzzyRows.length > 0;
    res.json({ results: result, fuzzy: isFuzzy });

  } catch (err: any) {
    console.error("[vehicles/search] unexpected error:", err?.message ?? err);
    res.status(500).json({ error: "Search failed" });
  }
});

// ── Manual vehicle add ────────────────────────────────────────────────────
const ManualVehicleBody = z.object({
  make:            z.string().min(1),
  model:           z.string().min(1),
  year:            z.number().int().min(1990).max(new Date().getFullYear() + 2).optional(),
  battery_kwh:     z.number().positive(),
  range_km:        z.number().positive(),
  connector_type:  z.enum(["CCS2", "CHAdeMO", "Type2", "GB-T"]),
  max_ac_power_kw: z.number().positive().optional(),
  max_dc_power_kw: z.number().positive().optional(),
  body_style:      z.string().optional(),
  vehicle_type:    z.string().optional(),
  user_id:         z.string().optional(),
});

router.post("/vehicles/manual", async (req, res): Promise<void> => {
  const parsed = ManualVehicleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const name = d.year
    ? `${d.make} ${d.model} ${d.year}`
    : `${d.make} ${d.model}`;
  const [v] = await db.insert(vehiclesTable).values({
    name,
    make:          d.make,
    model:         d.model,
    year:          d.year ?? null,
    battery_kwh:   d.battery_kwh,
    range_km:      d.range_km,
    connector_type: d.connector_type,
    data_source:   "manual",
    user_id:       d.user_id ?? null,
    body_style:    d.body_style ?? null,
    vehicle_type:  d.vehicle_type ?? null,
    is_verified:   false,
  }).returning();
  res.status(201).json(v);
});

// ── Admin: list manual (unverified) vehicles ──────────────────────────────
router.get("/admin/vehicles/manual", async (req, res): Promise<void> => {
  const rows = await db.select().from(vehiclesTable)
    .where(sql`data_source = 'manual' AND is_verified = false`)
    .orderBy(vehiclesTable.id);
  res.json(rows);
});

router.patch("/admin/vehicles/:id/verify", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [v] = await db.update(vehiclesTable)
    .set({ is_verified: true, data_source: "manual_verified" })
    .where(eq(vehiclesTable.id, id))
    .returning();
  if (!v) { res.status(404).json({ error: "Not found" }); return; }
  res.json(v);
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
