-- DB-01 (деньги): sessions.cost (real, сум, теряет точность на агрегатах) →
-- cost_tiyin (bigint, тийины целым). Данные сохраняются: старые суммы × 100.
-- Идемпотентно.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cost_tiyin bigint;

UPDATE sessions
   SET cost_tiyin = round(cost * 100)
 WHERE cost IS NOT NULL
   AND cost_tiyin IS NULL;

ALTER TABLE sessions DROP COLUMN IF EXISTS cost;
