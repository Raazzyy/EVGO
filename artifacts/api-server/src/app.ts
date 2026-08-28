import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { rateLimit } from "./middlewares/rateLimit";

const app: Express = express();

// Сервер стоит за одним прокси (Replit). Без этого req.ip у всех запросов
// одинаков, и ограничение по частоте считается на весь мир разом.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Общий предел на весь API — защита от перебора и случайных циклов в клиенте.
app.use("/api", rateLimit({ windowMs: 60_000, max: 300 }));

// Геокодер и подсказки адресов проксируются в Яндекс и тарифицируются
// поштучно, поэтому лимит на них отдельный и жёстче общего.
app.use(
  "/api/geocode",
  rateLimit({
    windowMs: 60_000,
    max: 30,
    message: "Слишком много запросов к геокодеру, подождите минуту",
  }),
);

// Запрос кода подтверждения — дополнительный предел по адресу. Ограничения на
// сам номер живут в БД (см. routes/auth.ts): в памяти они обнулялись бы при
// каждом перезапуске, и через нас слали бы SMS за наш счёт.
app.use(
  "/api/auth/request-code",
  rateLimit({
    windowMs: 60 * 60_000,
    max: 20,
    message: "Слишком много запросов кода, попробуйте позже",
  }),
);

// Подбор пароля к админке — по 10 попыток в 15 минут с адреса.
app.use(
  "/api/admin/login",
  rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "Слишком много попыток входа, попробуйте позже",
  }),
);

app.use("/api", router);

export default app;
