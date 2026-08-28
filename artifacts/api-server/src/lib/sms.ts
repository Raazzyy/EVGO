import { logger } from "./logger";

/**
 * Отправка SMS.
 *
 * Драйвер выбирается по переменным окружения:
 *   • заданы ESKIZ_EMAIL и ESKIZ_PASSWORD → отправка через notify.eskiz.uz
 *   • не заданы → заглушка, пишет сообщение в лог
 *
 * Заглушка нужна, чтобы разрабатывать вход по телефону, не дожидаясь договора
 * со шлюзом. В продакшене она молча не включается: если NODE_ENV=production и
 * шлюз не настроен, отправка падает — иначе коды подтверждения тихо уходили бы
 * в лог, а пользователи не могли войти.
 *
 * Важно про Eskiz: текст сообщения проходит модерацию. Отправить произвольную
 * строку нельзя — шаблон согласуется в кабинете, и только он потом работает.
 * Имя отправителя (`from`) регистрируется отдельно, в песочнице это `4546`.
 */

const ESKIZ_BASE = "https://notify.eskiz.uz";

interface CachedToken {
  value: string;
  /** Токен Eskiz живёт ограниченное время; обновляем заранее. */
  fetchedAt: number;
}

let cachedToken: CachedToken | null = null;
const TOKEN_MAX_AGE_MS = 20 * 24 * 60 * 60 * 1000; // 20 дней, с запасом

function eskizConfigured(): boolean {
  return Boolean(process.env["ESKIZ_EMAIL"] && process.env["ESKIZ_PASSWORD"]);
}

async function eskizLogin(): Promise<string> {
  const form = new FormData();
  form.append("email", process.env["ESKIZ_EMAIL"] as string);
  // Пароль здесь — секретный ключ из кабинета, а не пароль от аккаунта.
  form.append("password", process.env["ESKIZ_PASSWORD"] as string);

  const res = await fetch(`${ESKIZ_BASE}/api/auth/login`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Eskiz login failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { data?: { token?: string } };
  const token = body?.data?.token;
  if (!token) throw new Error("Eskiz login returned no token");

  cachedToken = { value: token, fetchedAt: Date.now() };
  return token;
}

async function eskizToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_MAX_AGE_MS) {
    return cachedToken.value;
  }
  return eskizLogin();
}

async function eskizSend(phone: string, message: string, retry = true): Promise<void> {
  const token = await eskizToken();

  const form = new FormData();
  form.append("mobile_phone", phone); // 998XXXXXXXXX, без плюса
  form.append("message", message);
  form.append("from", process.env["ESKIZ_FROM"] ?? "4546");

  const callback = process.env["ESKIZ_CALLBACK_URL"];
  if (callback) form.append("callback_url", callback);

  const res = await fetch(`${ESKIZ_BASE}/api/message/sms/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });

  if (res.ok) return;

  // Протухший токен Eskiz отдаёт как 401 или 500 — логинимся заново и пробуем ещё раз.
  if (retry && (res.status === 401 || res.status === 500)) {
    await eskizToken(true);
    return eskizSend(phone, message, false);
  }

  throw new Error(`Eskiz send failed: ${res.status} ${await res.text()}`);
}

export async function sendSms(phone: string, message: string): Promise<void> {
  if (eskizConfigured()) {
    await eskizSend(phone, message);
    return;
  }

  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      "SMS gateway is not configured: set ESKIZ_EMAIL and ESKIZ_PASSWORD",
    );
  }

  logger.warn({ phone, message }, "[SMS STUB] шлюз не настроен, сообщение не отправлено");
}

/** Показывается в /api/health, чтобы было видно, работает ли отправка по-настоящему. */
export function smsDriverName(): "eskiz" | "stub" {
  return eskizConfigured() ? "eskiz" : "stub";
}
