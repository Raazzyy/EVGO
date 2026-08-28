import type { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyAccessToken } from "../lib/auth";

/**
 * Достаёт пользователя из access-токена и кладёт его id в `req.userId`.
 *
 * После подключения этого middleware обработчики обязаны брать владельца
 * данных из `req.userId`, а не из тела или query-параметров запроса: значение
 * от клиента подделывается тривиально, и по нему видны чужие данные.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers["authorization"] ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

/** Запрос без валидного токена не проходит дальше. */
export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const token = extractToken(req);
  const userId = token ? verifyAccessToken(token) : null;

  if (!userId) {
    // Клиент по 401 понимает, что пора обновить пару токенов через
    // POST /api/auth/refresh, и повторить запрос.
    res.status(401).json({ error: "Unauthorized", code: "token_invalid" });
    return;
  }

  req.userId = userId;
  next();
};

/**
 * Токен необязателен, но если он есть и валиден — `req.userId` заполняется.
 * Для страниц, которые работают и без входа: карта станций одинакова для всех,
 * но авторизованному можно подсветить избранное.
 */
export const optionalAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const token = extractToken(req);
  const userId = token ? verifyAccessToken(token) : null;
  if (userId) req.userId = userId;
  next();
};
