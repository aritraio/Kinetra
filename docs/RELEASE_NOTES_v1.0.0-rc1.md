# Release Notes — Kinetra v1.0.0-rc1

**Release Candidate Tag:** `v1.0.0-rc1`  
**Date:** 2026-10-09  
**Monorepo Check Status:** `pnpm check` 100% Green (19 suites, 168 unit & integration tests)  
**Evaluation Status:** `pnpm evals` 100% Acceptance across 44 synthetic demographic profiles  

---

## 🚀 Overview of v1.0.0-rc1

Kinetra v1.0.0-rc1 represents the complete, production-hardened release candidate of Kinetra — a privacy-first, offline-capable, AI-assisted training and progression platform. 

Every architectural invariant established across Phases 1 through 9 is fully implemented, verified, and backed by automated regression tests and disaster recovery rehearsals.

---

## 🌟 Key Highlights & Shipped Features

### 1. Interactive Streaming Coach (P9-01)
- SSE-driven streaming coach interface in `apps/web/src/features/CoachView.tsx`.
- Guaranteed bounded context (last 10 messages, <= 4,000 characters).
- Client-side XSS sanitization and deduplicated concurrent operation tokens.
- Actionable error states with retry capabilities on provider interruptions.

### 2. Quick Voice Logging (P9-02)
- Natural voice logging via Web Speech API in `apps/web/src/features/VoiceLogModal.tsx`.
- Deterministic regex extraction into structured workout sets, morning body weight, and meal nutrition logs.
- Editable user review sheet before committing any data to persistent logs.

### 3. Revocable & Sanitized Plan Sharing (P9-03)
- Cryptographic, time-limited share grants (up to 30 days) with instant owner revocation.
- Domain-level plan sanitizer (`sanitizePlanForSharing`) completely excludes personal profiles, weights, daily logs, private notes, and progress photos.
- Dedicated public recipient view in `apps/web/src/features/SharedPlanView.tsx`.

### 4. Optional Progress Photos & 30-Day Lifecycle (P9-04)
- Explicit consent gating (`photo_storage`) required before capturing or uploading physique photos.
- Automatic 30-day lifecycle auto-expiry with database cleanup workers and client-side filters.
- Side-by-side historical comparison view with keyboard accessibility and alt text in `ProgressView.tsx`.

### 5. Multi-Tier AI Resilience & Circuit Breaker (P9-05)
- Automated failover pipeline: Gemini 2.5 Flash -> Groq Llama 3.3 70B -> Deterministic Vetted Templates.
- Adaptive `CircuitBreaker` trips after 3 consecutive failures, preventing cascading server stalls.
- Zero relaxation of domain verifiers: all output must pass rigorous safety and volume checks regardless of source.

### 6. Operational Telemetry & Alerting Dashboard (P9-06)
- Built-in operator dashboard in `apps/web/src/features/OpsDashboard.tsx`.
- Real-time monitoring of p50/p95 latency, provider failure rates, hourly quota buckets, sync errors, and circuit breaker status.
- Zero PII in operational traces.

### 7. On-Device Posture Lab (Phases 7 & 9)
- 100% on-device kinematic analysis using MediaPipe Pose / TensorFlow.js.
- Zero video frames transmitted off-device.
- Real-time joint angle computations, rep counting, and form defect detection (knee valgus, hip rise, depth warnings).

### 8. Explainable Adaptive Progression Engine (Phase 8)
- Deterministic progressive overload and deload adjustments governed by versioned policy (`2026-10-01`).
- Transparent markdown explanations and per-exercise acceptance review UI.

### 9. Offline-First Architecture & Outbox Synchronization (Phases 4 & 6)
- Atomic IndexedDB mutation logging (`KinetraDatabase`) guarantees local operation without connectivity.
- Background `SyncEngine` handles conflict resolution and FIFO replay upon reconnection.

### 10. Digital Accessibility & WCAG 2.1 AA Compliance (P9-08)
- 9 automated accessibility test suites verifying focus traps, ARIA roles, live regions, touch targets, and contrast.
- Full screen-reader support and native `prefers-reduced-motion` compliance.

---

## 📊 Verification & Quality Metrics

- **Unit & Integration Tests**: 168 tests across 19 suites, 100% passing.
- **Evaluation Benchmark**: 44 synthetic profiles evaluated, 100% acceptance rate, 0 hard violations.
- **Bundle Budgets**: Core app shell at 387 kB (120 kB gzip), all chunks strictly under 500 kB limit.
- **Security & Secret Scanner**: 0 exposed server secrets in web client bundles.
- **Disaster Recovery**: 5 simulated failure rehearsals passing (RPO = 0, RTO < 500ms).

---

## 📦 Monorepo Workspace Packages

- `@kinetra/contracts`: Shared schemas, Zod validators, and API interfaces.
- `@kinetra/domain`: Pure deterministic domain logic, kinematics, and progression rules.
- `@kinetra/db`: PostgreSQL schemas, RLS policies, and migrations.
- `@kinetra/api`: Hono REST/SSE server with AI provider adapters and telemetry.
- `@kinetra/web`: Offline-first React SPA with custom design system.
