# Kinetra v1.0.0 Release Candidate Freeze Specification

**Release Version:** `v1.0.0`  
**Git Commit SHA:** `0708c2864d9a958b75b9616524143663220034c2`  
**Freeze Date:** 2026-10-10  
**Status:** FROZEN & RELEASE-READY  
**Monorepo Check Status:** `pnpm check` PASSED (100% green)  
**Evaluation Status:** `pnpm evals` PASSED (100% acceptance, 0 hard violations)  

---

## 1. Pinned Versions & Component Manifest

| Component | Pinned Version / Identifier | Specification / Policy File |
| :--- | :--- | :--- |
| **Monorepo Engine** | Node `24.19.0`, pnpm `11.19.0` | `package.json` |
| **API Protocol** | tRPC v11.19.0, SSE Protocol v1 | `apps/api/src/router.ts` |
| **Shared Contracts** | `@kinetra/contracts` v1.0.0 | `packages/contracts/` |
| **Domain Engine** | `@kinetra/domain` v1.0.0 | `packages/domain/` |
| **Database Migrations** | `20261001000000` through `20261009010000` (5 migrations) | `supabase/migrations/` |
| **Progression Policy** | `2026-10-01` | `docs/PROGRESSION_POLICY.md` |
| **Posture & Form Spec** | `2026-10-01` | `docs/POSTURE_FORM_SPEC.md` |
| **Privacy Policy** | `2026-10-09` | `PRIVACY.md` |
| **Primary AI Model** | `gemini-2.5-flash` (pinned, temp 0.2, seed 42) | `apps/api/src/ai/provider-adapter.ts` |
| **Secondary AI Model** | `llama-3.3-70b-versatile` (Groq fallback, temp 0.2) | `apps/api/src/ai/fallback-provider.ts` |
| **Failover Templates** | Canonical Deterministic Templates v1 | `packages/domain/src/fallback-templates.ts` |
| **Generation Prompts** | `kinetra-workout-v1`, `kinetra-nutrition-v1`, `kinetra-coach-v1` | `apps/api/src/ai/` |

---

## 2. Certified Feature Scope (Shipped in v1.0.0)

1. **Deterministic Verification-First AI Generation**:
   - Pure mathematical sports science validation (Mifflin-St Jeor, PAL, Morton et al. protein targets, Navy circumference).
   - Strict nutritional energy balance ($\pm 50$ kcal, exact $4P+4C+9F$ thermodynamic math, 100% allergen exclusion).
   - Biomechanical workout validation (equipment constraints, 1–6 set limits, compound rest $\ge 60$s, daily muscle volume ceiling $\le 16$ sets).
   - Bounded self-healing recovery: primary generation $\to$ max 1 semantic repair $\to$ deterministic vetted template fallback.
   - Hard constraint violations on accepted plans: **strictly 0**.

2. **On-Device Posture & Form Lab**:
   - 100% client-side kinematic tracking (MediaPipe Pose / TensorFlow.js).
   - Real-time joint angle computations: hip flexion, knee angle, trunk inclination, tibia angle.
   - Immediate audio/visual cueing for depth, knee valgus, and premature hip rise.
   - Privacy guarantee: **strictly zero camera video or photo frames leave the device**.
   - MediaStream tracks explicitly released upon view unmount.

3. **Adaptive Progressive Overload Engine**:
   - Deterministic rule engine evaluating multi-session RPE, load, and completion logs.
   - Bounded adjustments ($\le 5\%$ load increase, deload protocols for cumulative fatigue).
   - Human-in-the-loop: interactive acceptance review sheet generating immutable plan versions with `'progression'` provenance.

4. **Interactive Streaming Coach**:
   - Real-time Server-Sent Events (SSE) streaming with immediate client abort / cancellation.
   - Bounded context: maximum 10 turns and 4,000 characters to prevent token inflation.
   - Client-side XSS sanitization (`sanitizeCoachText`).
   - Deduplicated concurrent operations via cryptographic request hashing.

5. **Quick Voice Logging**:
   - Web Speech API voice capture with deterministic extraction into workout sets, morning body weight, and meals.
   - Mandatory editable review sheet before persisting logs to storage.
   - Typed manual entry as universal 100% accessible fallback.

