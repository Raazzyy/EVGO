import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Ограничение частоты запросов. Счётчики живут в памяти процесса —
 * этого достаточно, пока сервер запущен в одном экземпляре. При переезде на
 * несколько инстансов хранилище нужно вынести в Redis, интерфейс не изменится.
 *
 * Окно фиксированное: счётчик обнуляется целиком по истечении windowMs.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Длина окна в миллисекундах. */
  windowMs: number;
  /** Сколько запросов разрешено в окне. */
  max: number;
  /** Чем различаем клиентов. По умолчанию — IP. */
  keyFn?: (req: Request) => string;
  /** Текст ошибки для клиента. */
  message?: string;
}

const stores = new Set<Map<string, Bucket>>();

// Раз в минуту выбрасываем протухшие записи, иначе Map растёт бесконечно.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const store of stores) {
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  }
}, 60_000);
// Таймер не должен удерживать процесс от завершения.
sweeper.unref?.();

function defaultKey(req: Request): string {
  // req.ip корректен только при выставленном trust proxy — см. app.ts.
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const { windowMs, max, keyFn = defaultKey, message } = options;
  const store = new Map<string, Bucket>();
  stores.add(store);

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const key = keyFn(req);
    const now = Date.now();

    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(resetSeconds));
      res.status(429).json({
        error: message ?? "Слишком много запросов, попробуйте позже",
        retry_after_seconds: resetSeconds,
      });
      return;
    }

    next();
  };
}
