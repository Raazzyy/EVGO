/**
 * Open Charge Map → stations import script
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run import:ocm
 *
 * Idempotent: upserts on external_id = "ocm-<ID>".
 * Adds external_id column and unique index on first run if missing.
 */

// Пул берём из @workspace/db, а не поднимаем свой: `pg` не значится в
// зависимостях api-server, и при строгой раскладке pnpm импорт не резолвится.
import { pool } from '@workspace/db';

const OCM_API_KEY = process.env.OCM_API_KEY;

if (!OCM_API_KEY) { console.error('❌  OCM_API_KEY is not set'); process.exit(1); }
// DATABASE_URL проверяется при импорте @workspace/db.

// ── OCM connection-type ID → human label ─────────────────────────────────────
const CONN_LABEL: Record<number, string> = {
  1: 'J1772',      2: 'CHAdeMO',   25: 'Type 2',   26: 'Type 2',
  27: 'Type 2',    32: 'CCS2',     33: 'CCS1',      8: 'Tesla',
  9: 'Tesla SC',  13: 'Tesla',    35: 'GBT DC',    34: 'GBT AC',
  38: 'NACS',
};

function connLabel(id?: number) { return (id && CONN_LABEL[id]) ?? `Type-${id ?? '?'}`; }

function mapStatus(id?: number): 'free' | 'occupied' | 'offline' {
  if (!id || id === 10 || id === 50 || id === 75) return 'free';
  if (id === 150 || id === 200 || id === 210 || id === 20) return 'offline';
  return 'free';
}

function guessPrice(kw: number) {
  if (kw >= 150) return 2800;
  if (kw >= 50)  return 2400;
  if (kw >= 22)  return 2000;
  return 1500;
}

// ── Ensure schema migration ──────────────────────────────────────────────────
async function ensureColumn() {
  await pool.query(`
    ALTER TABLE stations
    ADD COLUMN IF NOT EXISTS external_id text
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS stations_external_id_idx
    ON stations(external_id) WHERE external_id IS NOT NULL
  `);
  console.log('✅  external_id column ready');
}

// ── Operator upsert ──────────────────────────────────────────────────────────
const operatorCache: Record<string, number> = {};

async function getOrCreateOperator(name: string): Promise<number | null> {
  if (!name) return null;
  if (operatorCache[name] !== undefined) return operatorCache[name];
  const r = await pool.query('SELECT id FROM operators WHERE name = $1 LIMIT 1', [name]);
  if (r.rows.length) {
    operatorCache[name] = r.rows[0].id;
    return r.rows[0].id;
  }
  const ins = await pool.query('INSERT INTO operators (name) VALUES ($1) RETURNING id', [name]);
  operatorCache[name] = ins.rows[0].id;
  return ins.rows[0].id;
}

// ── Fetch one page from OCM API ──────────────────────────────────────────────
async function fetchPage(offset: number, maxResults = 500) {
  const url = new URL('https://api.openchargemap.io/v3/poi/');
  url.searchParams.set('key',         OCM_API_KEY!);
  url.searchParams.set('countrycode', 'UZ');
  url.searchParams.set('maxresults',  String(maxResults));
  url.searchParams.set('startindex',  String(offset));
  url.searchParams.set('verbose',     'false');
  url.searchParams.set('output',      'json');
  url.searchParams.set('includeComments', 'false');

  const res = await fetch(url.toString(), { headers: { 'X-API-Key': OCM_API_KEY! } });
  if (!res.ok) throw new Error(`OCM HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<any[]>;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  await ensureColumn();

  const PAGE    = 500;
  let offset    = 0;
  let inserted  = 0;
  let updated   = 0;
  let totalFetched = 0;

  while (true) {
    console.log(`🔄  Fetching offset ${offset}…`);

    let pois: any[];
    try {
      pois = await fetchPage(offset, PAGE);
    } catch (e) {
      console.error('Fetch error:', e);
      break;
    }
    if (!pois.length) break;

    for (const poi of pois) {
      const ai = poi.AddressInfo;
      if (!ai?.Latitude || !ai?.Longitude) continue;

      const lat        = ai.Latitude  as number;
      const lng        = ai.Longitude as number;
      const name       = (ai.Title ?? 'EV Station') as string;
      const address    = [ai.AddressLine1, ai.Town, ai.StateOrProvince]
                           .filter(Boolean).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const extId      = `ocm-${poi.ID}`;
      const status     = mapStatus(poi.StatusType?.ID);
      const opId       = await getOrCreateOperator(poi.OperatorInfo?.Title ?? '');

      const conns: any[] = (poi.Connections ?? [])
        .filter((c: any) => c.PowerKW > 0)
        .map((c: any) => ({
          type:      connLabel(c.ConnectionTypeID),
          power_kw:  c.PowerKW as number,
          total:     (c.Quantity ?? 1) as number,
          available: (c.Quantity ?? 1) as number,
        }));

      const maxPower = conns.length ? Math.max(...conns.map(c => c.power_kw)) : 7.4;
      const price    = guessPrice(maxPower);

      try {
        const exist = await pool.query(
          'SELECT id FROM stations WHERE external_id = $1 LIMIT 1', [extId]
        );

        if (exist.rows.length) {
          await pool.query(`
            UPDATE stations SET
              name        = $1,
              address     = $2,
              lat         = $3,
              lng         = $4,
              power_kw    = $5,
              connectors  = $6,
              status      = $7::"station_status",
              operator_id = $8,
              updated_at  = now()
            WHERE external_id = $9
          `, [name, address, lat, lng, maxPower, JSON.stringify(conns), status, opId, extId]);
          updated++;
        } else {
          await pool.query(`
            INSERT INTO stations
              (name, address, lat, lng, power_kw, price_per_kwh, connectors,
               status, source, operator_id, external_id,
               amenities, is_promoted, discount_pct, supports_reservation, updated_at)
            VALUES
              ($1,$2,$3,$4,$5,$6,$7,
               $8::"station_status",'api',$9,$10,
               '[]',0,0,false,now())
          `, [name, address, lat, lng, maxPower, price, JSON.stringify(conns),
              status, opId, extId]);
          inserted++;
        }
      } catch (e: any) {
        console.warn(`  ⚠️  OCM #${poi.ID} skipped: ${e.message}`);
      }
    }

    totalFetched += pois.length;
    offset       += pois.length;
    console.log(`   → inserted=${inserted} updated=${updated} total_fetched=${totalFetched}`);

    if (pois.length < PAGE) break;           // last page
    await new Promise(r => setTimeout(r, 250)); // rate-limit courtesy delay
  }

  console.log(`\n🎉  Done. inserted=${inserted} updated=${updated} total_fetched=${totalFetched}`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err);
  pool.end().finally(() => process.exit(1));
});
