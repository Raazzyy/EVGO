---
name: uzbekistan-fintech-billing
description: Complete architecture and integration patterns for Uzbek payment providers (Payme JSON-RPC 7 methods, Click Shop API prepare/complete, Uzum Pay). Covers currency arithmetic (tiyins in bigint), concurrency locks (SELECT FOR UPDATE), pre-authorization holds for EV charging sessions, and fiscal data compliance.
license: MIT
metadata:
  author: EVGO
  version: "1.0.0"
---

# Uzbekistan Fintech Billing & EV Charging Protocol Guide

Guide for integrating payment systems in Uzbekistan with a focus on EV charging session billing.

## 1. Golden Rules of Currency in Uzbekistan

1. **Always store money in Tiyins (bigint)**:
   - 1 UZS (Сум) = 100 Tiyins (Тийины).
   - NEVER use `float` or `real` in database schemas or JavaScript numbers without rounding guards.
   - Example: 50,000 UZS = `5000000n` tiyins.

2. **Pre-Authorization Holds for EV Charging**:
   - Charging power cannot be predicted 100% upfront.
   - Flow:
     1. User initiates charge -> Create `wallet_hold` of 50,000 UZS (`status: 'active'`).
     2. Connector activates -> Charger delivers kWh.
     3. Session completes -> Calculate exact cost (e.g., 34,200 UZS).
     4. Capture `3420000` tiyins from wallet balance, release remaining `1580000` tiyins.
     5. If session never starts within 15 minutes -> Auto-release hold.

## 2. Payme JSON-RPC Integration

### Required Methods (State Machine):
1. `CheckPerformTransaction`: Validates user account, billing feasibility, and amount.
2. `CreateTransaction`: Creates transaction in state `1` (Created), sets timeout.
3. `PerformTransaction`: Moves transaction to state `2` (Completed), credits wallet balance.
4. `CancelTransaction`: Cancels transaction (state `-1` or `-2`), reverses wallet credit if necessary.
5. `CheckTransaction`: Returns current status, timestamps, and reason.
6. `GetStatement`: Generates reconciliation statement for a date range.
7. `SetFiscalData`: Attaches receipt number, OFD fiscal signs, and IKPU codes (e.g., IKPU for electric vehicle charging services).

### Security Requirements:
- HTTP Basic Auth with `Paycom:<PAYME_SECRET_KEY>`.
- Restrict inbound webhook requests to Payme IP range: `185.234.113.1` - `185.234.113.15`.

## 3. Click Shop Protocol

### Flow:
- `Prepare`: Click sends `action: 0` to check account and invoice. Returns `click_trans_id` and `merchant_prepare_id`.
- `Complete`: Click sends `action: 1` to commit payment. Returns `merchant_confirm_id`.
- Sign Verification: `md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)`.
- Always verify signature with `crypto.timingSafeEqual` to avoid timing attacks.
