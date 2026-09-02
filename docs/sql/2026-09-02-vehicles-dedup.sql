-- Чистка дублей каталога электромобилей.
--
-- Каталог (vehicles с user_id IS NULL) содержал повторяющиеся модели с
-- одинаковым name (напр. «Audi A6 e-tron 2024 Base» — по несколько раз),
-- из-за чего в выборе авто появлялись дубли. Удаляем лишние, оставляя запись
-- с минимальным id, и ставим уникальный индекс, чтобы дубли не появлялись впредь.
--
-- Пользовательские авто (user_id IS NOT NULL) не трогаем.

DELETE FROM vehicles a
USING vehicles b
WHERE a.user_id IS NULL
  AND b.user_id IS NULL
  AND a.name = b.name
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_catalog_name
  ON vehicles (name)
  WHERE user_id IS NULL;
