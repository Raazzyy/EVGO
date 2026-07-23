import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, routesTable, vehiclesTable, stationsTable } from "@workspace/db";
import {
  CreateRouteBody,
  GetRouteParams,
  DeleteRouteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Google Directions API: real road polyline + turn-by-turn steps ────────
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

interface GoogleStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  maneuver: string;
}

interface DirectionsResult {
  polyline: Array<[number, number]>;
  google_steps: GoogleStep[];
}

async function fetchRoadPolyline(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<DirectionsResult> {
  const fallback: DirectionsResult = { polyline: buildStraightPolyline(waypoints), google_steps: [] };
  const apikey = process.env.GOOGLE_DIRECTIONS_KEY;
  if (!apikey || waypoints.length < 2) return fallback;
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
      return fallback;
    }
    const data: any = await res.json();
    if (data.status !== "OK") {
      console.error(`[google-directions] API status: ${data.status} — ${data.error_message ?? ""}`);
      return fallback;
    }
    const coords: Array<[number, number]> = [];
    const google_steps: GoogleStep[] = [];
    for (const leg of data.routes?.[0]?.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const pts = decodePolyline(step.polyline?.points ?? "");
        for (const p of pts) coords.push(p);
        google_steps.push({
          instruction: stripHtml(step.html_instructions ?? ""),
          distance_m: step.distance?.value ?? 0,
          duration_s: step.duration?.value ?? 0,
          start_lat: step.start_location?.lat ?? 0,
          start_lng: step.start_location?.lng ?? 0,
          end_lat: step.end_location?.lat ?? 0,
          end_lng: step.end_location?.lng ?? 0,
          maneuver: step.maneuver ?? "straight",
        });
      }
    }
    console.log(`[google-directions] OK — ${coords.length} points, ${google_steps.length} steps`);
    return {
      polyline: coords.length >= 2 ? coords : buildStraightPolyline(waypoints),
      google_steps,
    };
  } catch (err: any) {
    console.error(`[google-directions] fetch exception:`, err?.message ?? err);
    return fallback;
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
  stations: Array<{
    id: number; name: string; address: string; lat: number; lng: number;
    power_kw: number; price_per_kwh: number;
    is_promoted: number; discount_pct: number; promo_ends_at: Date | null;
    connectors: Array<{ type: string; power_kw: number }> | null;
  }>,
  mode: "fast" | "eco" = "fast",
) {
  // Eco: charge to 90 % (fewer, longer stops); slower speed (more efficient driving)
  const targetBattery = mode === "eco" ? 90 : 80;
  const speedKmPerMin = mode === "eco" ? 0.85 : 0.9; // km/min → affects ETA calculation

  const dist2d = (lat1: number, lng1: number, lat2: number, lng2: number) =>
    Math.sqrt(Math.pow((lat2 - lat1) * 111, 2) + Math.pow((lng2 - lng1) * 111 * Math.cos(lat1 * Math.PI / 180), 2));

  const totalDistKm = dist2d(originLat, originLng, destLat, destLng);
  const safeRange = (batteryPct / 100) * vehicle.range_km * 0.8;

  if (totalDistKm <= safeRange) {
    const finalBattery = Math.round(Math.max(5, batteryPct - (totalDistKm / vehicle.range_km) * 100));
    return {
      stops: [], total_distance_km: totalDistKm,
      total_time_min: Math.round(totalDistKm / speedKmPerMin),
      final_battery_pct: finalBattery,
    };
  }

  const stops: any[] = [];
  let coveredKm = 0, currentBattery = batteryPct, currentLat = originLat, currentLng = originLng;
  let accumulatedTimeMin = 0;

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
    const energyNeeded = ((targetBattery - arrivalBattery) / 100) * vehicle.battery_kwh;
    const chargeTimeMin = Math.round((energyNeeded / best.power_kw) * 60);
    accumulatedTimeMin += Math.round(distToStation / speedKmPerMin);
    const eta = new Date(Date.now() + accumulatedTimeMin * 60_000);
    accumulatedTimeMin += chargeTimeMin;

    // Primary connector for this station (highest power DC preferred)
    const connectors = best.connectors ?? [];
    const primary = connectors.sort((a, b) => b.power_kw - a.power_kw)[0];
    const connectorType = primary?.type ?? "CCS2";
    const connectorPowerKw = primary?.power_kw ?? best.power_kw;

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
      connector_type: connectorType,
      connector_power_kw: connectorPowerKw,
      eta: eta.toTimeString().slice(0, 5),
      // Promo fields — passed through from station data
      is_promoted: best.is_promoted,
      discount_pct: best.discount_pct,
      price_per_kwh: best.price_per_kwh,
      promo_ends_at: best.promo_ends_at ? best.promo_ends_at.toISOString() : null,
    });

    coveredKm += distToStation;
    currentBattery = targetBattery;
    currentLat = best.lat;
    currentLng = best.lng;
  }

  // ── Safety net ────────────────────────────────────────────────────────────
  // The while loop exited without adding any stops despite the trip needing them.
  // This happens when all stations are filtered by the d > 5 guard (dense city area,
  // very low battery, or short trip where origin ≈ nearest station).
  if (stops.length === 0) {
    // Relax the minimum-distance guard to 0.5 km and search from the origin.
    const safeOriginRange = (batteryPct / 100) * vehicle.range_km * 0.75;
    const fromOrigin = stations
      .filter(s => {
        const d = dist2d(originLat, originLng, s.lat, s.lng);
        return d <= safeOriginRange && d > 0.5;
      })
      .sort((a, b) => dist2d(a.lat, a.lng, destLat, destLng) - dist2d(b.lat, b.lng, destLat, destLng));

    if (fromOrigin.length === 0) {
      // No station reachable at all → caller must inform the user.
      return {
        stops: [],
        total_distance_km: parseFloat(totalDistKm.toFixed(1)),
        total_time_min: Math.round(totalDistKm / speedKmPerMin),
        final_battery_pct: 0,
        insufficient_charge: true,
        message: "Недостаточно заряда для этой поездки. Зарядитесь перед выездом или выберите более близкий пункт назначения.",
      };
    }

    // Add the best reachable station as a mandatory first stop.
    const best = fromOrigin[0];
    const distToStation = dist2d(originLat, originLng, best.lat, best.lng);
    const arrivalBattery = Math.max(5, batteryPct - (distToStation / vehicle.range_km) * 100);
    const energyNeeded = ((targetBattery - arrivalBattery) / 100) * vehicle.battery_kwh;
    const chargeTimeMin = Math.round((energyNeeded / best.power_kw) * 60);
    const eta = new Date(Date.now() + Math.round(distToStation / speedKmPerMin) * 60_000);
    const connectors = best.connectors ?? [];
    const primary = [...connectors].sort((a, b) => b.power_kw - a.power_kw)[0];

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
      connector_type: primary?.type ?? "CCS2",
      connector_power_kw: primary?.power_kw ?? best.power_kw,
      eta: eta.toTimeString().slice(0, 5),
      is_promoted: best.is_promoted,
      discount_pct: best.discount_pct,
      price_per_kwh: best.price_per_kwh,
      promo_ends_at: best.promo_ends_at ? best.promo_ends_at.toISOString() : null,
    });
  }

  const distToDestFromLast = dist2d(currentLat, currentLng, destLat, destLng);
  const finalBattery = Math.round(Math.max(5, currentBattery - (distToDestFromLast / vehicle.range_km) * 100));
  const totalTimeMin = Math.round(totalDistKm / speedKmPerMin) + stops.reduce((acc, s) => acc + s.charge_time_min, 0);
  return {
    stops,
    total_distance_km: parseFloat(totalDistKm.toFixed(1)),
    total_time_min: totalTimeMin,
    final_battery_pct: finalBattery,
  };
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

      const { polyline, google_steps } = route.status === "active"
        ? await fetchRoadPolyline(waypoints)
        : { polyline: [] as Array<[number,number]>, google_steps: [] };
      return { ...route, vehicle: r.vehicle ?? undefined, polyline, google_steps };
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
    .select({
      id: stationsTable.id, name: stationsTable.name, address: stationsTable.address,
      lat: stationsTable.lat, lng: stationsTable.lng, power_kw: stationsTable.power_kw,
      connectors: stationsTable.connectors,
      is_promoted: stationsTable.is_promoted,
      discount_pct: stationsTable.discount_pct,
      price_per_kwh: stationsTable.price_per_kwh,
      promo_ends_at: stationsTable.promo_ends_at,
    })
    .from(stationsTable)
    .where(eq(stationsTable.status, "free"));

  const mode = (req.body.mode === "eco" ? "eco" : "fast") as "fast" | "eco";
  const plan = planRoute(originLat, originLng, destLat, destLng, initial_battery_pct, vehicle, allStations, mode);

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

  const stops: any[] = plan.stops;
  const waypoints = [
    { lat: originLat, lng: originLng },
    ...stops.filter((s) => s.lat && s.lng).map((s) => ({ lat: s.lat, lng: s.lng })),
    { lat: destLat, lng: destLng },
  ];
  const { polyline, google_steps } = await fetchRoadPolyline(waypoints);

  const [v] = vehicle_id
    ? await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicle_id))
    : [undefined];

  res.status(201).json({ ...route, vehicle: v ?? undefined, polyline, google_steps });
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
  const { polyline, google_steps } = await fetchRoadPolyline(waypoints);
  res.json({ ...route, vehicle: row.vehicle ?? undefined, polyline, google_steps });
});

// ── DELETE /routes/:id ────────────────────────────────────────────────────
router.delete("/routes/:id", async (req, res): Promise<void> => {
  const p = DeleteRouteParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(routesTable).where(eq(routesTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;
