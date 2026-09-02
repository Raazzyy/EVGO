#!/usr/bin/env bash
# Разовая настройка EVGO на Replit: обновить код, зависимости, схему БД, станции.
# Запуск:  bash replit-setup.sh
set -uo pipefail

echo "==> 1/4  Подтягиваю последний код (main)"
git pull origin main || echo "  git pull пропущен (нет сети/уже актуально)"

echo "==> 2/4  Устанавливаю зависимости"
pnpm install

echo "==> 3/4  Применяю схему БД (таблицы + индексы идемпотентности)"
pnpm --filter @workspace/db run push

echo "==> 4/4  Импортирую станции по Узбекистану"
# tsx может быть не установлен как бинарь — запускаем через npx (подтянет сам).
if ! ( cd artifacts/api-server && npx --yes tsx src/scripts/import-osm.ts ); then
  echo "  импорт не отработал — вероятно станции уже в базе. Проверь:"
  echo "  curl -s localhost:8080/api/stations | head -c 200"
fi

echo ""
echo "Готово. Теперь запусти сервисы:  bash replit-dev.sh"
