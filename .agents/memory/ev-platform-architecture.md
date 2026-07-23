---
name: EV Platform Architecture
description: Stack decisions, API shape, auth, map, seed data, and known quirks for the iON EV platform
---

## Stack
- pnpm monorepo; Expo mobile (`artifacts/mobile`), React+Vite admin (`artifacts/admin`), Express+PostgreSQL API (`artifacts/api-server`)
- Drizzle ORM + PostgreSQL; OpenAPI → orval codegen → `lib/api-client-react` (React Query) + `lib/api-zod`
- Brand: gradient `#2563EB→#7C3AED`, background `#F7F8FA`, 20px radius cards

## API shape — critical
- `GET /api/stations` returns `{promoted: Station[], nearby: Station[]}` — NOT a plain array.
- Admin Stations page must flatten: `[...(res?.promoted ?? []), ...(res?.nearby ?? [])]` before calling `.filter()`.
- `GET /api/config` exposes Yandex/Google map keys (never in client bundle).

## Auth
- Admin: HMAC-SHA256 signed tokens; master creds from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars (highest priority).
- Demo user hardcoded: `user_001` (Akbar Pulatov).

## Web map
- Always uses Leaflet/OSM — Yandex JS API 2.1 key requires domain registration in Yandex Cloud Console and currently returns "Invalid API key". Removed Yandex code entirely from `MapViewWrapper.web.tsx`.
- Custom ⚡ pins: green (free) / orange (occupied). Zoom +/− and locate buttons bottom-right with `zIndex: 50`.

## Currency
- All prices stored as integers in сум (e.g., 2000 = 2 000 сум/кВт·ч).
- Mobile: `price.toLocaleString('ru-RU') + ' сум/кВт·ч'` (ru-RU formats with spaces).
- Admin: same format. Default form value for new stations: `"2000"` (not `"0.45"`).

## Real Uzbekistan EV operators (seeded July 2026)
37 stations across 6 operators:
- TOK BOR (8 stations, 100 kW DC, 2 000 сум/кВт·ч) — promoted with 10% discount
- KWATT (7 stations, 150 kW DC, 2 200 сум/кВт·ч) — some promoted with 5% discount
- Spectre (5 stations, 200 kW DC, 2 500 сум/кВт·ч)
- Megawatt (6 stations, 300 kW HPC, 2 300 сум/кВт·ч) — promoted
- UzAuto Motors (5 stations, 22 kW AC Type2, 1 600 сум/кВт·ч)
- Silk Road Charge (6 stations, 50 kW DC highway, 1 900 сум/кВт·ч)
Operators table has only (id, name, logo_url) — NO station_count column.

## DB schema notes
- `stations.is_promoted` = integer 0/1 (not boolean)
- `sessions.station_id` = integer NOT NULL but no FK constraint in DB — safe to replace stations without cascade
- No `station_count` column on operators table

## Navigation quirks (Expo Router)
- `station/[id].tsx`: Маршрут button passes `?stationId=&stationName=&lat=&lng=` to `/route/new`
- `route/new.tsx`: reads via `useLocalSearchParams`, pre-fills destination TextInput
- `cars.tsx`: add-car modal calls `GET /api/vehicles/search?q=`, then `useCreateVehicle`
- Alert.alert on web: replaced with `Platform.OS === 'web' ? window.confirm() : Alert.alert()` in charge.tsx and sessions.tsx

**Why:** Alert.alert inside Expo web iframe (Replit preview) works unreliably for destructive actions.
