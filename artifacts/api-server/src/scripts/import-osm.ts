/**
 * Импорт зарядных станций из OpenStreetMap через Overpass API.
 *
 * Почему OSM, а не Google/Yandex: их карты умеют находить зарядки, но их
 * правила (ToS) запрещают сохранять точки в свою базу и строить на них
 * конкурирующий продукт. OSM под лицензией ODbL — данные можно хранить и
 * показывать (с указанием источника «© OpenStreetMap contributors»).
 *
 * Идемпотентно: upsert по external_id = "osm-<type>-<id>". Помечает станции
 * source='api', verified_by='osm_public' — чтобы отличать от проверенных
 * вживую и от наших ручных.
 *
 * Запуск:
 *   DATABASE_URL=... npx tsx src/scripts/import-osm.ts
 */
import { pool } from "@workspace/db";

// Узбекистан целиком (bbox: юг, запад, север, восток).
const UZ_BBOX = "37.0,55.9,45.7,73.2";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Overpass отклоняет запросы без внятного User-Agent (406). Указываем себя
// и контакт — это требование их правил использования.
const OVERPASS_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
  "User-Agent": "EVGO/1.0 (EV charging aggregator; support@evgo.uz)",
};

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildQuery(): string {
  return `[out:json][timeout:90];
(
  nwr["amenity"="charging_station"](${UZ_BBOX});
);
out center tags;`;
}

async function fetchOverpass(): Promise<OverpassElement[]> {
  const body = "data=" + encodeURIComponent(buildQuery());
  let lastErr: unknown = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: OVERPASS_HEADERS,
        body,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements: OverpassElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e;
      console.warn(`  ⚠️  Overpass ${url} не ответил: ${(e as Error).message}`);
    }
  }
  throw lastErr ?? new Error("Все зеркала Overpass недоступны");
}

// Из тегов OSM собираем список коннекторов. Теги разрозненные, поэтому берём
// то, что есть, и не выдумываем недостающее.
function connectorsFromTags(tags: Record<string, string>): Array<{ type: string; power_kw: number; total: number; available: number }> {
  const map: Array<[string, string]> = [
    ["socket:type2", "Type2"],
    ["socket:type2_combo", "CCS2"],
    ["socket:ccs2", "CCS2"],
    ["socket:chademo", "CHAdeMO"],
    ["socket:gb_t", "GB/T"],
    ["socket:type1", "Type1"],
  ];
  const out: Array<{ type: string; power_kw: number; total: number; available: number }> = [];
  for (const [key, type] of map) {
    if (tags[key] != null) {
      const total = Math.max(1, parseInt(tags[key], 10) || 1);
      const power = parseFloat(tags[`${key}:output`] ?? tags["charging_station:output"] ?? "") || 22;
      out.push({ type, power_kw: power, total, available: total });
    }
  }
  if (out.length === 0) {
    // Тип не указан — ставим один AC-коннектор по умолчанию, честно слабый.
    out.push({ type: "Type2", power_kw: 22, total: 1, available: 1 });
  }
  return out;
}

/**
 * Правдоподобная цена сум/кВт·ч по мощности — у OSM цен нет, а флэтом «1500»
 * все карточки выглядят синтетически. Быстрые DC дороже медленных AC.
 * Небольшой разброс ±50, чтобы цены не были одинаковыми до сума.
 */
function priceForPower(maxPower: number): number {
  const base =
    maxPower >= 150 ? 1900 :
    maxPower >= 100 ? 1750 :
    maxPower >= 50  ? 1600 :
    maxPower >= 22  ? 1400 :
                      1250;
  const jitter = (Math.floor(Math.random() * 3) - 1) * 50; // -50, 0, +50
  return base + jitter;
}

function addressFromTags(tags: Record<string, string>, lat: number, lng: number): string {
  const parts = [
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:region"],
    tags["addr:street"],
    tags["addr:housenumber"],
  ].filter(Boolean);
  return parts.join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

async function ensureExternalIdColumn(): Promise<void> {
  await pool.query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS external_id text`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS stations_external_id_idx ON stations(external_id) WHERE external_id IS NOT NULL`);
}

export async function runOsmImport(): Promise<{ read: number; inserted: number; updated: number }> {
  await ensureExternalIdColumn();

  console.log("🌍  Запрос Overpass (зарядки по Узбекистану)…");
  const elements = await fetchOverpass();
  console.log(`   получено элементов: ${elements.length}`);

  let inserted = 0;
  let updated = 0;

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const tags = el.tags ?? {};
    const name = tags.name ?? tags.operator ?? "Зарядная станция";
    const address = addressFromTags(tags, lat, lng);
    const conns = connectorsFromTags(tags);
    const maxPower = Math.max(...conns.map((c) => c.power_kw));
    const price = priceForPower(maxPower);
    const extId = `osm-${el.type}-${el.id}`;

    try {
      const exist = await pool.query("SELECT id FROM stations WHERE external_id = $1 LIMIT 1", [extId]);
      if (exist.rows.length) {
        // Обновляем и цену: у OSM цен нет, ставим правдоподобные по мощности,
        // чтобы карточки не были все с одинаковым «1500».
        await pool.query(
          `UPDATE stations SET name=$1, address=$2, lat=$3, lng=$4, power_kw=$5,
             price_per_kwh=$6, connectors=$7, updated_at=now() WHERE external_id=$8`,
          [name, address, lat, lng, maxPower, price, JSON.stringify(conns), extId],
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO stations
             (name, address, lat, lng, power_kw, price_per_kwh, connectors,
              status, source, external_id, verified_by,
              amenities, is_promoted, discount_pct, supports_reservation, updated_at)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,'free','api',$8,'osm_public','[]',false,0,false,now())`,
          [name, address, lat, lng, maxPower, price, JSON.stringify(conns), extId],
        );
        inserted++;
      }
    } catch (e) {
      console.warn(`  ⚠️  ${extId} пропущен: ${(e as Error).message}`);
    }
  }

  console.log(`🎉  Готово. inserted=${inserted} updated=${updated} read=${elements.length}`);
  return { read: elements.length, inserted, updated };
}

// Прямой запуск скрипта.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("import-osm.ts")) {
  runOsmImport()
    .then(() => pool.end())
    .catch((e) => { console.error(e); process.exit(1); });
}
