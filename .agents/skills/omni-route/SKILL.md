---
name: omni-route
description: Intelligent multi-agent routing, task decomposition, and specialized execution delegation. Directs tasks across specialized agent personas (System Architect, Database Engineer, Security Auditor, Mobile/Frontend Designer, QA/Tester) to solve complex workflows with zero hallucination and maximum precision.
license: MIT
metadata:
  author: Agentic Systems
  version: "2.0.0"
---

# Omni Route — Multi-Agent Routing & Task Decomposition

A deterministic task routing engine that decomposes complex user intents into specialized subagent workflows.

## 1. Routing Matrix

| Task Domain | Primary Persona | Specialized Skills / Focus |
|---|---|---|
| **API & Architecture** | System Architect | `lib/api-spec/openapi.yaml`, Zod codegen, REST endpoints, Drizzle ORM |
| **Fintech & Billing** | Financial Engineer | `uzbekistan-fintech-billing`, Payme JSON-RPC, Click, Bigint Tiyns, Holds |
| **EV Protocols & IoT** | Protocol Engineer | `ocpi-ev-charging`, CPO/eMSP Handshake, Locations, Telemetry |
| **Mobile & UI/UX** | Mobile Lead | `vercel-react-native-skills`, `animate-expo`, `apple-design`, Expo Router |
| **Security & Auth** | Security Auditor | `express-postgres-security`, AES-256 secrets, JWT scoping, OTP rate-limiting |
| **Store & DevOps** | Release Engineer | `eas-store-deployment`, App Store Connect, Google Play Data Safety, CI/CD |

## 2. Decomposition Workflow

```
[ User Request / Goal ]
           │
           ▼
   [ Omni Route Engine ]
           ├── 1. Analyze Dependency Tree (DB -> Backend -> Client -> Docs)
           ├── 2. Decompose into atomic, testable micro-steps
           ├── 3. Assign each step to the optimal domain persona
           └── 4. Enforce Strict Verification Loop before merging
```

## 3. Delegation Guardrails

- **Zero Assumption Rule**: Never guess schema types; inspect `openapi.yaml` and `lib/db/src/schema/`.
- **Atomic Verification**: Each routed phase must pass automated lint/typecheck before passing context to the next phase.
- **Fail-Fast Fallback**: If a routed subtask errors, return to the Architecture phase to re-evaluate the execution path.
