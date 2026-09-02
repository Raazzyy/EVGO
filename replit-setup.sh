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
if ! pnpm --filter @workspace/api-server run import:osm; then
  echo "  import:osm не отработал — пробую OpenChargeMap (нужен OCM_API_KEY)"
  pnpm --filter @workspace/api-server run import:ocm || \
    echo "  импорт пропущен: проверь станции вручную (возможно, уже в базе)"
fi

echo ""
echo "Готово. Теперь запусти сервисы:  bash replit-dev.sh"
