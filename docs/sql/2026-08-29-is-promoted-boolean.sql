-- stations.is_promoted: integer 0/1 → boolean (задача 60)
--
-- Зачем: в базе поле хранилось числом, а в OpenAPI и админке значилось
-- boolean. Из-за расхождения в React Native запись вида
--   {is_promoted && <Badge/>}
-- при значении 0 выводила на экран текст «0» и роняла экран с ошибкой
-- «Text strings must be rendered within a <Text> component».
--
-- Обходились правилом «всегда писать !!is_promoted», но помнить о нём
-- вечно ненадёжно — правим тип.
--
-- ВНИМАНИЕ: drizzle-kit push на смене типа колонки может предложить
-- удалить и создать её заново, потеряв значения. Применяйте этот файл
-- ДО push — тогда push увидит совпадающую схему и ничего не тронет:
--     psql "$DATABASE_URL" -f docs/sql/2026-08-29-is-promoted-boolean.sql
--
-- Скрипт идемпотентный: на уже переведённой базе ничего не делает.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations'
      AND column_name = 'is_promoted'
      AND data_type <> 'boolean'
  ) THEN
    -- Значение по умолчанию снимается перед сменой типа: иначе Postgres
    -- не сможет привести старый default (0) к новому типу.
    ALTER TABLE stations ALTER COLUMN is_promoted DROP DEFAULT;

    ALTER TABLE stations
      ALTER COLUMN is_promoted TYPE boolean
      USING (is_promoted <> 0);

    ALTER TABLE stations
      ALTER COLUMN is_promoted SET DEFAULT false;

    ALTER TABLE stations
      ALTER COLUMN is_promoted SET NOT NULL;

    RAISE NOTICE 'stations.is_promoted переведён в boolean';
  ELSE
    RAISE NOTICE 'stations.is_promoted уже boolean, пропускаем';
  END IF;
END
$$;
