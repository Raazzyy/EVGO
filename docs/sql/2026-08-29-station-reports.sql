-- Жалобы на неточности в данных станций (задача 96)
--
-- Объехать все станции страны нереально, а пользователь стоит перед станцией
-- прямо сейчас и видит, что не так. Это самый дешёвый способ поддерживать
-- базу в актуальном состоянии.
--
-- Штатный путь:
--     pnpm --filter @workspace/db run push
--
-- Либо напрямую:
--     psql "$DATABASE_URL" -f docs/sql/2026-08-29-station-reports.sql

BEGIN;

DO $$
BEGIN
  CREATE TYPE station_report_reason AS ENUM (
    'not_working',
    'wrong_price',
    'wrong_location',
    'wrong_connectors',
    'permanently_closed',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE station_report_status AS ENUM ('new', 'confirmed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS station_reports (
  id          serial PRIMARY KEY,
  station_id  integer NOT NULL,
  user_id     text NOT NULL,
  reason      station_report_reason NOT NULL,
  comment     text,
  status      station_report_status NOT NULL DEFAULT 'new',
  resolved_by text,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Очередь необработанных жалоб в админке.
CREATE INDEX IF NOT EXISTS idx_station_reports_status
  ON station_reports (status, created_at);

-- История жалоб по конкретной станции.
CREATE INDEX IF NOT EXISTS idx_station_reports_station
  ON station_reports (station_id);

COMMIT;

-- Полезный запрос: станции, на которые жалуются чаще всего —
-- их стоит проверить в первую очередь.
--
--   SELECT s.id, s.name, s.address, count(*) AS reports
--   FROM station_reports r
--   JOIN stations s ON s.id = r.station_id
--   WHERE r.status = 'new'
--   GROUP BY s.id, s.name, s.address
--   ORDER BY reports DESC;
