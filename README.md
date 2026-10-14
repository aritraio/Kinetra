# Kinetra

> **High-Integrity, Evidence-Grounded Fitness Web Platform**  
> Turning personal context into verified nutrition and training plans with zero-tolerance for AI hallucinations.

Kinetra is an instrument-grade, privacy-first fitness web application that combines personalized nutrition and workout planning, daily telemetry tracking, offline logging, on-device kinematic form analysis, explainable progression, and measurable AI reliability.

Rather than treating Large Language Models as unverified authorities that hallucinate arbitrary diets or dangerous lifting volumes, Kinetra operates on a **Verification-First** architecture: pure peer-reviewed sports science rules (Mifflin-St Jeor, PAL multipliers, Morton et al. protein targets, US Navy circumference models) act as deterministic mathematical guardrails. AI acts solely as a structured plan generator, and its outputs must pass strict schema validation and domain verification before ever being presented to the user.

---

## Current Status: Production General Availability (Release v1.0.0)

The repository has completed all phases of the Master Engineering Plan and is officially released at **v1.0.0 General Availability (GA)**.

- **Deterministic Domain Verifiers**: Pure TypeScript mathematical validators enforce hard nutritional constraints (calories $\pm 50\text{ kcal}$, protein $\pm 10\text{g}$, carbs $\pm 20\text{g}$, fat $\pm 10\text{g}$, thermodynamic $4P+4C+9F$ math, 100% allergen exclusion) and athletic biomechanics (equipment matching, set limits 1–6, compound rest $\ge 60\text{s}$, volume ceiling $\le 16$ sets/muscle group/day).
- **Bounded Recovery Pipeline**: Initial model generation $\to$ max 1 semantic repair $\to$ verified deterministic template fallback. Hard constraint violations on accepted plans: **strictly 0**.
- **Multi-Tier AI Resilience & Circuit Breaker**: Primary `gemini-2.5-flash` with automatic failover to Groq `llama-3.3-70b-versatile` and vetted deterministic templates. Circuit breaker trips after 3 consecutive errors with 10s cooldown.
- **On-Device Posture Lab**: 100% client-side kinematic tracking (MediaPipe Pose / TensorFlow.js). Measures hip flexion, knee flexion, trunk lean, and tibia angles in real time. **Strictly zero camera video or photo frames ever leave the device.**
- **Explainable Adaptive Progression Engine**: Deterministic progressive overload and deload proposals governed by versioned policy (`2026-10-01`), backed by clear plain-language explanations and per-exercise user acceptance review.
- **Interactive Streaming Coach**: Low-latency Server-Sent Events (SSE) streaming with immediate client abort cancellation, bounded context (10 turns, 4,000 chars), and XSS sanitization.
- **Hands-Free Voice Logging**: Natural voice logging using Web Speech API with deterministic regex extraction into workouts, weights, and meals, paired with a mandatory user review sheet.
- **Revocable & Sanitized Plan Sharing**: Cryptographic expiring share grants ($\le 30$ days) with instant owner revocation and sanitization that strips all personal health telemetry.
- **Offline-First Synchronization**: Local Dexie IndexedDB (`KinetraDatabase`) with background outbox FIFO replay and conflict resolution.
- **User Privacy & Rights**: Self-service GDPR / CCPA machine-readable JSON data export and permanent account purge with cascading tombstone deletion.
- **Operational Observability**: Built-in operator dashboard (`OpsDashboard`) monitoring latency, provider failures, hourly quota reservation, and circuit breaker status with zero PII.
- **Automated Evaluations & Benchmark Metrics**: **100.0%** final acceptance across 44 demographic benchmark profiles, **0** accepted hard violations, **99.2/100** average rubric score, **2 ms** P95 latency, and **$0.00021** blended cost per generation.
- **Verified Test Scope**: **21 test suites / 184 tests passing** in Vitest, 0 bundle secret markers, and WCAG 2.1 AA accessibility compliance.

