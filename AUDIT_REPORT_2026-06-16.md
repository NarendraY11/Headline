# Heading — Full E2E Audit Report

**Date:** 2026-06-16  
**Tester:** Claude Code (automated browser audit)  
**Environment:** Production — https://headline-blush.vercel.app  
**Auth:** 232199@kit.ac.in / Pro account  
**Viewports tested:** Desktop 1280×900, Mobile 390×844

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Pages tested | 18 |
| Flows tested | 12 |
| Total errors | 24 |
| Total warnings | 8 |
| **Critical issues** | **3** |
| **High issues** | **7** |
| **Medium issues** | **11** |
| **Low issues** | **7** |

---

## Critical Issues

### CRIT-01 · `/api/auth-event` crashes on every login
**Severity:** Critical  
POST /api/auth-event → 500 FUNCTION_INVOCATION_FAILED on every login.  
Raw error body exposed in response.

### CRIT-02 · `/api/study/materialize` crashes — raw error in UI
**Severity:** Critical  
POST /api/study/materialize → 500. "A server error has occurred FUNCTION_INVOCATION_FAILED bom1::..." rendered directly in DOM.  
Root cause: study_plans/study_missions migration unapplied in production.

### CRIT-03 · Admin "Logbook Stream" broken — missing FK on `attempts → profiles`
**Severity:** Critical  
GET .../attempts?select=...profiles(display_name,email) → 400 PGRST200.  
No FK relationship between attempts and profiles tables.

---

## High Priority Issues

- HIGH-01: /api/study/metrics → 500
- HIGH-02: 13× duplicate user_question_attempts queries on /today
- HIGH-03: Raw Vercel error IDs in UI DOM (bom1::t5mq2-...)
- HIGH-04: VIVA shows 1478 Q, A320 ATA shows 162 Q, Pricing says 6940+. Real DB: 78 questions.
- HIGH-05: Pricing Pro CTA silent no-op for existing Pro users
- HIGH-06: Admin activity log shows identical placeholder for all event types
- HIGH-07: Test blog post "Alfa / I dont know" publicly live in production

---

## Medium Priority Issues

- MED-01: Header breadcrumb shows "System" on /schedule and /referral
- MED-02: Profile shows raw slug dgca-cpl-mock for TARGET CLEARANCE
- MED-03: Mock exam history shows nav-gen, mock-exam, ata-21 as names
- MED-04: Admin QUESTIONS EVALUATED=0, SIMULATIONS LOGGED=0 despite real data
- MED-05: Referral page says "Stripe webhook" (app uses Razorpay)
- MED-06: "Unknown Agent" in admin activity log for AI events
- MED-07: Quiz header "ATA-34 · TYPE RATING" for /quiz/air-navigation
- MED-08: Mock exam history "0m" duration for most attempts
- MED-09: Mock exam history has 0/0 ghost sessions
- MED-10: ERR_FAILED on multiple pages
- MED-11: Strongest and weakest subject both show same entry

---

## Low Priority Issues

- LOW-01: Recharts -1×-1 chart sizing
- LOW-02: Login form missing autocomplete="current-password"
- LOW-03: Form fields missing id/name attributes
- LOW-04: Quiz choice letters removed from DOM post-submission
- LOW-05: /schedule and /referral generic page title
- LOW-06: Landing page consent banner label issues
- LOW-07: Pre-login POST /events → 401

---

## Network Failures

| Method | URL | Status | Root Cause |
|--------|-----|--------|------------|
| POST | /api/auth-event | 500 | FUNCTION_INVOCATION_FAILED |
| POST | /api/study/materialize | 500 | Unapplied DB migration |
| POST | /api/study/metrics | 500 | Same migration issue |
| GET | attempts?select=...profiles(...) | 400 | PGRST200 - no FK |
| GET | question_reports?select=...profiles(...) | 400 | PGRST200 - no FK |

---

## Security Findings

- SEC-01: Raw Vercel error IDs in DOM (bom1::t5mq2-...)
- SEC-02: Raw API error body from /api/auth-event
- SEC-03: Service role usage audit needed
- SEC-04: Login form missing autocomplete
