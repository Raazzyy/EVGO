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

const router = Router();

// Config endpoint — exposes public keys for client-side use
router.get("/config", (_req, res) => {
  res.json({
    yandex_maps_key: process.env.YANDEX_JS_API_KEY ?? "",
    google_maps_key: process.env.GOOGLE_MAPS_ANDROID_KEY ?? "",
  });
});

// Reverse geocoding proxy — keeps YANDEX_GEOCODER_KEY server-side
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
    const address = members[0]?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text ?? null;
    res.json({ address });
  } catch (err: any) {
    console.error("[geocode/reverse] fetch error:", err?.message ?? err);
    res.status(502).json({ error: "Geocoder fetch failed" });
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

export default router;