*See the [Phase 10 Release Report](docs/PHASE_10_REPORT.md), [Release Specification](docs/RELEASE_v1.0.0.md), and [Portfolio Evidence](docs/PORTFOLIO_DEMO_EVIDENCE.md).*

---

## Quick Start (Explore in 60 Seconds)

You can run the entire interactive application locally with zero cloud dependencies or API keys:

### 1. Requirements
- Node.js `24.19.0` (or compatible Node 24 LTS)
- pnpm `11.19.0` (`npm install --global pnpm@11.19.0`)

### 2. Boot the Development Environment
```sh
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Start the development server (API on 3001, Web on 5173)
pnpm dev
```

### 3. Open the App
Visit **[http://127.0.0.1:5173](http://127.0.0.1:5173)** in your browser.

---

## Feature Tour: How to Explore Kinetra

When you launch `http://127.0.0.1:5173`, you will see an instrument-grade dark UI. Here is how to explore its key features:

| Destination | What to Explore | What It Demonstrates |
| :--- | :--- | :--- |
| **Persona Pills** (Header) | Click **Maya Lin (Cut)** or **Marcus Vance (Bulk)**, or click **Reset to pristine** | Instant state swap across all repositories; validates multi-persona fixtures and zero-bleed isolation. |
| **Today** | Review today's workout prompt, calorie gauge, and macro progress bars. Click **Voice log** (microphone button) or fill out the quick log sheet. | Real-time intake vs. target calculations; Web Speech parsing with mandatory review sheet; optimistic offline updates. |
| **Measure** | Adjust demographic sliders, body weight, PAL activity level, and US Navy tape measurements. | Live Mifflin-St Jeor BMR, TDEE, macronutrient grams, and body-fat calculations with peer-reviewed literature citations. |
| **Plan** | Toggle between **Nutrition** (7-day schedules) and **Training** (multi-day splits). Review adaptive progression recommendations. | Canonical plan schema rendering, provenance badges, explainable progression acceptance, and revocable sharing modal. |
| **Posture** | Launch the on-device Form Lab. Position camera or select synthetic fixture presets. | Real-time joint angles, depth detection, knee valgus warnings; **zero camera frames transmitted off-device**. |
| **Coach** | Ask evidence-based training questions (e.g., *"Explain deload weeks"*). | Real-time SSE streaming with cancellation, citations, and bounded 10-turn history. |
| **Progress** | Inspect 14-day weight trend charts, compliance KPI cards, raw daily log records, and completed workout sessions. | 14 days of realistic progression telemetry without gaps or synthetic anomalies. |
| **Foundation & Ops** | Test typed tRPC health endpoints, SSE stream cancellation, or open the operational telemetry dashboard. | The underlying Phase 1 & 2 transport layer, circuit breaker status, and zero-PII monitoring. |

---

## Codebase Tour

The repository is organized as a strict, clean pnpm monorepo:

```
kinetra/
├── apps/
│   ├── web/               # React 19 + Vite frontend (CSS tokens, TanStack Router/Query, IndexedDB, Views)
│   └── api/               # Hono backend with tRPC routers, SSE streaming, AI pipeline, and idempotency store
├── packages/
│   ├── contracts/         # Canonical Zod schemas (Profile, Plans, Logs, Sessions, Coach streams, Repositories)
│   ├── domain/            # Pure sports science calculations, deterministic verifiers, kinematics, progression
│   ├── db/                # Drizzle ORM schema models, migrations, and tenant isolation types
│   └── config/            # Shared ESLint/Biome, TS configs, and environment validation
├── evals/                 # Synthetic benchmark corpus (44 profiles + 6 adversarial cases), rubrics, and runner
├── docs/                  # Comprehensive engineering docs and audit trail
│   ├── ARCHITECTURE.md    # System architecture, data flow, security model, and decision records
│   ├── PROJECT_PLAN.md    # Multi-phase master completion plan (Phases 0–10 completed)
│   ├── RELEASE_v1.0.0.md  # Frozen release candidate specification and pinned versions
│   ├── RELEASE_NOTES_v1.0.0.md # Official release notes
│   ├── PORTFOLIO_DEMO_EVIDENCE.md # Verification metrics, architecture diagrams, and user journeys
│   ├── USABILITY_REVIEW_v1.md # Task-based usability study with N=3 personas (92.5/100 SUS)
│   ├── POST_RELEASE_SIGNALS.md # 72-hour soak observation telemetry and incident response playbooks
│   ├── MIGRATION_AUDIT_v1.md # Ordered PostgreSQL migration audit and expand-contract runbook
│   ├── EVALUATION_GUIDE.md# Rubrics, scoring methodology, release gates, and cost economics
│   ├── PROGRESSION_POLICY.md # Adaptive progressive overload policy specifications
│   ├── POSTURE_FORM_SPEC.md # Biomechanical joint angles and kinematic form rules
│   ├── DEPLOYMENT_RUNBOOK.md # Production deployment, health probes, and rollback runbook
│   ├── RECOVERY_RUNBOOK.md # Disaster recovery playbooks (5 rehearsals validated)
│   ├── ACCESSIBILITY_AUDIT.md # WCAG 2.1 AA audit report (0 blocking defects)
│   ├── V2_BACKLOG.md      # Prioritized next-release roadmap and intentional v1 exclusions
│   └── WORKFLOW.md        # Engineering guidelines, testing protocols, and CI/CD rules
├── scripts/               # Boundary checking, security integration, deployed smoke checks, and env validation
├── supabase/              # Local Supabase migrations (5 ordered migrations), RLS policies, and SQL functions
├── tests/                 # Vitest test suites (21 test suites, 184 tests passing)
├── CONTRIBUTING.md        # Contributor guide and boundaries
├── LICENSE                # Apache 2.0 open-source license
└── PRIVACY.md             # Data minimization guarantees and privacy policy
```

---

## Verification & Quality Commands

Every change to the repository must pass our non-mutating quality check:

```sh
# Run full static analysis, boundary check, typecheck, 184 tests, and client secret scan
pnpm check

# Run all 21 unit, contract, domain, security, and recovery test suites in Vitest
pnpm test

# Run the 44-profile AI pipeline evaluation benchmark harness
pnpm evals

# Run deployed smoke checks across all 8 critical user journeys
pnpm smoke:deployed

# Run production environment separation and secret isolation validation
pnpm validate:env

# Run API smoke transport tests
pnpm smoke
```

### Optional: Local Database & Security Suite
If you have Docker Desktop or OrbStack running, you can test the complete local database and security layer:

```sh
# Start local Supabase containers (Auth, Postgres, Studio)
pnpm db:start
pnpm db:migrate
pnpm db:seed

# Run the 40-assertion security and tenant-isolation test suite
pnpm test:security

# Stop local database containers
pnpm db:stop
```

---

## Key Documentation Links

- [docs/RELEASE_v1.0.0.md](docs/RELEASE_v1.0.0.md) — Release Candidate Freeze Specification.
- [docs/RELEASE_NOTES_v1.0.0.md](docs/RELEASE_NOTES_v1.0.0.md) — Official v1.0.0 Release Notes.
- [docs/PORTFOLIO_DEMO_EVIDENCE.md](docs/PORTFOLIO_DEMO_EVIDENCE.md) — Verified evidence, architecture diagrams, and walkthroughs.
- [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) — Complete 11-phase master engineering plan (Phases 0–10).
- [docs/PHASE_10_REPORT.md](docs/PHASE_10_REPORT.md) — Phase 10 verification and closure report.
- [docs/USABILITY_REVIEW_v1.md](docs/USABILITY_REVIEW_v1.md) — Usability review with N=3 personas.
- [docs/POST_RELEASE_SIGNALS.md](docs/POST_RELEASE_SIGNALS.md) — Observability soak telemetry and runbook.
- [docs/V2_BACKLOG.md](docs/V2_BACKLOG.md) — Next-release roadmap and scope boundaries.
- [PRIVACY.md](PRIVACY.md) — Data minimization and privacy guarantees.
