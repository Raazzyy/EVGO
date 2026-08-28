import { createHmac, randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * Аутентификация пользователей приложения: вход по номеру телефона с
 * подтверждением кодом из SMS.
 *
 * Токенов два:
 *   • access  — короткоживущий, ходит в каждом запросе, в БД не хранится
 *   • refresh — долгоживущий, лежит в `refresh_tokens` в виде SHA-256,
 *               меняется на новую пару и может быть отозван
 *
 * Формат access-токена тот же, что у админского: `base64url(<id>:<issuedAt>).<подпись>`.
 * Полноценный JWT здесь не нужен — подписывающая и проверяющая стороны одни
 * и те же, а лишняя зависимость на ровном месте ни к чему.
 */

export const ACCESS_TTL_MS = 30 * 60 * 1000;              // 30 минут
export const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;   // 60 дней
export const OTP_TTL_MS = 5 * 60 * 1000;                  // 5 минут
export const OTP_MAX_ATTEMPTS = 5;

function masterSecret(): string {
  const secret = process.env["AUTH_JWT_SECRET"] ?? process.env["ADMIN_JWT_SECRET"];
  if (!secret) throw new Error("AUTH_JWT_SECRET / ADMIN_JWT_SECRET is not set");
  return secret;
}

/**
 * Отдельный ключ на каждое назначение. Иначе при совпадении секретов
 * пользовательский токен подошёл бы к админке — подпись-то одна и та же.
 */
function derivedKey(purpose: "access" | "otp"): Buffer {
  return createHmac("sha256", masterSecret()).update(`ion:${purpose}`).digest();
}

// ── Номер телефона ────────────────────────────────────────────────────────────

/** Коды операторов Узбекистана. Номера вне этого списка не принимаем. */
const UZ_OPERATOR_CODES = ["33", "77", "88", "90", "91", "93", "94", "95", "97", "98", "99"];

/**
 * Приводит ввод пользователя к каноническому виду `998XXXXXXXXX`.
 * Принимает `+998 90 123-45-67`, `998901234567`, `901234567`.
 * Возвращает null, если номер не узбекский или неверной длины.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  // Локальная запись без кода страны — дополняем.
  const withCountry = digits.length === 9 ? `998${digits}` : digits;

  if (withCountry.length !== 12) return null;
  if (!withCountry.startsWith("998")) return null;

  const operator = withCountry.slice(3, 5);
  if (!UZ_OPERATOR_CODES.includes(operator)) return null;

  return withCountry;
}

// ── Коды подтверждения ────────────────────────────────────────────────────────

/** Шестизначный код. `randomInt` не используем: нужен ровно фиксированный формат. */
export function generateOtpCode(): string {
  // 3 байта дают 0..16777215, приводим к диапазону 000000..999999.
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

/**
 * Хеш кода. В БД лежит только он — дамп таблицы не должен выдавать
 * действующие коды. Номер входит в хеш, чтобы код одного номера не подошёл
 * к другому.
 */
export function hashOtpCode(phone: string, code: string): string {
  return createHmac("sha256", derivedKey("otp")).update(`${phone}:${code}`).digest("hex");
}

export function otpCodeMatches(phone: string, code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtpCode(phone, code));
  const stored = Buffer.from(storedHash);
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

// ── Access-токен ──────────────────────────────────────────────────────────────

export function signAccessToken(userId: string): string {
  const payload = Buffer.from(`${userId}:${Date.now()}`).toString("base64url");
  const sig = createHmac("sha256", derivedKey("access")).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Возвращает id пользователя или null, если токен подделан либо протух. */
export function verifyAccessToken(token: string): string | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;

    const expected = createHmac("sha256", derivedKey("access")).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    // id пользователя может содержать ":", поэтому режем по последнему.
    const decoded = Buffer.from(payload, "base64url").toString();
    const sep = decoded.lastIndexOf(":");
    if (sep < 1) return null;

    const userId = decoded.slice(0, sep);
    const issuedAt = Number(decoded.slice(sep + 1));
    if (!userId || !Number.isFinite(issuedAt)) return null;
    if (Date.now() - issuedAt > ACCESS_TTL_MS) return null;

    return userId;
  } catch {
    return null;
  }
}

// ── Refresh-токен ─────────────────────────────────────────────────────────────

/** Возвращает пару: сам токен (уходит клиенту) и его хеш (ложится в БД). */
export function createRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  // Токен уже случайный и длинный, солить и растягивать нечего —
  // достаточно быстрого хеша, чтобы в базе не лежало исходное значение.
  return createHash("sha256").update(token).digest("hex");
}
