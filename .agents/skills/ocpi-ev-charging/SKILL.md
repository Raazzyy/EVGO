---
name: ocpi-ev-charging
description: Complete engineering guide for implementing and integrating the Open Charge Point Interface (OCPI 2.2.1) protocol for EV charging aggregators and charge point operators (CPOs). Covers handshake credentials, location sync, tariffs, real-time connector statuses, remote charging commands (START_SESSION, STOP_SESSION), CDR settlement, and webhook listeners.
license: MIT
metadata:
  author: EVGO
  version: "1.0.0"
---

# OCPI 2.2.1 Protocol Engineering Guide

This skill provides comprehensive instructions for integrating EV Charging Networks using the **OCPI 2.2.1** (Open Charge Point Interface) standard.

## 1. Core Architecture & Roles

In OCPI terminology:
- **eMSP (e-Mobility Service Provider)**: The aggregator app (EVGO) that drivers use to find stations, start charges, and pay.
- **CPO (Charge Point Operator)**: The charging station network operator (e.g. TOK BOR, Megawatt, Quwatt) managing physical chargers.

```
[ Driver / EVGO App ] <---> [ EVGO Backend (eMSP) ] <=== OCPI 2.2.1 ===> [ Operator Platform (CPO) ] <---> [ EV Charger ]
```

## 2. Essential Modules & Data Flow

### 1. Handshake & Security (`credentials`)
- Both parties exchange server URLs and base tokens (`TOKEN_A` -> `TOKEN_B` -> `TOKEN_C`).
- Communication is strictly over HTTPS with `Authorization: Token <token>` header.
- Endpoint: `GET /ocpi/versions` and `POST /ocpi/2.2.1/credentials`.

### 2. Station Discovery & Real-Time Availability (`locations`)
- **Sender**: CPO pushes updates via `PUT /ocpi/2.2.1/locations/{country_code}/{party_id}/{location_id}` or eMSP pulls via `GET`.
- Contains:
  - `Location`: Station address, coordinates (`latitude`, `longitude`), amenities.
  - `EVSE`: Physical charging point / cabinet (ID, power, capabilities).
  - `Connector`: Standard (`IEC_62196_T2`, `GBT_DC`, `CHADEMO`, `IEC_62196_T2_COMBO`), power (`max_voltage`, `max_amperage`, `max_electric_power`), status (`AVAILABLE`, `BLOCKED`, `CHARGING`, `INOPERATIVE`, `OUTOFORDER`, `RESERVED`, `UNKNOWN`).

### 3. Remote Commands (`commands`)
Starting and stopping charging sessions remotely:
- **`START_SESSION`**: `POST /ocpi/2.2.1/commands/START_SESSION`
  - Body: `{ response_url: "...", token: { ... }, location_id: "...", evse_uid: "..." }`
  - Result: Async confirmation sent to `response_url`.
- **`STOP_SESSION`**: `POST /ocpi/2.2.1/commands/STOP_SESSION`
  - Body: `{ response_url: "...", session_id: "..." }`
- **`RESERVE_NOW`**: `POST /ocpi/2.2.1/commands/RESERVE_NOW` (holds connector for 15 mins).

### 4. Active Charging Sessions (`sessions`)
- CPO broadcasts real-time telemetry: `GET / PUT /ocpi/2.2.1/sessions/{session_id}`.
- Payload includes: `kwh`, `duration_minutes`, `current_soc` (battery % if reported by EV), `total_cost`.

### 5. Billing & Charge Detail Records (`cdrs`)
- Sent by CPO upon session completion: `POST /ocpi/2.2.1/cdrs`.
- Contains immutable financial record: total energy (kWh), charging duration, tariff breakdown, final price.
- Used by EVGO to finalize user wallet hold capture and settle with the operator.

## 3. Fallback for Operators without OCPI

If a regional operator has a custom REST or WebSocket API:
1. Implement an Adapter Layer in `artifacts/api-server/src/lib/operators/adapters/`.
2. Map their internal status model to EVGO standard:
   - `0 / free / available` -> `free`
   - `1 / busy / occupied / charging` -> `occupied`
   - `2 / error / offline / down` -> `offline`
