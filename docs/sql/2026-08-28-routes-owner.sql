-- Владелец маршрута (задача 20)
--
-- До этой правки таблица routes не хранила пользователя вообще, и
-- GET /api/routes отдавал маршруты всех подряд — вместе с домашними и
-- рабочими адресами.
--
-- Штатный путь:
--     pnpm --filter @workspace/db run push
--
-- Колонка nullable, поэтому вопросов про усечение таблицы drizzle-kit
-- задать не должен. Если всё же зависнет — применить напрямую:
--     psql "$DATABASE_URL" -f docs/sql/2026-08-28-routes-owner.sql

ALTER TABLE routes ADD COLUMN IF NOT EXISTS user_id text;

-- Поиск маршрутов пользователя.
CREATE INDEX IF NOT EXISTS idx_routes_user ON routes (user_id);

-- Маршруты, созданные до появления колонки, остаются без владельца и в
-- выдачу больше не попадают. Если это демо-данные — их можно удалить:
--
--   DELETE FROM routes WHERE user_id IS NULL;
--
-- Либо назначить владельцем конкретного пользователя:
--
--   UPDATE routes SET user_id = 'user_001' WHERE user_id IS NULL;
