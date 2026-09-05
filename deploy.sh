#!/usr/bin/env bash
# ============================================================================
# EVGO — помощник для Replit. Запускать из корня workspace: bash deploy.sh <cmd>
#
#   bash deploy.sh sync      # подтянуть код из GitHub (ff-only) + install + чистка кэша
#   bash deploy.sh build     # ПОЛНАЯ сборка: схема БД · лендинг · админка · API · мобилка
#   bash deploy.sh migrate   # прогнать SQL-миграции (docs/sql/*.sql)
#   bash deploy.sh seed       # импорт станций из OpenStreetMap
#   bash deploy.sh check      # версии Expo(SDK) · станции в БД · healthz локально и на деплое
#   bash deploy.sh dns        # что вставлять в DNS Eskiz для домена evgo.uz
#   bash deploy.sh all        # sync + build (обычный цикл выкатки)
#   bash deploy.sh help
#
# После build/all нажми REPUBLISH в Replit — только это выкатывает живую версию.
# STOP/RUN перезапускает лишь воркспейс (Expo Go/отладку), не боевой деплой.
# Секреты (ключи) живут в Tools → Secrets, НЕ в git.
# ============================================================================
set -uo pipefail

DEPLOY_DOMAIN="evgo-akmholdings700.replit.app"
SITE_DOMAIN="evgo.uz"

