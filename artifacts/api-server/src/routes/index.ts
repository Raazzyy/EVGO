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

const router = Router();

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

export default router;
