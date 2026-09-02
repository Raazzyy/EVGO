#!/usr/bin/env bash
# Запуск всех сервисов EVGO для ревью: API + админка + лендинг.
# Каждый на своём порту; Ctrl+C останавливает все сразу.
# Запуск:  bash replit-dev.sh
set -uo pipefail

# Освобождаем порт API (8080): бьём старый процесс всеми доступными способами.
free_port() {
  local p="$1"
  pkill -f "dist/index.mjs" 2>/dev/null || true
  command -v fuser >/dev/null 2>&1 && fuser -k "${p}/tcp" 2>/dev/null || true
  command -v lsof  >/dev/null 2>&1 && kill $(lsof -t -i:"${p}" 2>/dev/null) 2>/dev/null || true
}

echo "==> Освобождаю порт 8080 (гашу старый API)"
free_port 8080
sleep 2

# Когда скрипт завершается (Ctrl+C) — гасим все дочерние процессы.
trap 'echo; echo "Останавливаю сервисы..."; kill 0' EXIT

echo "==> API      → :8080"
PORT=8080 pnpm --filter @workspace/api-server run dev &

echo "==> Админка  → :5001"
BASE_PATH=/ PORT=5001 pnpm --filter @workspace/admin run dev &

echo "==> Лендинг  → :5002"
BASE_PATH=/ PORT=5002 pnpm --filter @workspace/landing run dev &

echo ""
echo "Сервисы поднимаются. Открой веб-превью Replit:"
echo "  API      :8080  (проверка: /api/stations)"
echo "  Админка  :5001  (вход под ADMIN_EMAIL / ADMIN_PASSWORD из Secrets)"
echo "  Лендинг  :5002"
echo "Ctrl+C — остановить все."

wait
