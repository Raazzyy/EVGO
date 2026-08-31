---
name: claude-mem
description: Persistent, episodic, and semantic memory system across agent sessions. Preserves architectural decisions, critical constraints, business rules, API schemas, and historical pitfalls. Prevents context degradation, memory loss across restarts, and enables instantaneous workspace context recall.
license: MIT
metadata:
  author: Agentic Systems
  version: "2.0.0"
---

# Claude Mem — Persistent Agentic Memory & Knowledge Bank

A universal memory and context management framework for autonomous coding agents.

## 1. Memory Architecture

```
[ Active Conversation Context ]
          │
          ▼ (Index & Distill)
[ .agents/memory/MEMORY.md ] ─── Core Architecture & Active Context
          ├── [ .agents/memory/decisions/ ] ── Immutable Architecture Decision Records (ADR)
          ├── [ .agents/memory/pitfalls/ ]  ── Known Gotchas, Anti-patterns, Bug Records
          └── [ .agents/memory/domain/ ]    ── Business & Product Knowledge Graphs
```

## 2. Memory Tiering

### Tier 1: Working Memory (In-Session)
- Current task plan, execution trace, active files, uncommitted diffs.
- Ephemeral, reset per task.

### Tier 2: Episodic Memory (Project-Level)
- Stored in `.agents/memory/MEMORY.md`.
- Records:
  - Tech stack versions and platform constraints (e.g. Node 24, pnpm workspaces, Replit Linux-x64 overrides).
  - Business logic models (e.g. Tiyns in bigint, OCPI 2.2.1 flow, Eskiz SMS templates).
  - Key environment variables and secrets hierarchy.

### Tier 3: Semantic Decision Memory (ADRs)
- Stored in `.agents/memory/decisions/YYYY-MM-DD-title.md`.
- Records: Why decision X was chosen over Y (e.g. Schema-First OpenAPI with Orval over manual TypeScript interfaces).

## 3. Autonomous Memory Protocol

1. **Before Executing Any Large Task**:
   - Inspect `.agents/memory/` to check for prior decisions, constraints, or banned patterns.
2. **After Resolving Any Non-Trivial Bug**:
   - Record the root cause, fix pattern, and regression test under `.agents/memory/`.
3. **When Architecture Changes**:
   - Atomically update both code and the corresponding memory file.
