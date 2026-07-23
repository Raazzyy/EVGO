import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, routesTable, vehiclesTable, stationsTable } from "@workspace/db";
import {
  CreateRouteBody,
  GetRouteParams,
  DeleteRouteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Google Directions API: get real road polyline ────────────────────────
function decodePolyline(encoded: string): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

async function fetchRoadPolyline(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<Array<[number, number]>> {
  const apikey = process.env.GOOGLE_DIRECTIONS_KEY;
  if (!apikey || waypoints.length < 2) return buildStraightPolyline(waypoints);
  try {
    const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
    const middle = waypoints.slice(1, -1);
    const waypointsParam = middle.length
      ? `&waypoints=${middle.map((w) => `${w.lat},${w.lng}`).join("|")}`
      : "";
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&mode=driving&key=${apikey}`;
    console.log(`[google-directions] GET origin=${origin} dest=${destination} stops=${middle.length}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[google-directions] HTTP error ${res.status}:`, body.slice(0, 400));
      return buildStraightPolyline(waypoints);
    }
    const data: any = await res.json();
    if (data.status !== "OK") {
      console.error(`[google-directions] API status: ${data.status} — ${data.error_message ?? ""}`);
      return buildStraightPolyline(waypoints);
    }
    const coords: Array<[number, number]> = [];
    for (const leg of data.routes?.[0]?.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const pts = decodePolyline(step.polyline?.points ?? "");
        for (const p of pts) coords.push(p);
      }
    }
    console.log(`[google-directions] OK — ${coords.length} points`);
    return coords.length >= 2 ? coords : buildStraightPolyline(waypoints);
  } catch (err: any) {
    console.error(`[google-directions] fetch exception:`, err?.message ?? err);
    return buildStraightPolyline(waypoints);
  }
}

// Fallback: interpolate straight-line segments with intermediate points
function buildStraightPolyline(
  waypoints: Array<{ lat: number; lng: number }>
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const steps = 8;
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      result.push([a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t]);
    }
  }
  return result;
}

// ── Internal route planner (charging stops) ───────────────────────────────
function planRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  batteryPct: number,
  vehicle: { battery_kwh: number; range_km: number },
  stations: Array<{ id: number; name: string; address: string; lat: number; lng: number; power_kw: number }>
) {
  const dist2d = (lat1: number, lng1: number, lat2: number, lng2: number) =>
    Math.sqrt(Math.pow((lat2 - lat1) * 111, 2) + Math.pow((lng2 - lng1) * 111 * Math.cos(lat1 * Math.PI / 180), 2));

  const totalDistKm = dist2d(originLat, originLng, destLat, destLng);
  const safeRange = (batteryPct / 100) * vehicle.range_km * 0.8;

  if (totalDistKm <= safeRange) {
    return { stops: [], total_distance_km: totalDistKm, total_time_min: Math.round(totalDistKm / 0.9) };
  }

  const stops: any[] = [];
  let coveredKm = 0, currentBattery = batteryPct, currentLat = originLat, currentLng = originLng;

  while (coveredKm < totalDistKm - vehicle.range_km * 0.2) {
    const rangeFromHere = (currentBattery / 100) * vehicle.range_km * 0.8;
    const reachable = stations.filter(s => {
      const d = dist2d(currentLat, currentLng, s.lat, s.lng);
      return d <= rangeFromHere && d > 5;
    });
    if (reachable.length === 0) break;

    const best = reachable.sort((a, b) =>
      dist2d(a.lat, a.lng, destLat, destLng) - dist2d(b.lat, b.lng, destLat, destLng)
    )[0];

    const distToStation = dist2d(currentLat, currentLng, best.lat, best.lng);
    const arrivalBattery = Math.max(5, currentBattery - (distToStation / vehicle.range_km) * 100);
    const targetBattery = 80;
    const energyNeeded = ((targetBattery - arrivalBattery) / 100) * vehicle.battery_kwh;
    const chargeTimeMin = Math.round((energyNeeded / best.power_kw) * 60);
    const eta = new Date(Date.now() + (Math.round(coveredKm / 0.9) + chargeTimeMin) * 60_000);

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
      eta: eta.toTimeString().slice(0, 5),
    });

    coveredKm += distToStation;
    currentBattery = targetBattery;
    currentLat = best.lat;
    currentLng = best.lng;
  }

  const totalTimeMin = Math.round(totalDistKm / 0.9) + stops.reduce((acc, s) => acc + s.charge_time_min, 0);
  return { stops, total_distance_km: parseFloat(totalDistKm.toFixed(1)), total_time_min: totalTimeMin };
}

// ── GET /routes ───────────────────────────────────────────────────────────
router.get("/routes", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ route: routesTable, vehicle: vehiclesTable })
    .from(routesTable)
    .leftJoin(vehiclesTable, eq(routesTable.vehicle_id, vehiclesTable.id))
    .orderBy(routesTable.created_at);

  // Attach polylines for active routes (parallel)
  const results = await Promise.all(
    rows.map(async (r) => {
      const route = r.route as any;
      const stops: any[] = route.stops ?? [];
      const waypoints = [
        { lat: route.origin_lat, lng: route.origin_lng },
        ...stops.filter((s: any) => s.lat && s.lng).map((s: any) => ({ lat: s.lat, lng: s.lng })),
        { lat: route.dest_lat, lng: route.dest_lng },
      ].filter((w) => w.lat && w.lng);

      const polyline = route.status === "active" ? await fetchRoadPolyline(waypoints) : [];
      return { ...route, vehicle: r.vehicle ?? undefined, polyline };
    })
  );

  res.json(results);
});

// ── POST /routes ──────────────────────────────────────────────────────────
router.post("/routes", async (req, res): Promise<void> => {
  const parsed = CreateRouteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { origin, destination, vehicle_id, initial_battery_pct } = parsed.data;
  const originLat = parsed.data.origin_lat ?? 41.2995;
  const originLng = parsed.data.origin_lng ?? 69.2401;
  const destLat = parsed.data.dest_lat ?? 39.6542;
  const destLng = parsed.data.dest_lng ?? 66.9597;

  let vehicle = { battery_kwh: 77, range_km: 450 };
  if (vehicle_id) {
    const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicle_id));
    if (v) vehicle = { battery_kwh: v.battery_kwh, range_km: v.range_km };
  }

  const allStations = await db
    .select({ id: stationsTable.id, name: stationsTable.name, address: stationsTable.address, lat: stationsTable.lat, lng: stationsTable.lng, power_kw: stationsTable.power_kw })
    .from(stationsTable)
    .where(eq(stationsTable.status, "free"));

  const plan = planRoute(originLat, originLng, destLat, destLng, initial_battery_pct, vehicle, allStations);

  const [route] = await db.insert(routesTable).values({
    vehicle_id: vehicle_id ?? null,
    origin, destination,
    origin_lat: originLat, origin_lng: originLng,
    dest_lat: destLat, dest_lng: destLng,
    initial_battery_pct,
    stops: plan.stops,
    total_distance_km: plan.total_distance_km,
    total_time_min: plan.total_time_min,
    status: "active",
  }).returning();

  // Build polyline via Yandex Router
  const stops: any[] = plan.stops;
  const waypoints = [
    { lat: originLat, lng: originLng },
    ...stops.filter((s) => s.lat && s.lng).map((s) => ({ lat: s.lat, lng: s.lng })),
    { lat: destLat, lng: destLng },
  ];
  const polyline = await fetchRoadPolyline(waypoints);

  const [v] = vehicle_id
    ? await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicle_id))
    : [undefined];

  res.status(201).json({ ...route, vehicle: v ?? undefined, polyline });
});

// ── GET /routes/:id ───────────────────────────────────────────────────────
router.get("/routes/:id", async (req, res): Promise<void> => {
  const p = GetRouteParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const [row] = await db
    .select({ route: routesTable, vehicle: vehiclesTable })
    .from(routesTable)
    .leftJoin(vehiclesTable, eq(routesTable.vehicle_id, vehiclesTable.id))
    .where(eq(routesTable.id, p.data.id));
  if (!row) { res.status(404).json({ error: "Route not found" }); return; }
  const route = row.route as any;
  const stops: any[] = route.stops ?? [];
  const waypoints = [
    { lat: route.origin_lat, lng: route.origin_lng },
    ...stops.filter((s: any) => s.lat && s.lng).map((s: any) => ({ lat: s.lat, lng: s.lng })),
    { lat: route.dest_lat, lng: route.dest_lng },
  ].filter((w) => w.lat && w.lng);
  const polyline = await fetchRoadPolyline(waypoints);
  res.json({ ...route, vehicle: row.vehicle ?? undefined, polyline });
});

// ── DELETE /routes/:id ────────────────────────────────────────────────────
router.delete("/routes/:id", async (req, res): Promise<void> => {
  const p = DeleteRouteParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(routesTable).where(eq(routesTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
