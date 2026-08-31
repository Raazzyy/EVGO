---
name: headroom
description: Context window headroom optimization, token budget management, progressive summarization, and high-efficiency file reading strategies. Maximizes reasoning performance for complex tasks by preventing token starvation, reducing context bloat, and focusing on high-signal code slices.
license: MIT
metadata:
  author: Context Systems
  version: "1.5.0"
---

# Headroom — Context Window & Token Budget Optimizer

`headroom` ensures the agent maintains maximum reasoning bandwidth (headroom) during long coding sessions.

## 1. Core Principles

1. **Slice-Over-Dump**: Never read entire multi-thousand line files when only a specific function or class is needed. Use `StartLine` and `EndLine` parameters.
2. **Grep-First Navigation**: Locate symbols with `grep_search` before opening files with `view_file`.
3. **Artifact Offloading**: Write large plans, test logs, and architectural audits to markdown artifacts in the artifact directory rather than dumping 1,000+ lines directly in chat messages.

## 2. Token Budget Guidelines

| Phase | Target Context Usage | Optimization Action |
|---|:---:|---|
| **Discovery / Research** | < 15% | Use ripgrep + targeted slices (< 100 lines) |
| **Planning** | < 25% | Offload detailed plans to markdown artifacts |
| **Execution** | 30% - 60% | Apply surgical diffs via `replace_file_content` |
| **Verification** | < 70% | Run tests, summarize pass/fail output concisely |

## 3. High-Signal Inspection Rules

- When inspecting schema: Read only table definitions and relations.
- When inspecting endpoints: Read route signature and validation schemas.
- When inspecting logs: Capture the relevant error stack trace, omit repetitive heartbeat logs.
