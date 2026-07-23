import { Router } from "express";
import healthRouter from "./health";
import operatorsRouter from "./operators";
import stationsRouter from "./stations";
import vehiclesRouter from "./vehicles";
import sessionsRouter from "./sessions";
import routesRouter from "./routes_route";
import usersRouter from "./users";
import paymentMethodsRouter from "./payment_methods";
import adminRouter from "./admin";
import supportRouter from "./support";
import notificationsRouter from "./notifications";
import favoritesRouter from "./favorites";
import connectorsRouter from "./connectors";
import promosRouter from "./promos";
import bannersRouter from "./banners";

const router = Router();

// ── Address formatting helper ─────────────────────────────────────────────
// Builds "Город, Район, Улица, Дом" — skips country prefix.
function formatAddressFromComponents(
  components: { kind: string; name: string }[],
): string {
  const get = (kind: string) =>
    components.find((c) => c.kind === kind)?.name ?? "";

  const country  = get("country");
  const province = get("province");
  const locality = get("locality");
  const district = get("district");
  const street   = get("street");
  const house    = get("house");

  const parts: string[] = [];

  // City first; fall back to province only if it's not the same as country
  if (locality) {
    parts.push(locality);
  } else if (province && province !== country) {
    parts.push(province);
  }

  // District only if it differs from locality (avoids "Ташкент, Ташкент")
  if (district && district !== locality) parts.push(district);

  // Street + house on the same part
  if (street) parts.push(house ? `${street}, ${house}` : street);
  else if (house) parts.push(house);

  return parts.join(", ");
}

// ── Config endpoint — exposes public keys for client-side use ─────────────
router.get("/config", (_req, res) => {
  res.json({
    yandex_maps_key:  process.env.YANDEX_JS_API_KEY      ?? "",
    google_maps_key:  process.env.GOOGLE_MAPS_ANDROID_KEY ?? "",
  });
});

// ── Reverse geocoding proxy ───────────────────────────────────────────────
// GET /api/geocode/reverse?lat=&lng=
// Returns { address: "Ташкент, Мирзо-Улугбекский район, ул. X" }
router.get("/geocode/reverse", async (req, res): Promise<void> => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "lat and lng are required numbers" });
    return;
  }
  const apikey = process.env.YANDEX_GEOCODER_KEY;
  if (!apikey) {
    res.status(503).json({ error: "Geocoder not configured" });
    return;
  }
  try {
    // Yandex expects geocode=LNG,LAT (longitude first)
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apikey}&geocode=${lng},${lat}&format=json&lang=ru_RU&results=1&kind=house`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      const body = await r.text();
      console.error(`[geocode/reverse] Yandex error ${r.status}:`, body);
      res.status(502).json({ error: "Geocoder upstream error", status: r.status });
      return;
    }
    const data: any = await r.json();
    const members: any[] = data?.response?.GeoObjectCollection?.featureMember ?? [];
    const geoObj = members[0]?.GeoObject;

    // Try component-based formatting first (no country prefix)
    const components: { kind: string; name: string }[] =
      geoObj?.metaDataProperty?.GeocoderMetaData?.Address?.Components ?? [];
    const address = components.length > 0
      ? formatAddressFromComponents(components)
      : (geoObj?.metaDataProperty?.GeocoderMetaData?.text ?? null);

    res.json({ address });
  } catch (err: any) {
    console.error("[geocode/reverse] fetch error:", err?.message ?? err);
    res.status(502).json({ error: "Geocoder fetch failed" });
  }
});

// ── Address suggest (autocomplete) proxy ─────────────────────────────────
// GET /api/geocode/suggest?q=QUERY[&lat=LAT&lng=LNG]
// Uses Yandex Geocoder as a suggest source — returns coordinates immediately.
// Response: [{ title, subtitle, lat, lng }, ...]
router.get("/geocode/suggest", async (req, res): Promise<void> => {
  const q = ((req.query.q as string) ?? "").trim();
  if (q.length < 2) { res.json([]); return; }

  const apikey = process.env.YANDEX_GEOCODER_KEY;
  if (!apikey) {
    res.status(503).json({ error: "Geocoder not configured" });
    return;
  }

  // Optional: bias results toward the user's current location
  const bLat = parseFloat(req.query.lat as string);
  const bLng = parseFloat(req.query.lng as string);

  const params = new URLSearchParams({
    apikey,
    geocode: q,
    format:  "json",
    lang:    "ru_RU",
    results: "7",
  });

  if (!isNaN(bLat) && !isNaN(bLng)) {
    // ll = LNG,LAT  •  spn = lon_span,lat_span (≈1° ≈ 110 km)
    params.set("ll",  `${bLng},${bLat}`);
    params.set("spn", "2,2");
  } else {
    // Default bounding box for Uzbekistan
    params.set("bbox", "55.0,37.0~73.0,45.5");
  }

  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?${params}`;
    const r   = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      console.error(`[geocode/suggest] Yandex error ${r.status}`);
      res.json([]);
      return;
    }

    const data: any = await r.json();
    const members: any[] = data?.response?.GeoObjectCollection?.featureMember ?? [];

    const suggestions = members
      .map((m: any) => {
        const obj  = m.GeoObject;
        const pos: string = obj?.Point?.pos ?? "";          // "LNG LAT"
        const [lngStr, latStr] = pos.split(" ");
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (isNaN(lat) || isNaN(lng)) return null;

        const components: { kind: string; name: string }[] =
          obj?.metaDataProperty?.GeocoderMetaData?.Address?.Components ?? [];

        const title    = formatAddressFromComponents(components);
        const country  = components.find((c) => c.kind === "country")?.name ?? "";
        // subtitle: province if different from city, else country
        const locality = components.find((c) => c.kind === "locality")?.name ?? "";
        const province = components.find((c) => c.kind === "province")?.name ?? "";
        const subtitle = (province && province !== locality) ? province : country;

        return { title: title || obj?.name || q, subtitle, lat, lng };
      })
      .filter(Boolean);

    console.log(`[geocode/suggest] q="${q}" → ${suggestions.length} results`);
    res.json(suggestions);
  } catch (err: any) {
    console.error("[geocode/suggest] fetch error:", err?.message ?? err);
    res.json([]);
  }
});

router.use(healthRouter);
router.use(operatorsRouter);
router.use(stationsRouter);
router.use(vehiclesRouter);
router.use(sessionsRouter);
router.use(routesRouter);
router.use(usersRouter);
router.use(paymentMethodsRouter);
router.use(adminRouter);
router.use(supportRouter);
router.use(notificationsRouter);
router.use(favoritesRouter);
router.use(connectorsRouter);
router.use(promosRouter);
router.use(bannersRouter);

export default router;
