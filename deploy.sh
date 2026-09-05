#!/usr/bin/env bash
# ============================================================================
# EVGO — помощник для Replit. Запускать из корня workspace: bash deploy.sh <cmd>
#
#   bash deploy.sh sync      # подтянуть последний код из GitHub + install + чистка кэша
#   bash deploy.sh migrate   # прогнать SQL-миграции (docs/sql/*.sql)
#   bash deploy.sh seed       # импорт станций из OpenStreetMap
#   bash deploy.sh check      # проверки: версии Expo (SDK), станции в БД, healthz
#   bash deploy.sh dns        # что вставлять в DNS Eskiz для домена evgo.uz
#   bash deploy.sh all        # sync + migrate + seed (полный прогон окружения)
#   bash deploy.sh help
#
# После `sync`/`all` нажми Republish в Replit, чтобы выложить живую версию.
# Секреты (ключи) живут в Tools → Secrets, НЕ в git.
# ============================================================================
set -uo pipefail

REPO_PATHS="pnpm-workspace.yaml pnpm-lock.yaml artifacts/mobile"
DEPLOY_DOMAIN="evgo-akmholdings700.replit.app"
SITE_DOMAIN="evgo.uz"

c()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }

cmd_sync() {
  c "Подтягиваю последний код из GitHub (origin/main)"
  git fetch origin || { warn "git fetch не удался"; return 1; }
  git checkout origin/main -- $REPO_PATHS || { warn "checkout не удался"; return 1; }
  ok "Код синхронизирован ($(git rev-parse --short origin/main))"

  c "Чищу кэш Metro (чтобы применились babel/SDK-правки)"
  rm -rf /tmp/metro-* /tmp/haste-* artifacts/mobile/.expo node_modules/.cache 2>/dev/null
  ok "Кэш очищен"

  c "pnpm install"
  pnpm install || { warn "pnpm install завершился с ошибкой — смотри вывод выше"; return 1; }
  ok "Зависимости установлены"
  warn "Теперь нажми Republish в Replit, чтобы выложить живую версию."
}

cmd_migrate() {
  c "SQL-миграции"
  if [ -z "${DATABASE_URL:-}" ]; then warn "DATABASE_URL не задан (Tools → Database)"; return 1; fi
  for f in docs/sql/*.sql; do
    [ -e "$f" ] || { warn "миграций в docs/sql не найдено"; break; }
    echo "→ $f"
    psql "$DATABASE_URL" -f "$f" || warn "миграция $f вернула ошибку (возможно, уже применена)"
  done
  ok "Миграции прогнаны"
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
  c "API healthz (локально)"
  curl -s -o /dev/null -w "  http://localhost:8080/api/healthz -> HTTP %{http_code}\n" http://localhost:8080/api/healthz 2>/dev/null || warn "API не отвечает (запусти Run)"
  c "Живой деплой"
  curl -s -o /dev/null -w "  https://$DEPLOY_DOMAIN/api/healthz -> HTTP %{http_code}\n" "https://$DEPLOY_DOMAIN/api/healthz" 2>/dev/null || true
  curl -s -o /dev/null -w "  https://$DEPLOY_DOMAIN/mobile/     -> HTTP %{http_code}\n" "https://$DEPLOY_DOMAIN/mobile/" 2>/dev/null || true
}

cmd_dns() {
  c "Домен $SITE_DOMAIN — DNS держит Eskiz (ns1..ns4.eskiz.uz)"
  cat <<EOF
Добавь записи в кабинете Eskiz → DNS-зона $SITE_DOMAIN:

  Тип    Имя      Значение
  ----   ------   ------------------------------------
  A      @        76.76.21.21               (лендинг, Vercel — или IP, что покажет Vercel)
  CNAME  www      cname.vercel-dns.com      (лендинг www)
  CNAME  api      $DEPLOY_DOMAIN            (API)
  CNAME  admin    $DEPLOY_DOMAIN            (админка)

Затем:
  • Vercel → проект лендинга → Settings → Domains → добавь $SITE_DOMAIN и www.$SITE_DOMAIN
  • Replit → Deploy → Custom domain → добавь api.$SITE_DOMAIN и admin.$SITE_DOMAIN
  • Мобилка на боевой API: Secrets → EXPO_PUBLIC_DOMAIN=api.$SITE_DOMAIN → пересобрать
SSL выпустится сам за 10–30 мин. Проверка: https://$SITE_DOMAIN
EOF
}

cmd_all() { cmd_sync && cmd_migrate && cmd_seed; }

cmd_help() { sed -n '2,20p' "$0"; }

case "${1:-help}" in
  sync)    cmd_sync ;;
  migrate) cmd_migrate ;;
  seed)    cmd_seed ;;
  check)   cmd_check ;;
  dns)     cmd_dns ;;
  all)     cmd_all ;;
  help|-h|--help) cmd_help ;;
  *) warn "неизвестная команда: $1"; cmd_help; exit 1 ;;
esac
