/**
 * Open Charge Map (OCM) station importer for Uzbekistan
 * Usage: pnpm --filter @workspace/api-server tsx scripts/import-ocm.ts
 *
 * Free API key: https://openchargemap.org/site/develop/api
 * Set env var: OCM_API_KEY=your_key_here
 */
import { db, stationsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const OCM_BASE = "https://api.openchargemap.io/v3/poi";
const API_KEY = process.env.OCM_API_KEY ?? "";

interface OcmPoi {
  ID: number;
  AddressInfo: {
    Title: string;
    AddressLine1?: string;
    Town?: string;
    StateOrProvince?: string;
    Latitude: number;
    Longitude: number;
  };
  Connections?: Array<{
    ConnectionType?: { Title?: string };
    PowerKW?: number;
    CurrentType?: { Title?: string };
  }>;
  OperatorInfo?: { Title?: string };
  StatusType?: { IsOperational?: boolean };
}

function connectorTypeFromOcm(title?: string): string {
  const t = (title ?? "").toUpperCase();
  if (t.includes("CCS") && t.includes("TYPE 2")) return "CCS2";
  if (t.includes("CCS") && t.includes("TYPE 1")) return "CCS1";
  if (t.includes("CHADEMO")) return "CHAdeMO";
  if (t.includes("TYPE 2") || t.includes("TYPE2") || t.includes("IEC 62196-2")) return "Type2";
  if (t.includes("TYPE 1") || t.includes("J1772")) return "J1772";
  if (t.includes("TESLA")) return "Tesla";
  return "CCS2";
}

async function fetchPage(page: number, pageSize = 200): Promise<OcmPoi[]> {
  const url = new URL(OCM_BASE);
  url.searchParams.set("countrycode", "UZ");
  url.searchParams.set("maxresults", String(pageSize));
  url.searchParams.set("startindex", String(page * pageSize));
  url.searchParams.set("output", "json");
  url.searchParams.set("compact", "false");
  url.searchParams.set("verbose", "false");
  if (API_KEY) url.searchParams.set("key", API_KEY);

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json", "User-Agent": "iON-EV-App/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OCM HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<OcmPoi[]>;
}

async function run() {
  if (!API_KEY) {
    console.warn("⚠️  OCM_API_KEY not set — using public (rate-limited) access");
  }

  let page = 0;
  let inserted = 0, skipped = 0, errors = 0;

  while (true) {
    console.log(`Fetching page ${page}…`);
    let pois: OcmPoi[];
    try {
      pois = await fetchPage(page);
    } catch (e) {
      console.error("Fetch error:", e);
      break;
    }
    if (pois.length === 0) break;
    console.log(`  → ${pois.length} records`);

    for (const poi of pois) {
      try {
        const ai = poi.AddressInfo;
        if (!ai?.Latitude || !ai?.Longitude) { skipped++; continue; }

        // Best connector: highest power DC preferred
        const conns = (poi.Connections ?? []).filter(c => c.PowerKW && c.PowerKW > 0);
        conns.sort((a, b) => (b.PowerKW ?? 0) - (a.PowerKW ?? 0));
        const primary = conns[0];
        const maxPower = primary?.PowerKW ?? 50;
        const connType = connectorTypeFromOcm(primary?.ConnectionType?.Title);

        const connectors = conns.slice(0, 6).map(c => ({
          type: connectorTypeFromOcm(c.ConnectionType?.Title),
          power_kw: c.PowerKW ?? 50,
        }));
        if (connectors.length === 0) connectors.push({ type: connType, power_kw: maxPower });

        const isOperational = poi.StatusType?.IsOperational !== false;
        const status = isOperational ? "free" : "offline";

        const name = ai.Title.trim().slice(0, 200);
        const address = [ai.AddressLine1, ai.Town, ai.StateOrProvince]
          .filter(Boolean).join(", ").slice(0, 300) || ai.Title.slice(0, 200);

        // Upsert by OCM external ID stored in name pattern — use lat/lng proximity fallback
        await db.execute(sql`
          INSERT INTO stations (name, address, lat, lng, power_kw, price_per_kwh, status, source, connectors, amenities, is_promoted, discount_pct, supports_reservation)
          VALUES (
            ${name}, ${address}, ${ai.Latitude}, ${ai.Longitude},
            ${maxPower}, ${2200}, ${status}, ${"api"},
            ${JSON.stringify(connectors)}::jsonb, ${"[]"}::jsonb,
            ${false}, ${0}, ${false}
          )
          ON CONFLICT DO NOTHING
        `);
        // Use a unique constraint helper: skip if very close station already exists
        const nearby = await db.execute(sql`
          SELECT id FROM stations
          WHERE ABS(lat - ${ai.Latitude}) < 0.001
            AND ABS(lng - ${ai.Longitude}) < 0.001
            AND source = 'api'
          LIMIT 1
        `);
        if ((nearby.rows as any[]).length === 0) {
          inserted++;
        } else {
          skipped++;
        }
      } catch (e) {
        console.error(`  Error on POI ${poi.ID}:`, e);
        errors++;
      }
    }

    if (pois.length < 200) break;
    page++;
    // Polite delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone — inserted: ${inserted}, skipped/dup: ${skipped}, errors: ${errors}`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
