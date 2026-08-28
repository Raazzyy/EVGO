-- Схема под вход по номеру телефона (задачи 11, 12, 14 из docs/tasks.md)
--
-- Сначала попробуйте штатный путь:
--     pnpm --filter @workspace/db run push
--
-- Если drizzle-kit уйдёт в интерактивный вопрос про уникальный индекс и
-- зависнет без TTY (известная особенность, см. .agents/memory), примените
-- этот файл напрямую:
--     psql "$DATABASE_URL" -f docs/sql/2026-08-28-auth.sql
--
-- Скрипт идемпотентный: повторный запуск ничего не сломает.

BEGIN;

-- ── users ───────────────────────────────────────────────────────────────────
-- Вход теперь по телефону, email перестал быть обязательным.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

DO $$
BEGIN
  CREATE TYPE user_language AS ENUM ('uz', 'ru', 'en');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS language user_language NOT NULL DEFAULT 'ru';

-- Уникальность телефона: пустые значения не мешают, NULL в Postgres
-- уникальному индексу не конфликтует сам с собой.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone);

-- ── otp_codes ───────────────────────────────────────────────────────────────
-- Коды подтверждения. Хранится HMAC, не сам код.
CREATE TABLE IF NOT EXISTS otp_codes (
  id          serial PRIMARY KEY,
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Поиск последнего кода по номеру и подсчёт запросов за окно.
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created
  ON otp_codes (phone, created_at);

-- ── refresh_tokens ──────────────────────────────────────────────────────────
-- Хранится SHA-256 токена, не сам токен.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  device     text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens (user_id);

COMMIT;

-- ── Обслуживание ────────────────────────────────────────────────────────────
-- Протухшие коды и отозванные токены накапливаются. Раз в сутки:
--
--   DELETE FROM otp_codes      WHERE created_at < now() - interval '7 days';
--   DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days';
