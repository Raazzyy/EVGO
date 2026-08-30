import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, usersTable, otpCodesTable, refreshTokensTable } from "@workspace/db";
import { z } from "zod";
import {
  ACCESS_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  REFRESH_TTL_MS,
  createRefreshToken,
  generateOtpCode,
  hashOtpCode,
  hashRefreshToken,
  normalizePhone,
  otpCodeMatches,
  signAccessToken,
} from "../lib/auth";
import { sendSms } from "../lib/sms";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Ограничения на запрос кода ───────────────────────────────────────────────
// Считаются по БД, а не в памяти: перезапуск сервера не должен обнулять счётчик,
// иначе через нас будут слать SMS за наш счёт.
const RESEND_COOLDOWN_MS = 60 * 1000;   // не чаще раза в минуту на номер
const MAX_CODES_PER_HOUR = 5;           // не больше пяти в час на номер

const PhoneBody = z.object({ phone: z.string().min(6).max(20) });
const VerifyBody = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().regex(/^\d{6}$/, "Код состоит из 6 цифр"),
  device: z.string().max(200).optional(),
});
const RefreshBody = z.object({ refresh_token: z.string().min(10) });

/**
 * Демонстрационный вход для проверяющих в App Store и Google Play.
 *
 * Вход в приложение идёт по SMS-коду на узбекский номер, а у ревьюера такого
 * номера нет — без обходного пути заявку отклоняют с формулировкой «не
 * удалось войти».
 *
 * Включается только когда заданы обе переменные окружения. На боевом сервере
 * их стоит убрать после прохождения ревью: пока они заданы, кто угодно,
 * знающий пару номер-код, войдёт под демо-аккаунтом.
 */
function demoCodeFor(phone: string): string | null {
  const demoPhone = process.env["DEMO_PHONE"];
  const demoCode = process.env["DEMO_CODE"];
  if (!demoPhone || !demoCode) return null;
  return normalizePhone(demoPhone) === phone ? demoCode : null;
}

function badPhone(res: Parameters<Parameters<IRouter["post"]>[1]>[1]): void {
  res.status(400).json({
    error: "Неверный номер телефона",
    code: "invalid_phone",
    hint: "Ожидается номер оператора Узбекистана, например +998 90 123 45 67",
  });
}

// ── POST /api/auth/request-code ──────────────────────────────────────────────
router.post("/auth/request-code", async (req, res): Promise<void> => {
  const parsed = PhoneBody.safeParse(req.body);
  if (!parsed.success) { badPhone(res); return; }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) { badPhone(res); return; }

  const now = new Date();

  // Последний код по этому номеру — для паузы между отправками.
  const [last] = await db
    .select({ created_at: otpCodesTable.created_at })
    .from(otpCodesTable)
    .where(eq(otpCodesTable.phone, phone))
    .orderBy(desc(otpCodesTable.created_at))
    .limit(1);

  if (last) {
    const sinceLast = now.getTime() - last.created_at.getTime();
    if (sinceLast < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000);
      res.status(429).json({
        error: "Код уже отправлен, подождите перед повторной отправкой",
        code: "too_soon",
        retry_after_seconds: wait,
      });
      return;
    }
  }

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [{ value: lastHour }] = await db
    .select({ value: count() })
    .from(otpCodesTable)
    .where(and(eq(otpCodesTable.phone, phone), gte(otpCodesTable.created_at, hourAgo)));

  if (lastHour >= MAX_CODES_PER_HOUR) {
    res.status(429).json({
      error: "Слишком много запросов кода, попробуйте через час",
      code: "hourly_limit",
      retry_after_seconds: 3600,
    });
    return;
  }

  const demo = demoCodeFor(phone);
  const code = demo ?? generateOtpCode();

  await db.insert(otpCodesTable).values({
    phone,
    code_hash: hashOtpCode(phone, code),
    expires_at: new Date(now.getTime() + OTP_TTL_MS),
  });

  // Демо-номеру SMS не отправляем: код проверяющий и так знает, а отправка
  // на несуществующий номер только тратит деньги и упирается в ошибку шлюза.
  if (demo) {
    res.json({
      sent: true,
      expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
      resend_after_seconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
    });
    return;
  }

  try {
    // Текст обязан совпадать с шаблоном, согласованным в кабинете Eskiz.
    await sendSms(phone, `EVGO: kirish uchun kod ${code}. Kodni hech kimga aytmang.`);
  } catch (err) {
    logger.error({ err, phone }, "Не удалось отправить SMS с кодом");
    res.status(502).json({ error: "Не удалось отправить SMS, попробуйте позже", code: "sms_failed" });
    return;
  }

  res.json({
    sent: true,
    expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
    resend_after_seconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
  });
});

