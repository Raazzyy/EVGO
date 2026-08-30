import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db, webPushSubscriptionsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Web Push для веб-версии (задача 58).
 *
 * Ключи VAPID берём из окружения (сгенерировать: `npx web-push generate-vapid-keys`):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:… или https-URL).
 * Публичный ключ отдаётся клиенту через /config, приватный не покидает сервер.
 *
 * Без ключей функции превращаются в no-op — сервер спокойно работает, просто
 * веб-push не отправляется (мобильный Expo-push при этом не затронут).
 */

let configured = false;
const pub = process.env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:support@evgo.uz";

if (pub && priv) {
  try {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
    logger.info("[webpush] VAPID настроен — веб-push включён");
  } catch (e) {
    logger.warn({ err: e }, "[webpush] некорректные VAPID-ключи — веб-push отключён");
  }
} else {
  logger.info("[webpush] VAPID-ключи не заданы — веб-push отключён");
}

export function webPushConfigured(): boolean {
  return configured;
}

export function vapidPublicKey(): string {
  return pub ?? "";
}

export interface WebPushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Сохранить/обновить подписку браузера. Идемпотентно по endpoint. */
export async function saveSubscription(userId: string, sub: WebPushSubscriptionInput): Promise<void> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("saveSubscription: неполная подписка");
  }
  await db.insert(webPushSubscriptionsTable).values({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  }).onConflictDoUpdate({
    target: webPushSubscriptionsTable.endpoint,
    set: { user_id: userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await db.delete(webPushSubscriptionsTable).where(eq(webPushSubscriptionsTable.endpoint, endpoint));
}

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Отправить веб-push всем браузерам пользователя. Мёртвые подписки (404/410)
 * удаляются — браузер отписался, и держать их незачем.
 * Возвращает число успешных доставок.
 */
export async function sendWebPush(userId: string, payload: WebPushPayload): Promise<number> {
  if (!configured) return 0;
  const subs = await db.select().from(webPushSubscriptionsTable)
    .where(eq(webPushSubscriptionsTable.user_id, userId));
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      );
      delivered++;
    } catch (e: any) {
      const status = e?.statusCode;
      if (status === 404 || status === 410) {
        await removeSubscription(s.endpoint).catch(() => {});
      } else {
        logger.warn({ err: e, endpoint: s.endpoint.slice(0, 40) }, "[webpush] доставка не удалась");
      }
    }
  }));

  return delivered;
}
