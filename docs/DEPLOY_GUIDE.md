# EVGO — единый гайд: перенос на Replit, домен evgo.uz, тест на iPhone

Всё в одном месте. Действия в дашбордах (Replit / Vercel / Eskiz-DNS) делает
человек — здесь пошагово. Код под домен уже обновлён (лендинг → evgo.uz).

---

## 0. Факты о домене (проверено через whois)
- Домен **EVGO.UZ**, регистратор «ЧП Best Internet Solution», статус ACTIVE
  (создан 02.09.2026, действует до 02.09.2027).
- **DNS держат серверы Eskiz:** `ns1.eskiz.uz`, `ns2.eskiz.uz`, `ns3.eskiz.uz`,
  `ns4.eskiz.uz`.
- → Значит **все DNS-записи добавляются в кабинете Eskiz** (раздел DNS-зоны домена
  evgo.uz). Зона пока пустая, поэтому сайт не открывается — надо добавить записи.

---

## ЧАСТЬ A. Перенести проект на Replit аккаунта Акмаль-аки

Код — в GitHub (`github.com/Raazzyy/EVGO`). Проще всего импортировать репозиторий,
а не «перетаскивать» Repl.

1. Зайти в Replit под аккаунтом **Акмаль-аки**.
2. **Create Repl → Import from GitHub →** `https://github.com/Raazzyy/EVGO` → Import.
3. **Tools → Database → Create a database (PostgreSQL)** — `DATABASE_URL` появится сам.
4. **Tools → Secrets → Edit as .env** → вставить блок (см. раздел «Secrets» ниже).
5. Открыть **Shell** и по одной:
   ```bash
   pnpm install
   pnpm --filter @workspace/db run push
   ```
6. Прогнать миграции:
   ```bash
   psql "$DATABASE_URL" -f docs/sql/2026-09-01-payment-idempotency.sql
   psql "$DATABASE_URL" -f docs/sql/2026-09-02-vehicles-dedup.sql
   psql "$DATABASE_URL" -f docs/sql/2026-09-02-pg-trgm.sql
   ```
7. Залить станции:
   ```bash
   cd artifacts/api-server && pnpm dlx tsx src/scripts/import-osm.ts; cd ~/workspace
   ```
8. Запустить: кнопка **Run** (поднимет всё через Artifacts). Для быстрого теста —
   `bash replit-dev.sh`.
9. Проверка: превью админки → вход `admin@admin.uz` / `Admin123*` → дашборд со станциями.

> ⚠️ Secrets в git НЕ хранятся — их нужно завести заново на аккаунте Акмаль-аки.

### Secrets (вставить в Tools → Secrets)
```env
PORT=8080
AUTH_JWT_SECRET=69ebc9e7d057adb653cb84b84e059752e1506a0de971f346ed3a204d1e356684
ADMIN_JWT_SECRET=e59d66aa1bfadeb423826fe4697653bbb917d60aa550140b9afb203d31295ab6
CREDENTIALS_ENCRYPTION_KEY=y18vk0iLTIUEw1tZf5PuCwt3iEqGFmRpGOFMGhnHyas=
VAPID_PUBLIC_KEY=BG8vmuVsZi-j8v3nfE-Wx8gmw8fiZchRWJSlTb1O-uMXTmo-K61vIZrY1LCbsM8FZDQfmmLf28LBEzeKcZvUq1Y
VAPID_PRIVATE_KEY=p7C5sUBidYTDsyagnfBEWDMk0oBrdvt7eN0Hx2cRUOM
VAPID_SUBJECT=mailto:support@evgo.uz
ADMIN_EMAIL=admin@admin.uz
ADMIN_PASSWORD=Admin123*
YANDEX_JS_API_KEY=2998879a-7c50-4f45-9e4b-ea7597fb4dec
YANDEX_GEOCODER_KEY=5b7a359f-2efa-49b3-9ad5-2da54f07be34
YANDEX_ROUTER_KEY=74aea687-24f3-41c0-9a62-ce28cb97f05d
GOOGLE_MAPS_ANDROID_KEY=AIzaSyBakox_OTL72nlfrr7gYHO6DiOQwKjPUpQ
GOOGLE_MAPS_IOS_KEY=AIzaSyBakox_OTL72nlfrr7gYHO6DiOQwKjPUpQ
GOOGLE_DIRECTIONS_KEY=AIzaSyBakox_OTL72nlfrr7gYHO6DiOQwKjPUpQ
EV_API_KEY=OnwLaMe9SaxvEwdnFYUXotNvsPDizcWANeeei01H
DEMO_PHONE=998901234567
DEMO_CODE=246810
PAYME_TEST_MODE=true
```
(`DATABASE_URL` не трогать — он от Postgres на шаге 3.)