// ── POST /api/auth/verify-code ───────────────────────────────────────────────
router.post("/auth/verify-code", async (req, res): Promise<void> => {
  const parsed = VerifyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) { badPhone(res); return; }

  const now = new Date();

  const [otp] = await db
    .select()
    .from(otpCodesTable)
    .where(and(
      eq(otpCodesTable.phone, phone),
      isNull(otpCodesTable.consumed_at),
      gte(otpCodesTable.expires_at, now),
    ))
    .orderBy(desc(otpCodesTable.created_at))
    .limit(1);

  if (!otp) {
    res.status(400).json({ error: "Код не найден или истёк, запросите новый", code: "code_expired" });
    return;
  }

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    res.status(429).json({ error: "Слишком много попыток, запросите новый код", code: "too_many_attempts" });
    return;
  }

  if (!otpCodeMatches(phone, parsed.data.code, otp.code_hash)) {
    await db
      .update(otpCodesTable)
      .set({ attempts: sql`${otpCodesTable.attempts} + 1` })
      .where(eq(otpCodesTable.id, otp.id));

    res.status(400).json({
      error: "Неверный код",
      code: "code_invalid",
      attempts_left: Math.max(0, OTP_MAX_ATTEMPTS - otp.attempts - 1),
    });
    return;
  }

  // Код верный — гасим его, чтобы повторно не сработал.
  await db
    .update(otpCodesTable)
    .set({ consumed_at: now })
    .where(eq(otpCodesTable.id, otp.id));

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));

  const user = existing
    ? (await db
        .update(usersTable)
        .set({ phone_verified_at: now })
        .where(eq(usersTable.id, existing.id))
        .returning())[0]
    : (await db
        .insert(usersTable)
        .values({
          id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          phone,
          phone_verified_at: now,
        })
        .returning())[0];

  if (!user) {
    res.status(500).json({ error: "Не удалось создать пользователя" });
    return;
  }

  const refresh = createRefreshToken();
  await db.insert(refreshTokensTable).values({
    user_id: user.id,
    token_hash: refresh.hash,
    device: parsed.data.device ?? null,
    expires_at: new Date(now.getTime() + REFRESH_TTL_MS),
  });

  res.json({
    access_token: signAccessToken(user.id),
    refresh_token: refresh.token,
    expires_in_seconds: Math.floor(ACCESS_TTL_MS / 1000),
    is_new_user: !existing,
    user,
  });
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post("/auth/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const now = new Date();
  const hash = hashRefreshToken(parsed.data.refresh_token);

  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.token_hash, hash));

  if (!stored || stored.revoked_at || stored.expires_at < now) {
    res.status(401).json({ error: "Сессия истекла, войдите заново", code: "refresh_invalid" });
    return;
  }

  // Ротация: старый токен гасим и выдаём новый. Так украденный refresh живёт
  // только до ближайшего обновления, а не все 60 дней.
  const next = createRefreshToken();

  await db.transaction(async (tx) => {
    await tx
      .update(refreshTokensTable)
      .set({ revoked_at: now })
      .where(eq(refreshTokensTable.id, stored.id));

    await tx.insert(refreshTokensTable).values({
      user_id: stored.user_id,
      token_hash: next.hash,
      device: stored.device,
      expires_at: new Date(now.getTime() + REFRESH_TTL_MS),
    });
  });

  res.json({
    access_token: signAccessToken(stored.user_id),
    refresh_token: next.token,
    expires_in_seconds: Math.floor(ACCESS_TTL_MS / 1000),
  });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res): Promise<void> => {
  const parsed = RefreshBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Отзываем молча: отвечать по-разному на существующий и несуществующий токен
  // значило бы подсказывать, какие токены живые.
  await db
    .update(refreshTokensTable)
    .set({ revoked_at: new Date() })
    .where(and(
      eq(refreshTokensTable.token_hash, hashRefreshToken(parsed.data.refresh_token)),
      isNull(refreshTokensTable.revoked_at),
    ));

  res.sendStatus(204);
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId as string));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// ── PATCH /api/auth/me ───────────────────────────────────────────────────────
// Профиль правит только сам владелец: id берётся из токена, а не из запроса.
const UpdateMeBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().max(200).optional(),
  language: z.enum(["uz", "ru", "en"]).optional(),
  // Настройки уведомлений живут на сервере: отправку решает он, и без них
  // слал бы всё подряд.
  notify_session_ended: z.boolean().optional(),
  notify_station_available: z.boolean().optional(),
  notify_discount_nearby: z.boolean().optional(),
  notify_low_battery: z.boolean().optional(),
});

router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Нечего обновлять" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, req.userId as string))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// ── DELETE /api/auth/me ──────────────────────────────────────────────────────
// Удаление аккаунта обязательно по правилам App Store для приложений с
// регистрацией. Данные пользователя обезличиваются, а не стираются целиком:
// сессии зарядок нужны операторам для сверки расчётов.
router.delete("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId as string;

  await db.transaction(async (tx) => {
    await tx
      .update(refreshTokensTable)
      .set({ revoked_at: new Date() })
      .where(and(eq(refreshTokensTable.user_id, userId), isNull(refreshTokensTable.revoked_at)));

    await tx
      .update(usersTable)
      .set({
        phone: null,
        phone_verified_at: null,
        email: null,
        name: "Удалённый пользователь",
      })
      .where(eq(usersTable.id, userId));
  });

  res.sendStatus(204);
});

export default router;
