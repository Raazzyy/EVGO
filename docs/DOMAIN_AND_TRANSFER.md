# Перенос Replit на аккаунт Акмаль-аки + настройка домена evgo.uz

Действия в дашбордах (Replit / Vercel / регистратор домена) делает человек —
здесь пошаговый план. Код под домен уже обновлён (лендинг → evgo.uz).

---

## Часть 1. Перенос проекта на Replit Акмаль-аки

Код — единый источник правды в GitHub (`github.com/Raazzyy/EVGO`), поэтому проще
всего **импортировать репозиторий в аккаунт Акмаль-аки**, а не «перетаскивать» Repl.

**Шаги (делает Акмаль-ака или под его аккаунтом):**
1. Зайти в Replit под аккаунтом **Акмаль-аки**.
2. **Create Repl → Import from GitHub →** вставить `https://github.com/Raazzyy/EVGO`.
   (Если репозиторий приватный — сначала подключить GitHub-аккаунт с доступом.)
3. Дальше — по `docs/REPLIT_HANDOVER.md`:
   - `pnpm install`
   - Подключить Postgres (Tools → Database) → появится `DATABASE_URL`
   - Добавить Secrets (полный список — в `REPLIT_HANDOVER.md`)
   - `pnpm --filter @workspace/db run push`
   - Прогнать миграции `docs/sql/*.sql` (в т.ч. `pg-trgm`, `vehicles-dedup`,
     `payment-idempotency`)
   - Импорт станций
4. Проверить Run/Artifacts — поднимутся API, админка, лендинг, мобилка.

> **Про Secrets:** секреты в Replit НЕ переносятся с репозиторием (их нет в git).
> Их нужно завести заново на аккаунте Акмаль-аки (значения — из вашего блока
> ключей). Демо-код/пароль тоже задать заново.

**Альтернатива — нативный transfer:** в старом Repl (у Саидакбара) есть
Settings → Transfer/Move, но это требует, чтобы оба были в одной Team/плане и
переносит именно Repl вместе с его БД. Импорт из GitHub — чище и не зависит от
плана: код один, окружение поднимается заново.

---

## Часть 2. Домен evgo.uz

### Что где будет жить (рекомендуемая схема поддоменов)
| Поддомен | Что | Где хостится |
|---|---|---|
| `evgo.uz` (apex) + `www.evgo.uz` | Лендинг | Vercel |
| `api.evgo.uz` | API-сервер | Replit Deployment |
| `admin.evgo.uz` | Админка | Replit Deployment (или Vercel) |
| мобилка | Expo/сторы | использует `api.evgo.uz` |

### Шаг 1 — Лендинг на evgo.uz (Vercel)
1. Vercel → проект `evgo-landing` → **Settings → Domains → Add** → `evgo.uz`
   (и `www.evgo.uz`).
2. Vercel покажет DNS-записи. Добавить их **у регистратора, где куплен evgo.uz**:
   - apex `evgo.uz` → **A** → `76.76.21.21`
   - `www` → **CNAME** → `cname.vercel-dns.com`
3. Vercel сам выпустит SSL (Let's Encrypt) за пару минут. Код лендинга уже
   ссылается на `https://evgo.uz` (canonical, OG, sitemap, robots).

### Шаг 2 — API на api.evgo.uz (Replit)
1. На Replit задеплоить API (Deployment). Получить его домен вида
   `xxx.replit.app`.
2. В настройках Deployment → **Custom domain** → `api.evgo.uz`. Replit покажет
   запись — добавить у регистратора:
   - `api` → **CNAME** → `<домен деплоя>.replit.app`
3. В Secrets мобилки для прод-сборки задать `EXPO_PUBLIC_DOMAIN=api.evgo.uz`
   (тогда приложение ходит на боевой https, без LAN/firewall).

### Шаг 3 — Админка на admin.evgo.uz
Аналогично: деплой админки → custom domain `admin.evgo.uz` → CNAME у регистратора.
Прокси `/api` в проде админка не использует — она ходит на тот же origin, где её
отдаёт сервер; при отдельном поддомене настроить базовый URL API = `api.evgo.uz`.

### Итоговые DNS-записи (у регистратора evgo.uz)
```
evgo.uz.        A      76.76.21.21            ; лендинг (Vercel)
www.evgo.uz.    CNAME  cname.vercel-dns.com.  ; лендинг www
api.evgo.uz.    CNAME  <deploy>.replit.app.   ; API
admin.evgo.uz.  CNAME  <deploy>.replit.app.   ; админка
```
> Точные значения A/CNAME берите из дашбордов Vercel/Replit — они могут отличаться
> (Vercel иногда даёт другой A-IP или требует ALIAS/ANAME на apex, если регистратор
> поддерживает).

---

## Что уже сделано в коде (этот заход)
- Лендинг переведён с `evgo-landing.vercel.app` на **`https://evgo.uz`**:
  canonical, og:url, og:image, twitter:image, JSON-LD, `sitemap.xml`, `robots.txt`.
- Сборка лендинга проверена — в `dist` только evgo.uz, vercel.app не осталось.

## Осталось (в дашбордах)
1. Импортировать репо в Replit Акмаль-аки + завести Secrets + БД (Часть 1).
2. Добавить домены в Vercel/Replit и DNS-записи у регистратора (Часть 2).
3. Прод-сборка мобилки с `EXPO_PUBLIC_DOMAIN=api.evgo.uz`.
