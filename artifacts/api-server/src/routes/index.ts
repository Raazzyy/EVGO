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

const router = Router();

// Config endpoint — exposes public keys for client-side use
router.get("/config", (_req, res) => {
  res.json({
    yandex_maps_key: process.env.YANDEX_JS_API_KEY ?? "",
    google_maps_key: process.env.GOOGLE_MAPS_ANDROID_KEY ?? "",
  });
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

export default router;
