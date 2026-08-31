---
name: code-review-excellence
description: Senior engineering code review guidelines covering OWASP Top 10 security, React Native / Expo performance pitfalls, Express & PostgreSQL query optimization, type safety, and architectural integrity. Use to audit codebases and identify subtle bugs before production deployment.
license: MIT
metadata:
  author: Senior Review Systems
  version: "2.0.0"
---

# Code Review Excellence — Senior Engineering & Security Audit

This skill establishes the standard for comprehensive code reviews across mobile, backend, database, and frontend codebases.

## 1. Security & Data Integrity Checklist (OWASP)

- [ ] **SQL Injection**: All database queries MUST use parameterized inputs (Drizzle ORM query builder / prepared statements). No string interpolation in SQL.
- [ ] **Authentication & Authorization**: Verify that every private endpoint checks both identity (`req.userId`) and permissions (e.g. role-based admin checks).
- [ ] **Currency & Arithmetic**: Ensure monetary amounts are stored in smallest integer units (Tiyins in `bigint`). No floating-point math for balances.
- [ ] **Secrets & Encryption**: API credentials and private keys must be encrypted at rest (AES-256-GCM) and loaded via environment variables.

## 2. React Native & Mobile Audit Checklist

- [ ] **Re-render Optimization**: Extract pure components, memoize expensive calculations (`useMemo`), and stabilize callbacks (`useCallback`).
- [ ] **List Virtualization**: Use `FlashList` or properly configured `FlatList` with `getItemLayout` and stable `keyExtractor`.
- [ ] **Memory & Cleanups**: Subscriptions (event listeners, timers, AbortControllers) must be cleaned up in `useEffect` return functions.
- [ ] **Safe Areas & Keyboard Handling**: Ensure screens account for status bar, navigation bar, and keyboard appearance via `SafeAreaView` and keyboard controllers.

## 3. Backend & API Audit Checklist

- [ ] **Rate Limiting**: Public endpoints (OTP request, login, geocoding) must have IP and identifier rate limits.
- [ ] **Reverse Proxy Trust**: `app.set("trust proxy", 1)` must be configured when running behind reverse proxies (Replit, Nginx, Cloudflare).
- [ ] **Error Sanitization**: Internal database errors or stack traces must never be exposed to the client in production responses.
