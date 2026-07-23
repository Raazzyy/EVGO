---
name: EV Platform Architecture
description: Stack decisions, known bugs & fixes, API quirks, mobile patterns for the iON EV charging aggregator
---

## Stack
- Monorepo: pnpm workspaces, esbuild bundling
- DB: Drizzle ORM + PostgreSQL (`@workspace/db`); schema changes require API server restart
- API: Express on port 8080, routes in `artifacts/api-server/src/routes/`
- Mobile: Expo Router v6, web via Leaflet (`MapViewWrapper.web.tsx`), native via react-native-maps (`MapViewWrapper.native.tsx`)
- Admin: Vite + shadcn/ui, JWT auth via ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_JWT_SECRET secrets

## Known data type quirk — is_promoted
`is_promoted` is stored as integer `0`/`1` in DB, NOT boolean.
The API check in stations.ts is `=== 1 || === true`.
**Always use `!!is_promoted` in JSX conditions**, never bare `{is_promoted && ...}` — when `is_promoted = 0`, React Native renders `0` as raw text and crashes with "Text strings must be rendered within a <Text> component".

## Polyline decimation (react-native-maps)
Routes from Google Directions can have 40 000+ encoded points.
react-native-maps crashes with `RangeError: Property storage exceeds 196607 properties`.
**Why:** each coordinate becomes multiple properties in the native bridge.
**Fix:** decimate to ≤ 4 000 points in `MapViewWrapper.native.tsx` before passing to `<Polyline>`.

## CircularProgress component API
`artifacts/mobile/components/CircularProgress.tsx` accepts both `progress` and `pct` (legacy alias).
Also accepts: `strokeWidth`, `subLabel`, `icon`.
Two-half-clip technique (pure RN, no SVG).

## Maps
- Android: `android.config.googleMaps.apiKey` in app.json → GOOGLE_MAPS_ANDROID_KEY
- iOS: Apple Maps (no PROVIDER_GOOGLE), works in Expo Go without dev build
- Web: Leaflet in MapViewWrapper.web.tsx — `followUser` stub only (no heading/pitch)

## Geocoding
- Yandex Geocoder for reverse + suggest (YANDEX_GEOCODER_KEY)
- `GET /api/geocode/suggest?q=&lat=&lng=` → `[{title, subtitle, lat, lng}]`
- Address formatter skips country prefix

## Route language
- `&language=ru` added to Google Directions API URL so instructions arrive in Russian

## Station detail page grid layout
- 1 connector → 1 col full width
- 2–6 → 2 cols (FullConnectorCard)
- 7+ → 3 cols compact (CompactConnectorCard, tap to expand inline)
- Card width: `(screenW - 32 - gapSize*(cols-1)) / cols` via useWindowDimensions

## Admin tasks (pending)
- Task #1: DB schema (promos, banners, station/operator field additions) + API
- Task #2: Operators + Stations UI (depends on #1)
- Task #3: Promos + Banners UI (depends on #1)
- Task #4: Finance & Analytics page (depends on #1)
