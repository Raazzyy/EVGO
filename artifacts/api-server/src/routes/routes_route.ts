import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, routesTable, vehiclesTable, stationsTable } from "@workspace/db";
import {
  CreateRouteBody,
  GetRouteParams,
  DeleteRouteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Simple route planner: given origin/destination and battery%, find charging stops
function planRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  batteryPct: number,
  vehicle: { battery_kwh: number; range_km: number },
  stations: Array<{ id: number; name: string; address: string; lat: number; lng: number; power_kw: number }>
) {
  const stops = [];
  const totalDistKm = Math.sqrt(
    Math.pow((destLat - originLat) * 111, 2) +
    Math.pow((destLng - originLng) * 111 * Math.cos(originLat * Math.PI / 180), 2)
  );

  const currentRangeKm = (batteryPct / 100) * vehicle.range_km;
  const safeRange = currentRangeKm * 0.8; // Keep 20% buffer

  if (totalDistKm <= safeRange) {
    return { stops: [], total_distance_km: totalDistKm, total_time_min: Math.round(totalDistKm / 0.9) };
  }

  // Find stations along the route
  let coveredKm = 0;
  let currentBattery = batteryPct;
  let currentLat = originLat;
  let currentLng = originLng;
  const remainingDist = totalDistKm;

  while (coveredKm < remainingDist - (vehicle.range_km * 0.2)) {
    const rangeFromHere = (currentBattery / 100) * vehicle.range_km * 0.8;

    // Find the farthest reachable station towards destination
    const reachable = stations.filter(s => {
      const d = Math.sqrt(
        Math.pow((s.lat - currentLat) * 111, 2) +
        Math.pow((s.lng - currentLng) * 111 * Math.cos(currentLat * Math.PI / 180), 2)
      );
      return d <= rangeFromHere && d > 5;
    });

    if (reachable.length === 0) break;

    // Pick station closest to destination
    const best = reachable.sort((a, b) => {
      const dA = Math.sqrt(Math.pow((a.lat - destLat) * 111, 2) + Math.pow((a.lng - destLng) * 111, 2));
      const dB = Math.sqrt(Math.pow((b.lat - destLat) * 111, 2) + Math.pow((b.lng - destLng) * 111, 2));
      return dA - dB;
    })[0];

    const distToStation = Math.sqrt(
      Math.pow((best.lat - currentLat) * 111, 2) +
      Math.pow((best.lng - currentLng) * 111 * Math.cos(currentLat * Math.PI / 180), 2)
    );

    const arrivalBattery = Math.max(5, currentBattery - (distToStation / vehicle.range_km) * 100);
    const targetBattery = 80;
    const energyNeeded = ((targetBattery - arrivalBattery) / 100) * vehicle.battery_kwh;
    const chargeTimeMin = Math.round((energyNeeded / best.power_kw) * 60);
    const now = new Date();
    now.setMinutes(now.getMinutes() + Math.round(coveredKm / 0.9) + chargeTimeMin);

    stops.push({
      station_id: best.id,
      station_name: best.name,
      address: best.address,
      lat: best.lat,
      lng: best.lng,
      arrival_battery_pct: Math.round(arrivalBattery),
      departure_battery_pct: targetBattery,
      charge_time_min: chargeTimeMin,
      distance_from_prev_km: parseFloat(distToStation.toFixed(1)),
      eta: now.toTimeString().slice(0, 5),
    });

    coveredKm += distToStation;
    currentBattery = targetBattery;
    currentLat = best.lat;
    currentLng = best.lng;
  }

  const totalTimeMin = Math.round(remainingDist / 0.9) + stops.reduce((acc, s) => acc + s.charge_time_min, 0);

  return {
    stops,
    total_distance_km: parseFloat(remainingDist.toFixed(1)),
    total_time_min: totalTimeMin,
  };
}

router.get("/routes", async (_req, res): Promise<void> => {
  const rows = await db.select({ route: routesTable, vehicle: vehiclesTable })
    .from(routesTable)
    .leftJoin(vehiclesTable, eq(routesTable.vehicle_id, vehiclesTable.id))
    .orderBy(routesTable.created_at);

  res.json(rows.map(r => ({ ...r.route, vehicle: r.vehicle ?? undefined })));
});

router.post("/routes", async (req, res): Promise<void> => {
  const parsed = CreateRouteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { origin, destination, vehicle_id, initial_battery_pct } = parsed.data;

  // Default Tashkent coords if not provided
  const originLat = parsed.data.origin_lat ?? 41.2995;
  const originLng = parsed.data.origin_lng ?? 69.2401;
  const destLat = parsed.data.dest_lat ?? 39.6542;
  const destLng = parsed.data.dest_lng ?? 66.9597;

  let vehicle = { battery_kwh: 77, range_km: 450 };
  if (vehicle_id) {
    const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicle_id));
    if (v) vehicle = { battery_kwh: v.battery_kwh, range_km: v.range_km };
  }

  const allStations = await db.select({
    id: stationsTable.id,
    name: stationsTable.name,
    address: stationsTable.address,
    lat: stationsTable.lat,
    lng: stationsTable.lng,
    power_kw: stationsTable.power_kw,
  }).from(stationsTable).where(eq(stationsTable.status, "free"));

  const plan = planRoute(originLat, originLng, destLat, destLng, initial_battery_pct, vehicle, allStations);

  const [route] = await db.insert(routesTable).values({
    vehicle_id: vehicle_id ?? null,
    origin,
    destination,
    origin_lat: originLat,
    origin_lng: originLng,
    dest_lat: destLat,
    dest_lng: destLng,
    initial_battery_pct,
    stops: plan.stops,
    total_distance_km: plan.total_distance_km,
    total_time_min: plan.total_time_min,
    status: "active",
  }).returning();

  const [v] = vehicle_id ? await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicle_id)) : [undefined];
  res.status(201).json({ ...route, vehicle: v ?? undefined });
});

router.get("/routes/:id", async (req, res): Promise<void> => {
  const p = GetRouteParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const [row] = await db
    .select({ route: routesTable, vehicle: vehiclesTable })
    .from(routesTable)
    .leftJoin(vehiclesTable, eq(routesTable.vehicle_id, vehiclesTable.id))
    .where(eq(routesTable.id, p.data.id));
  if (!row) { res.status(404).json({ error: "Route not found" }); return; }
  res.json({ ...row.route, vehicle: row.vehicle ?? undefined });
});

router.delete("/routes/:id", async (req, res): Promise<void> => {
  const p = DeleteRouteParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(routesTable).where(eq(routesTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
