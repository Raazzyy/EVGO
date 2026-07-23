/**
 * OpenEV dataset importer.
 *
 * Downloads the latest "OpenEV Data (JSON).json" from the open-ev-data GitHub
 * releases (dataset is CDLA-Permissive-2.0 — free for commercial use).
 *
 * Run on server startup when the table is empty, and once a week via
 * scheduleWeeklySync() exported below.
 */

import { db, vehiclesTable } from "@workspace/db";
import { sql, count } from "drizzle-orm";

const GITHUB_RELEASES_API =
  "https://api.github.com/repos/open-ev-data/open-ev-data-dataset/releases/latest";

const CONNECTOR_MAP: Record<string, "CCS2" | "CHAdeMO" | "Type2" | "GB-T"> = {
  ccs2:    "CCS2",
  ccs1:    "CCS2",   // CCS1 not in UZ market — map to CCS2
  chademo: "CHAdeMO",
  type_2:  "Type2",
  type_1:  "Type2",  // Type1 rarely used in CIS — map to Type2
  gb_t_dc: "GB-T",
  gb_t_ac: "GB-T",
  nacs:    "CCS2",   // NACS not in UZ market — map to CCS2
};

function pickConnector(
  ports: Array<{ connector?: string }>,
): "CCS2" | "CHAdeMO" | "Type2" | "GB-T" {
  // Prefer DC connectors: CCS2 > CHAdeMO > GB-T; fall back to Type2
  const priority: Array<"CCS2" | "CHAdeMO" | "GB-T" | "Type2"> = [
    "CCS2", "CHAdeMO", "GB-T", "Type2",
  ];
  const mapped = ports
    .map(p => CONNECTOR_MAP[p.connector ?? ""] ?? null)
    .filter(Boolean) as Array<"CCS2" | "CHAdeMO" | "Type2" | "GB-T">;
  for (const p of priority) {
    if (mapped.includes(p)) return p;
  }
  return "CCS2";
}

function pickRange(rated: Array<{ cycle?: string; km?: number }>): number {
  const cyclePriority = ["wltp", "epa", "cltc"];
  for (const cycle of cyclePriority) {
    const entry = rated.find(r => r.cycle === cycle && r.km != null);
    if (entry) return Math.round(entry.km!);
  }
  if (rated.length > 0 && rated[0].km != null) return Math.round(rated[0].km!);
  return 300;
}

interface OpenEvVehicle {
  make?:         { name?: string };
  model?:        { name?: string };
  year?:         number;
  trim?:         { name?: string };
  battery?:      { pack_capacity_kwh_net?: number; pack_capacity_kwh_gross?: number };
  range?:        { rated?: Array<{ cycle?: string; km?: number }> };
  charge_ports?: Array<{ connector?: string }>;
  charging?:     { ac?: { max_power_kw?: number }; dc?: { max_power_kw?: number } };
  vehicle_type?: string;
  body?:         { style?: string };
}

async function downloadLatestJson(): Promise<OpenEvVehicle[]> {
  const rel = await fetch(GITHUB_RELEASES_API, {
    headers: { "User-Agent": "iON-EV-App/1.0" },
    signal:  AbortSignal.timeout(15_000),
  });
  if (!rel.ok) throw new Error(`GitHub releases API: ${rel.status}`);
  const release = await rel.json() as { assets?: Array<{ name: string; browser_download_url: string }> };
  const asset = release.assets?.find(
    a => a.name.endsWith(".json") && a.name.startsWith("open-ev-data")
  );
  if (!asset) throw new Error(`OpenEV JSON asset not found. Available: ${release.assets?.map((a: any) => a.name).join(", ")}`);

  console.log(`[openev] Downloading ${asset.name}…`);
  const dl = await fetch(asset.browser_download_url, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!dl.ok) throw new Error(`Download failed: ${dl.status}`);
  const json = await dl.json() as { vehicles?: OpenEvVehicle[] } | OpenEvVehicle[];
  return Array.isArray(json) ? json : (json.vehicles ?? []);
}

export async function runOpenEvImport(): Promise<{ read: number; inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  const vehicles = await downloadLatestJson();
  console.log(`[openev] Read ${vehicles.length} vehicles from dataset`);

  for (const v of vehicles) {
    try {
      const makeName  = v.make?.name  ?? "";
      const modelName = v.model?.name ?? "";
      if (!makeName || !modelName) { skipped++; continue; }

      const year       = v.year ?? null;
      const trimName   = v.trim?.name ?? null;
      const batteryKwh = v.battery?.pack_capacity_kwh_net
        ?? v.battery?.pack_capacity_kwh_gross
        ?? 60;
      const rangeKm    = pickRange(v.range?.rated ?? []);
      const connector  = pickConnector(v.charge_ports ?? []);
      const bodyStyle  = v.body?.style ?? null;
      const vType      = v.vehicle_type ?? null;

      const displayName = year
        ? `${makeName} ${modelName} ${year}${trimName ? " " + trimName : ""}`
        : `${makeName} ${modelName}${trimName ? " " + trimName : ""}`;

      await db.insert(vehiclesTable).values({
        name:          displayName,
        make:          makeName,
        model:         modelName,
        year,
        trim_name:     trimName,
        battery_kwh:   batteryKwh,
        range_km:      rangeKm,
        connector_type: connector,
        data_source:   "openev",
        is_verified:   true,
        body_style:    bodyStyle,
        vehicle_type:  vType,
      }).onConflictDoNothing();   // no unique constraint yet, will just log; TODO: add unique index
      inserted++;
    } catch (err: any) {
      console.warn(`[openev] skip record: ${err?.message}`);
      skipped++;
    }
  }

  console.log(`[openev] Import complete — read: ${vehicles.length}, inserted: ${inserted}, skipped: ${skipped}`);
  return { read: vehicles.length, inserted, skipped };
}

/** Returns true if the openev table is empty (import has never run) */
async function isOpenEvEmpty(): Promise<boolean> {
  const [row] = await db
    .select({ cnt: count() })
    .from(vehiclesTable)
    .where(sql`data_source = 'openev'`);
  return (row?.cnt ?? 0) === 0;
}

let weeklyTimer: ReturnType<typeof setTimeout> | null = null;

/** Call once from index.ts: runs immediately if empty, schedules weekly refresh */
export async function scheduleOpenEvSync(): Promise<void> {
  if (await isOpenEvEmpty()) {
    console.log("[openev] Table empty — starting initial import");
    runOpenEvImport().catch(e => console.error("[openev] Import failed:", e));
  } else {
    console.log("[openev] OpenEV data present — skipping initial import");
  }

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const runWeekly = () => {
    runOpenEvImport().catch(e => console.error("[openev] Weekly import failed:", e));
    weeklyTimer = setTimeout(runWeekly, WEEK_MS);
  };
  weeklyTimer = setTimeout(runWeekly, WEEK_MS);
}