c()   { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

# ── sync: подтянуть последний код ──────────────────────────────────────────
cmd_sync() {
  c "Подтягиваю код из GitHub (origin/main, fast-forward only)"
  git fetch origin main || die "git fetch не удался"
  if ! git merge --ff-only origin/main; then
    warn "Локальная ветка разошлась с origin/main — ff невозможен."
    echo "   Что есть только здесь:  git log --oneline origin/main..HEAD"
    echo "   Выровняться по GitHub (сохранив бэкап):"
    echo "     git branch backup-\$(date +%Y%m%d-%H%M%S) && git reset --hard origin/main"
    die "Синхронизация остановлена — код НЕ обновлён."
  fi
  ok "Код: $(git rev-parse --short HEAD)"

  c "Чищу кэш Metro (иначе не применятся babel/SDK-правки)"
  rm -rf /tmp/metro-* /tmp/haste-* artifacts/mobile/.expo node_modules/.cache 2>/dev/null
  ok "Кэш очищен"

  c "pnpm install"
  pnpm install || die "pnpm install завершился с ошибкой"
  ok "Зависимости установлены"
}

# ── build: полная сборка всех артефактов ───────────────────────────────────
cmd_build() {
  c "Схема БД (drizzle push)"
  # На Replit ДВЕ базы: development (шелл) и production (деплой). Схему гоним в
  # PROD_DATABASE_URL, если задан, иначе в DATABASE_URL шелла (с предупреждением).
  local schema_db="${PROD_DATABASE_URL:-${DATABASE_URL:-}}"
  [ -z "$schema_db" ] && die "Ни PROD_DATABASE_URL, ни DATABASE_URL не заданы — схему применять некуда."
  echo "    Цель: $(printf '%s' "$schema_db" | sed -E 's#^[^:]+://[^@]*@##; s#\?.*$##')"
  [ -z "${PROD_DATABASE_URL:-}" ] && warn "PROD_DATABASE_URL не задан — схема уедет в DEV-базу шелла (боевой сервер её не увидит)."
  DATABASE_URL="$schema_db" pnpm --filter @workspace/db run push || warn "db push вернул ошибку (возможно, схема уже актуальна)"

  c "Лендинг"
  PORT=5000 BASE_PATH="/" pnpm --filter @workspace/landing run build || die "сборка лендинга упала"
  c "Админка"
  PORT=3000 BASE_PATH="/admin/" pnpm --filter @workspace/admin run build || die "сборка админки упала"
  c "API-сервер"
  pnpm --filter @workspace/api-server run build || die "сборка API упала"

  c "Версия сборки → build-info.json"
  cat > artifacts/api-server/build-info.json <<JSON
{
  "sha": "$(git rev-parse HEAD)",
  "branch": "$(git rev-parse --abbrev-ref HEAD)",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
  ok "$(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"

  # Мобилку — ПОСЛЕДНЕЙ: Metro ~1 мин, и её падение не должно терять уже
  # собранные сервер/сайт. build.js хардкодит порт 8081 — освобождаем его,
  # иначе забытый dev-Metro уронит сборку.
  c "Мобильное приложение (Metro, iOS+Android, ~1 мин)"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then pids="$(lsof -ti tcp:8081 2>/dev/null || true)"
  elif command -v fuser >/dev/null 2>&1; then pids="$(fuser 8081/tcp 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true)"; fi
  if [ -n "$pids" ]; then
    echo "    Порт 8081 занят (PID: $(echo "$pids" | tr '\n' ' ')) — освобождаю."
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true; sleep 2; kill -9 $pids 2>/dev/null || true; sleep 1
  fi
  pnpm --filter @workspace/mobile run build || die "сборка мобилки упала (сервер/сайт уже собраны)"

  echo
  echo "========================================================="
  ok "Собрано из коммита $(git rev-parse --short HEAD): БД · лендинг · админка · API · мобилка"
  warn "Нажми REPUBLISH в Replit — только это выкатит сборку на деплой."
  echo "   Проверка после Republish:"
  echo "     curl -s -o /dev/null -w \"%{http_code}\\n\" https://$DEPLOY_DOMAIN/api/healthz"
  echo "========================================================="
}

cmd_migrate() {
  c "SQL-миграции (docs/sql/*.sql)"
  [ -z "${DATABASE_URL:-}" ] && die "DATABASE_URL не задан (Tools → Database)"
  local any=0
  for f in docs/sql/*.sql; do
    [ -e "$f" ] || break; any=1
    echo "→ $f"
    psql "$DATABASE_URL" -f "$f" || warn "миграция $f вернула ошибку (возможно, уже применена)"
  done
  [ "$any" = 0 ] && warn "миграций в docs/sql не найдено" || ok "Миграции прогнаны"
}

cmd_seed() {
  c "Импорт станций из OpenStreetMap"
  ( cd artifacts/api-server && pnpm dlx tsx src/scripts/import-osm.ts ) \
    && ok "Импорт завершён" || warn "Импорт вернул ошибку"
}

cmd_check() {
  c "Версии Expo/SDK (мобилка)"
  ( cd artifacts/mobile && pnpm exec expo install --check ) || true
  c "Станции в БД"
  if [ -n "${DATABASE_URL:-}" ]; then
    psql "$DATABASE_URL" -tc "select count(*) as stations from stations;" 2>/dev/null || warn "запрос к БД не прошёл"
  else warn "DATABASE_URL не задан"; fi
  c "API healthz"
  curl -s -o /dev/null -w "  local  http://localhost:8080/api/healthz -> HTTP %{http_code}\n" http://localhost:8080/api/healthz 2>/dev/null || warn "локальный API молчит (запусти Run)"
  curl -s -o /dev/null -w "  deploy https://$DEPLOY_DOMAIN/api/healthz -> HTTP %{http_code}\n" "https://$DEPLOY_DOMAIN/api/healthz" 2>/dev/null || true
  curl -s -o /dev/null -w "  mobile https://$DEPLOY_DOMAIN/mobile/     -> HTTP %{http_code}\n" "https://$DEPLOY_DOMAIN/mobile/" 2>/dev/null || true
}

cmd_dns() {
  c "Домен $SITE_DOMAIN — DNS держит Eskiz (ns1..ns4.eskiz.uz)"
  cat <<EOF
Добавь записи в кабинете Eskiz → DNS-зона $SITE_DOMAIN:

  Тип    Имя      Значение
  ----   ------   ------------------------------------
  A      @        76.76.21.21               (лендинг Vercel — или IP, что покажет Vercel)
  CNAME  www      cname.vercel-dns.com
  CNAME  api      $DEPLOY_DOMAIN            (API)
  CNAME  admin    $DEPLOY_DOMAIN            (админка)

Затем:
  • Vercel → проект лендинга → Settings → Domains → добавь $SITE_DOMAIN и www.$SITE_DOMAIN
  • Replit → Deploy → Custom domain → добавь api.$SITE_DOMAIN и admin.$SITE_DOMAIN
  • Мобилка на боевой API: Secrets → EXPO_PUBLIC_DOMAIN=api.$SITE_DOMAIN → пересобрать
SSL выпустится сам за 10–30 мин. Проверка: https://$SITE_DOMAIN
EOF
}

cmd_all()  { cmd_sync && cmd_build; }
cmd_help() { sed -n '2,22p' "$0"; }

case "${1:-help}" in
  sync)    cmd_sync ;;
  build)   cmd_build ;;
  migrate) cmd_migrate ;;
  seed)    cmd_seed ;;
  check)   cmd_check ;;
  dns)     cmd_dns ;;
  all)     cmd_all ;;
  help|-h|--help) cmd_help ;;
  *) warn "неизвестная команда: $1"; cmd_help; exit 1 ;;
esac
