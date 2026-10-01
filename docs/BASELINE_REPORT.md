# Kinetra Phase 0 Baseline Report

- **Date:** 2026-10-01
- **Status:** Completed
- **Phase Output:** Confirmed scope, greenfield baseline inventory, foundation decisions, and negative acceptance test definitions.

---

## 1. Executive Summary

Phase 0 establishes the factual baseline for Kinetra. A comprehensive inventory of this repository confirms that **no prior prototype source code, package manifests, or database instances exist in this checkout**. The three historical reviews (`ideas.improve.md`, `improve.md`, `recomenation-for-imporvemt.md`) describe an earlier experiment ("FitnessBaba") and serve as qualitative reference inputs, not runnable code.

Consequently, Kinetra starts as a **greenfield build** using a modern, typed pnpm monorepo structure. All legacy migration assumptions (such as Clerk user migration and backward-compatibility backfills) are formally classified as **Not Applicable (N/A)**. Scope has been frozen around six core destinations, and historical vulnerabilities have been codified into strict negative acceptance criteria.

---

## 2. P0-01 & P0-02 — Inventory and Source Strategy

| Item | Finding / Decision | Rationale & Evidence |
| :--- | :--- | :--- |
| **Existing Codebase** | Absent from checkout | Working directory contains only documentation, reviews, and the Phase 1 scaffold. |
| **Build Strategy** | **Greenfield Build** | Decided in [ADR 0001](decisions/0001-greenfield-architecture.md). No legacy debt or obsolete `window.*` globals will be imported. |
| **P0-02 Reproduction** | **Not Applicable (N/A)** | No legacy package lockfile or application source exists to execute. |
| **Auth & Data Baseline**| Supabase Auth & Postgres | Clean setup directly on Supabase; avoids complex Clerk-to-Supabase identity migration. |

---

## 3. P0-03 — Historical Findings Converted to Negative Acceptance Tests

The historical reviews identified severe architectural and security flaws in the prototype. For this greenfield codebase, these have been converted into mandatory negative acceptance criteria enforced in Phases 1–4:

### 1. Reject Client-Supplied Provider Keys
- **Historical flaw:** `/api/chat.js` accepted an API key directly from the client request payload.
- **Negative Acceptance Test:** Any API request payload containing `apiKey`, `geminiKey`, or provider tokens in headers or body must be rejected immediately with `400 Bad Request` or `422 Unprocessable Entity`.
- **Target Gate:** Phase 2 (P2-04).

### 2. Prohibit Anonymous Plan Generation
- **Historical flaw:** Multiple execution paths permitted unauthenticated calls to expensive AI models.
- **Negative Acceptance Test:** Requests to generation endpoints (`/api/plans/generate`, `/api/stream/coach`) lacking a verified Supabase JWT session must return `401 Unauthorized` without invoking any AI provider.
- **Target Gate:** Phase 2 (P2-01).

### 3. Escaped Text Rendering (Zero HTML Injection)
- **Historical flaw:** Generated text was interpolated via `innerHTML`, exposing users to prompt injection / XSS attacks.
- **Negative Acceptance Test:** React components must render AI model outputs as text nodes (`{text}`). Any rich Markdown formatting must be parsed through a strict, sanitized parser allowing only safe elements (`p`, `strong`, `em`, `ul`, `li`). Raw HTML tags (`<script>`, `<iframe>`, `<img>`, `<a>` with javascript: URIs) must be stripped or escaped.
- **Target Gate:** Phase 2 (P2-06) & Phase 5 (P5-01).

### 4. Zero Photo Bytes in JSONB Profile Columns
- **Historical flaw:** Full-resolution base64 photos were written directly into user profile JSONB fields.
- **Negative Acceptance Test:** Profile schema validation (`@kinetra/contracts`) must enforce an allow-list of biometric and preference fields. Supplying image data, base64 strings, or arbitrary metadata keys to profile endpoints must fail schema validation. Progress photos must strictly use private Supabase Storage object paths with time-limited signed URLs.
- **Target Gate:** Phase 2 (P2-07) & Phase 6 (P6-09).

### 5. Atomic Quota Enforcement Under Concurrency
- **Historical flaw:** Client-side rate limiting and non-atomic database checks created race conditions where parallel requests bypassed generation quotas.
- **Negative Acceptance Test:** Parallel burst requests (e.g. 10 simultaneous requests from an account with 1 remaining generation credit) must grant exactly 1 generation and reject 9 with `429 Too Many Requests`.
- **Target Gate:** Phase 2 (P2-05).

### 6. Strict Date and Timezone Handling
- **Historical flaw:** Date arithmetic used browser-local midnight, causing logged entries to jump dates during travel or daylight saving transitions.
- **Negative Acceptance Test:** Daily logs must be keyed by an explicit ISO date string (`YYYY-MM-DD`) representing the user's active local day, while all timestamps are recorded in UTC with the profile's declared IANA timezone (`e.g., America/New_York`). Shifts in timezone must not re-index historical entries.
- **Target Gate:** Phase 2 (P2-08).

