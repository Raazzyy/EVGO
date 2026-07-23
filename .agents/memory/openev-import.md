---
name: OpenEV Import
description: GitHub release asset pattern, import startup behavior, connector mapping rules for open-ev-data-dataset
---

## Asset name pattern
The latest release JSON asset matches `a.name.endsWith(".json") && a.name.startsWith("open-ev-data")`.
Example: `open-ev-data-v1.24.0.json`. Do NOT hardcode the full name — it changes per release.

## Startup behavior
- `scheduleOpenEvSync()` called from `index.ts` inside the `app.listen` callback.
- On startup: checks `data_source='openev'` count — imports if zero, skips if data present.
- Weekly re-import via `setTimeout` (7 days).
- Script: `artifacts/api-server/src/scripts/import-openev.ts`

## Connector mapping (OpenEV slug → enum)
- ccs2 → CCS2, ccs1 → CCS2, chademo → CHAdeMO, type_2 → Type2, type_1 → Type2, gb_t_dc/gb_t_ac → GB-T, nacs → CCS2
- Prefer DC connector: priority order CCS2 > CHAdeMO > GB-T > Type2

## Range priority
WLTP > EPA > CLTC > first available. Falls back to 300 km if no rated range.

## First run result
1189 vehicles imported (v1.24.0 dataset).

**Why:** The enum only has 4 types; NACS/CCS1/Type1 are not in the UZ market.
**How to apply:** Any change to connector mapping must also update `pickConnector()` in the script.
