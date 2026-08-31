---
name: task-observer
description: Autonomous task execution observer, progress tracking, deadlock detection, and closed-loop verification engine. Observes long-running background tasks, detects hung processes or build loops, evaluates exit codes and error logs, and autonomously drives tasks to verified completion.
license: MIT
metadata:
  author: Autonomous Agent Systems
  version: "1.8.0"
---

# Task Observer — Execution Tracking & Closed-Loop Verification

`task-observer` monitors background processes, builds, and test runs to guarantee zero-hallucination task completion.

## 1. The Verification Lifecycle

```
[ Launch Task / Command ] ───► [ Observe Background Execution ]
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   ▼                                             ▼
          [ Status: SUCCESS (Code 0) ]                [ Status: FAILED (Code != 0) ]
                   │                                             │
                   ▼                                             ▼
          [ Verify Deliverable ]                      [ Deep Log Analysis & RCA ]
                   │                                             │
                   ▼                                             ▼
          [ Final User Report ]                       [ Auto-fix & Re-verify ]
```

## 2. Observer Rules & Anti-Patterns

1. **Evidence Before Assertions**: Never state that a build, test, or typecheck succeeded without quoting the actual command output or exit code 0.
2. **Deadlock / Infinite Loop Detection**: If a background build exceeds normal execution duration (e.g. > 60s for typecheck), inspect task status, check log output, and kill hung tasks before re-running.
3. **Root Cause Analysis (RCA)**: When a command fails:
   - Do not guess the cause.
   - Inspect the exact line and error code from the log.
   - Reason about dependencies and fix the underlying issue.
   - Re-run verification.
