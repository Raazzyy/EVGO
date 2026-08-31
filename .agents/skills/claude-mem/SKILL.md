---
name: claude-mem
description: Continuous context memory, architecture decision logging, and long-term project memory system. Preserves workspace knowledge, past architectural decisions, gotchas, user preferences, and cross-session state in structured markdown files to avoid context loss and repetitive explanations.
license: MIT
metadata:
  author: Continuous Memory Systems
  version: "2.1.0"
---

# Claude Mem — Continuous Long-Term Agent Memory

`claude-mem` is a state-of-the-art long-term memory and context distillation skill designed for autonomous coding agents.

## 1. Memory Architecture

```
.agents/
├── memory/
│   ├── index.md           # Master index of project state & key decisions
│   ├── architecture.md    # System design, data flow, single-source-of-truth rules
│   ├── gotchas.md         # Discovered traps, platform quirks, and bugs
│   └── user_prefs.md      # User coding style, languages, communication preferences
```

## 2. When to Read & Write Memory

### On Turn Initialization (Read):
1. Check `.agents/memory/` and `replit.md` before starting non-trivial tasks.
2. Cross-reference past architectural decisions (e.g. why `openapi.yaml` drives types, why `bigint` is used for money).

### On Major Milestones (Write):
1. **New Architectural Decision**: Log to `.agents/memory/architecture.md`.
2. **Hidden Bug / Platform Gotcha Solved**: Log to `.agents/memory/gotchas.md`.
3. **User Preference Stated**: Log to `.agents/memory/user_prefs.md`.

## 3. Best Practices for Memory Management

- **Keep Entries Atomic & Chronological**: Use short, date-stamped bullet points.
- **Never Store Secrets**: Keep API keys, private tokens, and passwords out of memory logs.
- **Reference File Paths**: Always link to files via markdown links `[file.ts](file:///path/to/file.ts)`.
