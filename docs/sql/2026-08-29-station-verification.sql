-- Отметка о проверке станции (задача 96)
--
-- Основной источник данных — OpenChargeMap, открытая база, которую наполняют
-- энтузиасты: часть записей устарела, цены почти везде отсутствуют или неверны.
-- Пользователь должен видеть, когда станцию проверяли живьём, иначе обещание
-- «все зарядки Узбекистана» ничем не подкреплено.
--
-- Штатный путь:
--     pnpm --filter @workspace/db run push
--
-- Обе колонки nullable, вопросов про усечение таблицы быть не должно.
-- Если drizzle-kit всё же зависнет — применить напрямую:
--     psql "$DATABASE_URL" -f docs/sql/2026-08-29-station-verification.sql

ALTER TABLE stations ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS verified_by text;

-- Выборка непроверенных и давно не проверявшихся станций для админки.
CREATE INDEX IF NOT EXISTS idx_stations_verified_at ON stations (verified_at);

-- Полезный запрос: что проверить в первую очередь — станции, которые
-- показываются пользователям, но никогда не проверялись.
--
--   SELECT id, name, address, source
--   FROM stations
--   WHERE verified_at IS NULL
--   ORDER BY id;
