---
name: ev-competitive-benchmarking
description: Comprehensive competitive UX/UI analysis and benchmarking framework for EV charging applications (Octopus Electroverse, Yandex Заправки/Карты, Tesla Supercharger, Fastned). Evaluates glanceability, in-car ergonomics, map latency, charging curve visualizers, connector status clarity, and roaming payment UX.
license: MIT
metadata:
  author: EV Product Guild
  version: "1.0.0"
---

# EV Competitive UX/UI Benchmarking Framework

Framework for auditing and comparing EV charging aggregator apps against industry leaders (**Octopus Electroverse**, **Яндекс Заправки/Карты**, **Tesla**, **Fastned**).

## 1. Evaluation Dimensions (0 to 10 Scale)

1. **Glanceability & Driver Ergonomics (In-Car Safety)**:
   - Can a driver safely discern available chargers within 2 seconds while stationary or navigating?
   - Target button size: Minimum 48x48 dp.
   - Contrast ratio: WCAG AAA compliant against dark backgrounds (#000000 / #0B0F1A).

2. **Real-Time Connector Transparency**:
   - Explicit breakdown of individual connectors (e.g., *GB/T 120kW: 2/2 Free*, *CCS2 60kW: 0/1 Occupied*).
   - Status color consistency:
     - Free: Vibrant Emerald / Volt Green (`#10B981` / `#2FD08A`).
     - Occupied: Warm Amber (`#F59E0B`).
     - Fault / Offline: Neutral Slate (`#64748B`).

3. **EV Range & Routing Intelligence**:
   - Model-specific SoC (State of Charge) calculation based on battery size, ambient temperature, and consumption.
   - Turn-by-turn navigation with auto-suggested charging stop intervals.

4. **Frictionless Payment & Roaming Settlement**:
   - Pre-authorization hold -> session metering -> receipt generation.
   - Native integration with regional payment gateways (Uzbekistan: Payme, Click, Uzum).
