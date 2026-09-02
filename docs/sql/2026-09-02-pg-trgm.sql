-- Триграммное расширение для нечёткого поиска авто (vehicles/search).
--
-- Функция similarity() из pg_trgm используется в searchFuzzy(). Без расширения
-- запрос падал, и поиск по кириллице (напр. "тесла") возвращал 500 «Search
-- failed». Включаем расширение — поиск начинает работать нечётко.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Индекс ускоряет similarity() по имени модели (иначе полный скан каталога).
CREATE INDEX IF NOT EXISTS idx_vehicles_name_trgm
  ON vehicles USING gin (lower(name) gin_trgm_ops);
