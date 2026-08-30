-- Подписки веб-версии на push (Web Push API + VAPID).
--   psql "$DATABASE_URL" -f docs/sql/2026-08-31-web-push.sql

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_push_user ON web_push_subscriptions (user_id);
