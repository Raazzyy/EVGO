/**
 * One-time migration: populate `connectors` table from stations.connectors jsonb
 * Run: npx ts-node --esm src/migrate-connectors.ts  (or via pnpm script)
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { eq } from "drizzle-orm";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

async function migrate() {
  const stations = await db.select().from(schema.stationsTable);
  let inserted = 0;

  for (const st of stations) {
    // Skip if connectors already created
    const existing = await db.select().from(schema.connectorsTable)
      .where(eq(schema.connectorsTable.station_id, st.id));
    if (existing.length > 0) continue;

    const jsonConnectors = (st.connectors as Array<{ type: string; power_kw: number; total: number; available: number }> | null) ?? [];

    let labelIdx = 0;
    for (const jc of jsonConnectors) {
      const total = Math.max(1, jc.total ?? 1);
      const available = Math.min(jc.available ?? 1, total);
      for (let i = 0; i < total; i++) {
        const isFree = i < available;
        await db.insert(schema.connectorsTable).values({
          station_id: st.id,
          label: LABELS[labelIdx % LABELS.length],
          type: jc.type ?? "CCS2",
          power_kw: jc.power_kw ?? st.power_kw,
          status: isFree ? "free" : "occupied",
        });
        labelIdx++;
        inserted++;
      }
    }

    // If no jsonb connectors, create one default based on station power
    if (jsonConnectors.length === 0) {
      await db.insert(schema.connectorsTable).values({
        station_id: st.id,
        label: "A",
        type: "CCS2",
        power_kw: st.power_kw,
        status: st.status === "free" ? "free" : "occupied",
      });
      inserted++;
    }
  }

  console.log(`✅ Migrated ${inserted} connector rows from ${stations.length} stations`);
  await pool.end();
}

migrate().catch(e => { console.error(e); process.exit(1); });
