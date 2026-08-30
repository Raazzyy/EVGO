import { and, eq, inArray } from "drizzle-orm";
import { db, pushTokensTable, notificationsTable, usersTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Отправка push-уведомлений через Expo Push API.
 *
 * Отдельный ключ не нужен: Expo принимает запросы по токену устройства,
 * который приложение получает само при первом запуске.
 *
 * Уведомление всегда пишется в таблицу `notifications` — даже если доставка
 * не удалась. Экран уведомлений в приложении читает именно её, и человек
 * увидит сообщение, когда откроет приложение, даже если push не дошёл.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo принимает не больше 100 сообщений за запрос. */
const BATCH_SIZE = 100;

export type NotificationType =
  | "session_ended"
  | "discount_nearby"
  | "station_available"
  | "low_battery";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  /** Данные для перехода на нужный экран при нажатии. */
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Тексты уведомлений на трёх языках.
 *
 * Язык берётся из профиля: человек, выбравший узбекский, не должен получать
 * push по-русски. Подстановки — простые, без плюрализации: она понадобилась
 * бы для «N станций», а таких сообщений здесь нет.
 */
const TEXTS: Record<
  NotificationType,
  Record<"uz" | "ru" | "en", { title: string; body: (v: Record<string, string>) => string }>
> = {
  session_ended: {
    ru: {
      title: "Зарядка завершена",
      body: (v) => `${v.station}: ${v.energy} кВт·ч за ${v.cost}`,
    },
    uz: {
      title: "Zaryadlash tugadi",
      body: (v) => `${v.station}: ${v.energy} kVt·s, ${v.cost}`,
    },
    en: {
      title: "Charging finished",
      body: (v) => `${v.station}: ${v.energy} kWh for ${v.cost}`,
    },
  },
  station_available: {
    ru: {
      title: "Коннектор освободился",
      body: (v) => `${v.station} — можно ехать заряжаться`,
    },
    uz: {
      title: "Konnektor bo'shadi",
      body: (v) => `${v.station} — zaryadlashga borish mumkin`,
    },
    en: {
      title: "Connector is free",
      body: (v) => `${v.station} — you can head over`,
    },
  },
  discount_nearby: {
    ru: {
      title: "Скидка рядом",
      body: (v) => `${v.station}: −${v.discount}% до ${v.until}`,
    },
    uz: {
      title: "Yaqinda chegirma",
      body: (v) => `${v.station}: −${v.discount}%, ${v.until} gacha`,
    },
    en: {
      title: "Discount nearby",
      body: (v) => `${v.station}: −${v.discount}% until ${v.until}`,
    },
  },
  low_battery: {
    ru: {
      title: "Низкий заряд",
      body: (v) => `Осталось ${v.percent}% — ближайшая станция в ${v.distance}`,
    },
    uz: {
      title: "Zaryad kam",
      body: (v) => `${v.percent}% qoldi — eng yaqin stansiya ${v.distance}`,
    },
    en: {
      title: "Low battery",
      body: (v) => `${v.percent}% left — nearest station is ${v.distance} away`,
    },
  },
};

function pickLanguage(value: string | null | undefined): "uz" | "ru" | "en" {
  return value === "uz" || value === "en" ? value : "ru";
}

/**
 * Отправляет push и сохраняет уведомление в историю.
 *
 * Не бросает исключений: уведомление — не та операция, ради которой стоит
 * ронять запрос, начавший зарядку. Ошибки уходят в лог.
 */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  vars: Record<string, string>,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const [user] = await db
      .select({
        language: usersTable.language,
        notify_session_ended: usersTable.notify_session_ended,
        notify_station_available: usersTable.notify_station_available,
        notify_discount_nearby: usersTable.notify_discount_nearby,
        notify_low_battery: usersTable.notify_low_battery,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    // Отключённый тип уведомлений не шлём push, но в историю пишем: человек
    // отказался от всплывающих сообщений, а не от самой информации — на
    // экране уведомлений она должна быть.
    const allowed = user
      ? {
          session_ended: user.notify_session_ended,
          station_available: user.notify_station_available,
          discount_nearby: user.notify_discount_nearby,
          low_battery: user.notify_low_battery,
        }[type]
      : true;

    const lang = pickLanguage(user?.language);
    const text = TEXTS[type][lang];
    const title = text.title;
    const body = text.body(vars);

    // Историю пишем всегда: экран уведомлений читает её, а не Expo.
    await db.insert(notificationsTable).values({ user_id: userId, type, title, body });

    if (!allowed) return;

    const tokens = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.user_id, userId));

    if (tokens.length === 0) return;

    await sendExpoPush(
      tokens.map((t) => ({
        to: t.token,
        title,
        body,
        sound: "default" as const,
        data: { type, ...data },
      })),
    );
  } catch (err) {
    logger.error({ err, userId, type }, "Не удалось отправить уведомление");
  }
}

/**
 * Отправляет пачку сообщений в Expo и убирает токены, которые он отверг.
 *
 * Устройство может удалить приложение или переустановить его — тогда токен
 * перестаёт работать навсегда, и Expo отвечает `DeviceNotRegistered`. Такие
 * токены нужно удалять, иначе таблица растёт мёртвыми записями, а каждая
 * отправка тратит время на заведомо провальные адреса.
 */
async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

    let res: Response;
    try {
      res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logger.warn({ err }, "Expo Push недоступен");
      return;
    }

    if (!res.ok) {
      logger.warn({ status: res.status }, "Expo Push вернул ошибку");
      return;
    }

    const payload = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = payload.data ?? [];

    const dead: string[] = [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const message = batch[index];
        if (message) dead.push(message.to);
      }
    });

    if (dead.length > 0) {
      await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, dead));
      logger.info({ count: dead.length }, "Удалены недействительные push-токены");
    }
  }
}

/**
 * Уведомляет тех, кто ждал освобождения коннектора, и снимает их с ожидания.
 *
 * Подписка одноразовая: человек попросил сообщить, когда коннектор
 * освободится, — сообщили и сняли. Иначе он получал бы уведомление при
 * каждом освобождении этой станции.
 */
export async function notifyConnectorWatchers(
  connectorId: number,
  stationName: string,
): Promise<void> {
  try {
    const { connectorWatchersTable } = await import("@workspace/db");

    const watchers = await db
      .select({ user_id: connectorWatchersTable.user_id })
      .from(connectorWatchersTable)
      .where(eq(connectorWatchersTable.connector_id, connectorId));

    if (watchers.length === 0) return;

    await Promise.all(
      watchers.map((w) =>
        notifyUser(w.user_id, "station_available", { station: stationName }, { connectorId }),
      ),
    );

    await db
      .delete(connectorWatchersTable)
      .where(eq(connectorWatchersTable.connector_id, connectorId));
  } catch (err) {
    logger.error({ err, connectorId }, "Не удалось уведомить наблюдателей коннектора");
  }
}