---

## ЧАСТЬ B. Домен evgo.uz (DNS у Eskiz)

### B1. Лендинг → Vercel
1. **vercel.com** → проект **`evgo-landing`** → **Settings → Domains**.
2. Add `evgo.uz`, затем `www.evgo.uz`. Vercel покажет нужные записи.

### B2. DNS-записи — в кабинете Eskiz (DNS-зона evgo.uz)
| Тип | Имя | Значение |
|---|---|---|
| `A` | `@` (или пусто / `evgo.uz`) | `76.76.21.21` (или IP от Vercel) |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Подождать 10–30 мин → Vercel сам поставит «Valid» + SSL. Открыть `https://evgo.uz`.

### B3. API → `api.evgo.uz`
1. В Replit (Акмаль-ака) → **Deploy** API → **Custom domain** → `api.evgo.uz`.
2. В Eskiz-DNS: `CNAME  api  →  <deploy>.replit.app`

### B4. Админка → `admin.evgo.uz`
Deploy админки → Custom domain `admin.evgo.uz` → Eskiz-DNS: `CNAME  admin  →  <deploy>.replit.app`

### B5. Мобилка на боевой API
Secrets: `EXPO_PUBLIC_DOMAIN=api.evgo.uz` → пересобрать мобилку.

### Итоговая DNS-зона у Eskiz
```
@      A      76.76.21.21              ; лендинг (или IP от Vercel)
www    CNAME  cname.vercel-dns.com
api    CNAME  <deploy>.replit.app      ; API
admin  CNAME  <deploy>.replit.app      ; админка
```

---

## ЧАСТЬ C. Тест на iPhone

**Проблема Expo Go:** Expo Go на айфоне обновился до **SDK 57**, проект на **SDK 54**.
Expo Go на iOS поддерживает только новейший SDK → «Project is incompatible».

**Варианты (по возрастанию усилий):**
1. **Safari (веб) — сразу:** открыть `http://<LAN-IP ПК>:8081` (нужны запущенные
   API+Metro и открытый порт 8080 в firewall). Без Expo Go, SDK не важен.
2. **EAS dev-build (SDK 54):** `eas build --profile development --platform ios` →
   установить на телефон. Нативно, без апгрейда SDK. Правильный путь для теста.
3. **Апгрейд до SDK 57** (чтобы работал Expo Go): большой скачок (54→57),
   рискованно, и **для сторов не нужен** — App Store/Google Play собираются через
   EAS, который несёт свой SDK; Expo Go нужен только для дев-удобства.

> Для релиза в сторы Expo Go не используется. Апгрейд SDK — отдельная плановая
> задача, не блокер продукта.

---

## ЧАСТЬ D. Eskiz как SMS (для реальных OTP)
Раз кабинет Eskiz уже есть (домен там же) — оттуда же берутся SMS-ключи:
- Secrets: `ESKIZ_EMAIL`, `ESKIZ_PASSWORD` (секретный ключ кабинета), `ESKIZ_FROM`
  (согласованное имя отправителя), `ESKIZ_CALLBACK_URL`.
- Согласовать шаблон SMS в кабинете Eskiz (модерация).
- После этого убрать `DEMO_PHONE`/`DEMO_CODE`.

---

Связанные файлы: `docs/REPLIT_HANDOVER.md` (детали Replit), `docs/PROD_INTEGRATIONS.md`
(Payme/SMS/OCPI), `docs/DOMAIN_AND_TRANSFER.md` (ранняя версия этого гайда).