---

## 4. P0-04 — Scope Freeze

### Core Destinations (Frozen at 6 + Onboarding)
1. **Onboarding:** Progressive profile setup (biometrics, goals, dietary exclusions, unit preferences, timezone).
2. **Today:** Single next action, active plan card, daily progress logger, connectivity/sync status.
3. **Measure:** Transparent BMR/TDEE calculations with cited formulas, trend history, and unit toggles.
4. **Plan:** Verified workout and meal plans with immutable versioning and revision history.
5. **Coach:** Real-time streamed chat with clear cancellation, conversation boundaries, and error recovery.
6. **Form Lab:** Local camera-based pose analysis for a single supported movement (Squat) via on-device landmark tracking.
7. **Progress:** Historical charts, logs, consistency metrics, and data export/deletion controls.

### Explicit Scope Exclusions (Out of Scope for v1)
- **Skincare:** Acne scans, skincare product routines, and dermal claims are completely eliminated.
- **Photo Body-Fat Claims:** Estimating body fat % from user photos is prohibited. Replaced by US Navy tape-measure formulas.
- **Food Label Barcode / OCR:** Deferred to post-v1.
- **Wearables & Smartwatch Integration:** Deferred to post-v1.
- **Social Features & Leaderboards:** Excluded from v1.

---

## 5. P0-05 — Foundation Decisions Summary

All core architecture decisions for Phase 0 have been agreed upon and formally recorded in `docs/decisions/`:

- **[ADR 0001: Greenfield Architecture and Identity Baseline](decisions/0001-greenfield-architecture.md)** — Greenfield build; unified Supabase Auth, Postgres, and Storage; legacy migration tasks flagged N/A.
- **[ADR 0002: Runtime and API Transport Architecture](decisions/0002-runtime-and-api-transport.md)** — Node.js Serverless runtime for Hono API; tRPC for typed request/response; SSE for streaming token channels; Vite SPA for React Web.
- **[ADR 0003: AI Provider Adapter and Pipeline Boundary](decisions/0003-ai-provider-and-pipeline-boundary.md)** — Primary provider is Google Gemini (`@google/genai`); server-only isolation; runtime Zod schema parsing + domain verifier gate; bounded single repair + verified static fallback templates.
- **[ADR 0004: Scope Governance, Domain Policy, and Licensing](decisions/0004-scope-governance-and-domain-policy.md)** — Frozen 6-destination layout; exclusion of dubious health claims; scientific energy baselines (Mifflin-St Jeor); candidate MIT License.

---

## 6. P0-06 — Task Board & Phase 0 Evidence Record

| Task ID | Task Description | Owner | Status | Evidence / Artifact |
| :--- | :--- | :--- | :--- | :--- |
| **P0-01** | Greenfield vs. Migration Decision | Engineering Lead | **Done** | [ADR 0001](decisions/0001-greenfield-architecture.md), Section 2 of this report. |
| **P0-02** | Reproduce Existing Application | Engineering Lead | **Done (N/A)** | Documented in Section 2; no legacy source code in checkout. |
| **P0-03** | Turn Historical Findings into Negative Tests | Security & AI Lead | **Done** | Section 3 of this report defines negative tests for P2-01 to P2-08. |
| **P0-04** | Freeze Initial-Release & Full-v1 Scope | Product & Domain Lead | **Done** | [ADR 0004](decisions/0004-scope-governance-and-domain-policy.md), Section 4 of this report. |
| **P0-05** | Close Foundation Decisions | Architecture Lead | **Done** | [ADR 0001](decisions/0001-greenfield-architecture.md), [ADR 0002](decisions/0002-runtime-and-api-transport.md), [ADR 0003](decisions/0003-ai-provider-and-pipeline-boundary.md), [ADR 0004](decisions/0004-scope-governance-and-domain-policy.md). |
| **P0-06** | Task Board and Baseline Report | Engineering Lead | **Done** | This document ([docs/BASELINE_REPORT.md](BASELINE_REPORT.md)) & [PROJECT_PLAN.md](PROJECT_PLAN.md) evidence table. |

---

## 7. Exit Gate Verification

- [x] **Source strategy is explicit:** Greenfield build confirmed; legacy migration dependencies removed.
- [x] **Release scope is frozen:** 6 destinations agreed upon; unscientific features excluded.
- [x] **Historical security concerns codified:** 6 negative acceptance criteria defined with target implementation phases.
- [x] **Zero unverified metrics presented as current behavior:** Confirmed that baseline measurements will be established during Phase 1–4 runs.

**Phase 0 is complete and the exit gate is satisfied. Proceeding to Phase 1 is unblocked.**
