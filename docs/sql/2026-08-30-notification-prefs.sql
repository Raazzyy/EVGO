-- Настройки уведомлений (задача 59)
--
-- Раньше переключатели в приложении сохранялись только на устройстве, а
-- отправку push решает сервер — то есть он слал бы всё подряд независимо от
-- того, что человек отключил. Человек, которого залило уведомлениями,
-- отключает их целиком на уровне системы, и достучаться до него больше нечем.
--
-- Штатный путь:
--     pnpm --filter @workspace/db run push
--
-- Все колонки со значением по умолчанию, вопросов про усечение быть не должно.
-- Если drizzle-kit всё же зависнет — применить напрямую:
--     psql "$DATABASE_URL" -f docs/sql/2026-08-30-notification-prefs.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_session_ended boolean NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_station_available boolean NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_discount_nearby boolean NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_low_battery boolean NOT NULL DEFAULT true;

-- По умолчанию включено всё: человек, который поставил приложение ради
-- зарядок, ожидает узнать, что зарядка закончилась. Отключить можно в
-- настройках — «Настройки» → «Уведомления».
