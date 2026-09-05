-- DB-01 (координаты): lat/lng с real (Float32, дрейф ~1–4 м) → double precision.
-- Безопасно: расширение точности, данные не искажаются. Идемпотентно.
ALTER TABLE stations
  ALTER COLUMN lat TYPE double precision,
  ALTER COLUMN lng TYPE double precision;
