-- Кошелёк, журнал, холды и транзакции провайдеров.
-- Все суммы — целые тийины (1 сум = 100 тийин).
-- Применять при зависании drizzle-kit push:
--   psql "$DATABASE_URL" -f docs/sql/2026-08-31-wallet.sql

BEGIN;

-- ── Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE wallet_txn_type AS ENUM ('topup', 'charge', 'refund', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wallet_hold_status AS ENUM ('active', 'captured', 'released');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_provider AS ENUM ('payme', 'click');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_txn_state AS ENUM ('created', 'performed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Кошелёк ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  user_id       text PRIMARY KEY,
  balance_tiyin bigint NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Журнал операций ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                  serial PRIMARY KEY,
  user_id             text NOT NULL,
  type                wallet_txn_type NOT NULL,
  amount_tiyin        bigint NOT NULL,
  balance_after_tiyin bigint NOT NULL,
  session_id          integer,
  payment_txn_id      integer,
  comment             text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_user ON wallet_transactions (user_id, created_at DESC);
-- Идемпотентность зачислений: одно пополнение на платёжную транзакцию.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_txn_topup_payment
  ON wallet_transactions (payment_txn_id) WHERE type = 'topup' AND payment_txn_id IS NOT NULL;
-- Идемпотентность разворота: одна отмена на платёжную транзакцию.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_txn_refund_payment
  ON wallet_transactions (payment_txn_id) WHERE type = 'refund' AND payment_txn_id IS NOT NULL;

-- ── Холды ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_holds (
  id           serial PRIMARY KEY,
  user_id      text NOT NULL,
  amount_tiyin bigint NOT NULL,
  session_id   integer,
  status       wallet_hold_status NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_wallet_holds_active
  ON wallet_holds (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wallet_holds_expiry
  ON wallet_holds (expires_at) WHERE status = 'active';

-- ── Транзакции провайдеров ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_transactions (
  id              serial PRIMARY KEY,
  provider        payment_provider NOT NULL,
  provider_txn_id text,
  user_id         text NOT NULL,
  amount_tiyin    bigint NOT NULL,
  state           payment_txn_state NOT NULL DEFAULT 'created',
  provider_state  integer NOT NULL DEFAULT 1,
  cancel_reason   integer,
  create_time     bigint,
  perform_time    bigint,
  cancel_time     bigint,
  wallet_txn_id   integer,
  raw_payload     json,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- Один и тот же id транзакции провайдера — одна наша строка (идемпотентность вебхука).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_provider_txn
  ON payment_transactions (provider, provider_txn_id) WHERE provider_txn_id IS NOT NULL;

COMMIT;
