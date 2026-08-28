import type { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyAccessToken } from "../lib/auth";
import { verifyAdminToken } from "../routes/admin";

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
      /** true, если запрос пришёл с админским токеном, а не пользовательским. */
      isAdmin?: boolean;
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
 * Пропускает и пользователя, и администратора.
 *
 * Нужно там, где один маршрут обслуживает оба клиента: пользователь видит
 * только свои сессии, админка — все. Различать их обязательно, иначе либо
 * админка перестанет работать, либо любой пользователь увидит чужие данные.
 */
export const requireUserOrAdmin: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized", code: "token_missing" });
    return;
  }

  const userId = verifyAccessToken(token);
  if (userId) {
    req.userId = userId;
    next();
    return;
  }

  if (verifyAdminToken(token)) {
    req.isAdmin = true;
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized", code: "token_invalid" });
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
