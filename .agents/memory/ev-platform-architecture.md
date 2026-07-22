---
name: EV Charging Platform Architecture
description: Key decisions and patterns for the EV charging aggregator project (admin panel + mobile app + API)
---

## Stack
- **Monorepo**: pnpm workspaces
- **API**: Express + TypeScript in `artifacts/api-server`, built with esbuild via `build.mjs`
- **DB**: Drizzle ORM + PostgreSQL in `lib/db` — push schema with `pnpm --filter @workspace/db run push`
- **API contract**: OpenAPI spec at `lib/api-spec/openapi.yaml` → codegen to `lib/api-client-react` (React Query) and `lib/api-zod` (Zod validators)
- **Admin panel**: React + Vite at `artifacts/admin`, previewPath `/`
- **Mobile**: Expo Router at `artifacts/mobile`, previewPath `/mobile/`

## Auth
- Admin credentials seeded in `admin_users` table (email: `admin@evcharge.uz`, password: `admin123` stored as plain text for demo)
- Token stored in `localStorage` key `admin_token`

## react-native-maps on Web
- `react-native-maps` is native-only; importing it in any `.tsx` file breaks the web bundle
- **Fix**: split into `components/MapViewWrapper.native.tsx` (real MapView) and `components/MapViewWrapper.web.tsx` (placeholder)
- Do NOT put react-native-maps import anywhere except `.native.tsx` files
- Pin to exactly `1.18.0` in package.json; do NOT add it to `plugins` in app.json

## API Routes
- Routes file named `routes_route.ts` (not `routes.ts`) to avoid Node module shadowing
- All routes exported from `artifacts/api-server/src/routes/index.ts`
- Zod validators imported from `@workspace/api-zod` — the health route originally imported non-existent `HealthCheckResponse`; use inline `res.json({ status: 'ok' })` instead

## Seed Data
- 18 stations (15 Tashkent + 3 on Tashkent→Samarkand corridor)
- 5 users (user_001 through user_005), hardcoded `user_001` as demo user in AppContext
- 7 vehicles, seeded routes including Tashkent→Samarkand
- Prices: 1500–2600 sum/kWh

## Mobile AppContext
- `userId` hardcoded to `user_001` for demo
- `selectedVehicleId` defaults to `1` (Hyundai IONIQ 5)
- No persistent auth — demo-mode only

**Why:** Platform is a demo/prototype; full auth out of scope for first build.