6. **Revocable & Sanitized Plan Sharing**:
   - Time-bounded cryptographic share tokens (up to 30 days) with instant owner revocation.
   - Domain sanitizer strips all user profiles, body weights, daily logs, notes, and photos.
   - Dedicated recipient view displaying workout and meal splits without authentication.

7. **Optional Progress Photos with 30-Day Auto-Expiry**:
   - Explicit consent check (`photo_storage`) required before camera or upload activation.
   - Automatic 30-day retention enforcement; photos $> 30$ days old are excluded and purged.
   - Side-by-side accessible timeline comparison with keyboard navigation.

8. **Offline-First Architecture & Synchronization**:
   - Local-first operation via Dexie IndexedDB (`KinetraDatabase`).
   - Background outbox sync engine with FIFO ordering and conflict resolution.
   - Zero data loss during network dropouts or offline workout logging.

9. **Self-Service Privacy & Data Lifecycle Controls**:
   - One-click machine-readable JSON data export (GDPR / CCPA).
   - Complete account purge with cryptographic tombstone cascading deletion.

10. **Operational Telemetry & Observability**:
    - Built-in `OpsDashboard` tracking p50/p95 latency, provider error rates, hourly token budgets, and circuit breaker health.
    - Zero PII in operational traces.

---

## 3. Explicitly Known Limitations & Boundaries

1. **Posture Lab View Angle**: Calibrated for sagittal-plane (side view) squats. Frontal-plane tracking is bounded to bilateral knee valgus estimation.
2. **Speech Recognition Support**: Web Speech API is browser-dependent (Chrome/Edge/Safari). Unsupported browsers gracefully present typed manual logging.
3. **Camera Hardware**: Requires browser camera permissions. For devices without a camera, synthetic fixture presets allow full exploration of kinematic evaluation.
4. **Scope Exclusions (Non-Goals for v1)**:
   - No direct Bluetooth LE peripheral / wearable heart-rate monitor pairing (deferred to v2).
   - No multi-tenant commercial gym management or trainer billing (deferred to v2).
   - No native iOS/Android binary wrappers (PWA web deployment certified for v1).

---

## 4. Release-Blocking Conditions Verification (Section 14 Audit)

Every release-blocking condition from Section 14 of the Master Project Plan has been audited and cleared:

| Condition | Verification Status | Evidence |
| :--- | :--- | :--- |
| **1. Anonymous or wrong-owner access to data/paid generation** | **CLEARED** | RLS on all tenant tables (`auth.uid() = owner_id`), quota reservation, `tests/security.test.ts`. |
| **2. Accepted plans failing configured hard constraints** | **CLEARED** | Deterministic domain verifiers reject violations; 44/44 eval profiles have 0 violations (`evals/runner.ts`). |
| **3. Unbounded provider attempts, missing quota, exposed secrets** | **CLEARED** | Max 1 repair attempt, hourly quota limits, `CircuitBreaker`, zero secrets in client bundles (`scripts/scan-web.ts`). |
| **4. Silent loss/overwrite of logs or plan history** | **CLEARED** | IndexedDB atomic outbox, immutable plan versions, `tests/offline-lifecycle.test.ts`. |
| **5. Real-user data collection without truthful consent/export/deletion** | **CLEARED** | Explicit consent toggles, JSON export, cryptographic tombstone deletion, `tests/user-controls.test.ts`. |
| **6. Camera capture continuing after exit or undisclosed photo upload** | **CLEARED** | MediaStream tracks stopped on unmount, 0 frames sent to server, `tests/photos-lifecycle.test.ts`. |
| **7. Blocking keyboard, sign-in, or core mobile-journey failures** | **CLEARED** | WCAG 2.1 AA audit passed, 0 keyboard traps, 5 critical browser journeys passing (`tests/critical-journeys.test.ts`). |
| **8. Production schema change without tested recovery strategy** | **CLEARED** | 5 disaster recovery playbooks tested in `tests/recovery-rehearsal.test.ts`. |
| **9. README claims implying unimplemented features or fabricated metrics** | **CLEARED** | README audited and updated with exact measured numbers and reproduction commands. |

**Current Open Blockers:** **0**  
**Release Sign-off:** **APPROVED FOR DEPLOYMENT**
