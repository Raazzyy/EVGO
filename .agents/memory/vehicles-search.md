---
name: Vehicles Search Pipeline
description: How vehicle search works end-to-end — alias resolution, merge order, fuzzy fallback, logging
---

## Search pipeline order (`GET /api/vehicles/search?q=`)
1. **Alias resolution** — query words lowercased → lookup in `vehicle_aliases` table (canonical column)
   - 61 aliases seeded: Cyrillic + typos → Latin. тесла→tesla, бид→byd, эксид→exeed, etc.
2. **Parallel fetch**: local DB (ilike, all data_source values), VEHICLE_OVERRIDES hash, API Ninjas live
3. **OpenEV live API** — only if words present: `GET https://api.open-ev-data.org/v1/vehicles?make={slug}`
4. **Fuzzy fallback** — only if no direct hits: `similarity(lower(name), lower(q)) > 0.2` via pg_trgm
5. **Merge & dedup** by lowercased name; source priority: override > openev > api_ninjas > manual

## Response shape
```json
{ "results": [...], "fuzzy": true|false }
```
Mobile `cars.tsx` handles both the old array format and the new `{ results, fuzzy }` format.

## New endpoints added
- `POST /api/vehicles/manual` — create user-submitted vehicle (data_source='manual', is_verified=false)
- `GET /api/admin/vehicles/manual` — list unverified manual vehicles
- `PATCH /api/admin/vehicles/:id/verify` — set is_verified=true, data_source='manual_verified'

## DB columns added to vehicles
data_source (text, default 'manual'), user_id, make, model, year, trim_name, body_style, vehicle_type, is_verified (bool, default true)

## zod dependency
Added `"zod": "catalog:"` to `artifacts/api-server/package.json` AND marked `"zod"` as external in `build.mjs` (esbuild externals list). Required because the vehicles route imports zod directly for the manual endpoint schema.

**Why:** esbuild bundles all deps; zod must be external because the workspace catalog version must be used consistently.
**How to apply:** Any new route that imports zod directly must ensure zod is in api-server deps AND external in build.mjs.
