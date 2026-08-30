import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { saveSubscription, removeSubscription, vapidPublicKey, webPushConfigured } from "../lib/webpush";

/**
 * Подписка веб-версии на push (задача 58).
 *   GET  /web-push/public-key       — публичный VAPID-ключ для клиента
 *   POST /web-push/subscribe        — сохранить подписку браузера
 *   POST /web-push/unsubscribe      — удалить подписку
 */
const router: IRouter = Router();

router.get("/web-push/public-key", (_req, res): void => {
  res.json({ key: vapidPublicKey(), enabled: webPushConfigured() });
});

router.post("/web-push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const sub = req.body?.subscription ?? req.body;
  try {
    await saveSubscription(req.userId as string, sub);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Некорректная подписка", code: "bad_subscription" });
  }
});

router.post("/web-push/unsubscribe", requireAuth, async (req, res): Promise<void> => {
  const endpoint = String(req.body?.endpoint ?? "");
  if (!endpoint) { res.status(400).json({ error: "endpoint обязателен" }); return; }
  await removeSubscription(endpoint);
  res.json({ ok: true });
});

export default router;
