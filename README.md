# Kinetra

> **High-Integrity, Evidence-Grounded Fitness Web Platform**  
> Turning personal context into verified nutrition and training plans with zero-tolerance for AI hallucinations.

Kinetra is a fitness web application that combines personalized nutrition and workout planning, daily telemetry tracking, offline logging, and measurable AI reliability.

Rather than treating Large Language Models as unverified authorities that hallucinate arbitrary diets or dangerous lifting volumes, Kinetra operates on a **Verification-First** architecture: pure peer-reviewed sports science rules (Mifflin-St Jeor, PAL multipliers, Morton et al. protein targets, US Navy circumference models) act as deterministic mathematical guardrails. AI acts solely as a structured plan generator, and its outputs must pass strict schema validation and domain verification before being presented to the user.

---

## Current Status: Phase 4 Implemented Locally

The repository is currently at **Phase 4 ("Verified AI pipeline and evaluations")**.

- **Deterministic Domain Verifiers**: Pure TypeScript mathematical validators enforce hard nutritional constraints (calories $\pm 50\text{ kcal}$, protein $\pm 10\text{g}$, carbs $\pm 20\text{g}$, fat $\pm 10\text{g}$, thermodynamic $4P+4C+9F$ math, 100% allergen exclusion) and athletic biomechanics (equipment matching, set limits 1–6, compound rest $\ge 60\text{s}$, volume ceiling $\le 16$ sets/muscle group/day).
- **Bounded Recovery Pipeline**: Initial model generation $\to$ max 1 semantic repair $\to$ verified deterministic template fallback. Hard constraint violations on accepted plans: **strictly 0**.
- **Generation Idempotency & Conflict Safety**: SHA-256 payload hashing deduplicates in-flight calls and rejects key reuse with mismatched payloads with **HTTP 409 Conflict**.
- **Privacy-Preserving Telemetry**: Hardened `assertRedacted()` telemetry records operational performance without ever storing raw prompt text, health notes, photos, or PII.
- **50-Case Evaluation Corpus & Automated Runner**: 22 synthetic meal profiles, 22 workout profiles (regression and held-out cohorts), and 6 adversarial boundary cases evaluated via `pnpm evals`.
- **Measured Benchmark Metrics**: **100.0%** final acceptance, **0** accepted hard violations, **100.0%** rubric pass rate (average **99.2/100**), **2 ms** P95 latency, and **$0.00021** estimated blended cost per generation.
- **Quality Gates Passing**: Strict TypeScript, Biome linter/formatter, workspace dependency boundaries, 59 Vitest unit/contract tests, and zero-secret client bundle scans passing.

*See the [Phase 4 Report](docs/PHASE_4_REPORT.md), [Evaluation Guide](docs/EVALUATION_GUIDE.md), and [Privacy Policy](PRIVACY.md).*

---

## Quick Start (Explore in 60 Seconds)

You can run the entire interactive demo locally with zero cloud dependencies or API keys:

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

## How to Look into the App

When you launch `http://127.0.0.1:5173`, you will see an instrument-grade dark UI. Here is how to explore its capabilities:

| Destination | What to Explore | What It Demonstrates |
| --- | --- | --- |
| **Persona Pills** (Header) | Click **Maya Lin (Cut)** or **Marcus Vance (Bulk)**, or click **Reset to pristine** | Instant state swap across all repositories; validates multi-persona fixtures and zero-bleed isolation. |
| **Today** | Review today's workout prompt, calorie gauge, and macro progress bars. Fill out the "Quick daily log" form at the bottom. | Real-time intake vs. target calculations; optimistic updates persisting across in-memory session. |
| **Measure** | Adjust demographic sliders, body weight, PAL activity level, and US Navy tape measurements. | Live Mifflin-St Jeor BMR, TDEE, macronutrient grams, and body-fat calculations with peer-reviewed literature citations. |
| **Plan** | Toggle between **Nutrition** (7-day schedules) and **Training** (multi-day splits). | Canonical plan schema rendering, meal timings, target macros, and structured progression sets/reps with provenance badges. |
| **Progress** | Inspect the 14-day weight trend bar chart, compliance KPI cards, raw daily log records, and completed workout sessions. | 14 days of realistic progression telemetry without gaps or synthetic anomalies. |
| **Foundation & Auth** | Test the typed tRPC health endpoint, Server-Sent Events (SSE) streaming cancellation, and optional local Supabase Auth panel. | The underlying Phase 1 & 2 transport layer and security infrastructure. |

---

## Codebase Tour

The repository is organized as a strict, clean pnpm monorepo:

```
kinetra/
├── apps/
│   ├── web/               # React 19 + Vite frontend (Tailwind/CSS tokens, TanStack Router/Query, Tab views)
│   └── api/               # Hono backend with tRPC routers, SSE streaming, AI pipeline, and idempotency store
├── packages/
│   ├── contracts/         # Canonical Zod schemas (Profile, Plans, Logs, Sessions, Coach streams, Repositories)
│   ├── domain/            # Pure sports science calculations, deterministic meal/workout verifiers, fallback templates
│   ├── db/                # Drizzle ORM schema models, migrations, and tenant isolation types
│   └── config/            # Shared ESLint/Biome, TS configs, and environment validation
├── evals/                 # Synthetic benchmark corpus (44 profiles + 6 adversarial cases), rubrics, and runner
├── docs/                  # Comprehensive engineering docs and audit trail
│   ├── ARCHITECTURE.md    # System architecture, data flow, security model, and decision records
│   ├── EVALUATION_GUIDE.md# Rubrics, scoring methodology, release gates, and cost economics
│   ├── PROJECT_PLAN.md    # Multi-phase master completion plan and progress tracking
│   ├── WORKFLOW.md        # Engineering guidelines, testing protocols, and CI/CD rules
│   ├── PHASE_1_REPORT.md  # Phase 1 verification evidence
│   ├── PHASE_2_REPORT.md  # Phase 2 auth & tenant isolation verification evidence
│   ├── PHASE_3_REPORT.md  # Phase 3 domain contracts & synthetic demo verification evidence
│   └── PHASE_4_REPORT.md  # Phase 4 verified AI pipeline & evaluation benchmark report
├── scripts/               # Boundary checking, security integration testing, auth seeding, and sanity checks
├── supabase/              # Local Supabase migrations, RLS policies, quota functions, and SQL seeds
├── tests/                 # Vitest test suites (ai-pipeline.test.ts, domain.test.ts, foundation.test.ts, security.test.ts)
└── PRIVACY.md             # Privacy policy, data handling guarantees, and launch gates
```

---

## What Is Going to Happen (The Roadmap)

Kinetra is built according to a strict 6-phase engineering lifecycle:

```mermaid
flowchart LR
    P1["Phase 1: Foundation\n(Completed)"] --> P2["Phase 2: Auth & Tenancy\n(Completed)"]
    P2 --> P3["Phase 3: Domain & Demo\n(Completed)"]
    P3 --> P4["Phase 4: Verified AI Pipeline\n(Completed)"]
    P4 --> P5["Phase 5: Core Instrument UI\n(Next)"]
    P5 --> P6["Phase 6: Offline & Launch\n(Upcoming)"]
```

### ✅ Phase 1: Monorepo Foundation & Toolchain (Complete)
- Strict TypeScript (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Biome, Vitest.
- Hono API with typed tRPC procedures and SSE cancellation transport.
- Security headers (strict CSP, HSTS, anti-clickjacking) and zero-secret client bundle scans.

### ✅ Phase 2: Security, Auth & Tenant Isolation (Complete)
- Local Supabase Postgres stack with Row-Level Security (RLS) on all tenant tables.
- Constrained SQL write functions, atomic rate-limiting, and quota reservations.
- 40 passing SQL integration and authorization tests (`test:security`).

### ✅ Phase 3: Domain Contracts & Early Synthetic Demo (Complete)
- Canonical Zod contracts for all core entities: Profiles, Plans, Telemetry, Sessions, and Coach events.
- Pure sports science calculation library with academic grounding.
- Standardized USDA nutrition and exercise catalog with fallback resolution.
- Two complete synthetic personas with 14 days of realistic logs and structured plans.
- 5-destination web demo with zero cloud credentials required.

### ✅ Phase 4: Deterministic Verification & AI Pipeline (Complete)
- **Primary Provider Adapter**: Pinned `gemini-2.5-flash` model, temperature `0.2`, seed `42`, structured Zod schema parsing.
- **Deterministic Verifiers**: Pure TypeScript mathematical engines enforcing calorie tolerances ($\pm 50\text{ kcal}$), macro tolerances, $4P+4C+9F$ math, allergen exclusions, equipment matching, rest periods ($\ge 60\text{s}$ compound), and volume ceilings ($\le 16$ sets/muscle group/day).
- **Bounded Recovery**: Initial attempt $\to$ max 1 semantic repair $\to$ deterministic fallback template with 0 hard violations on accepted plans.
- **Generation Idempotency**: SHA-256 payload hashing with HTTP 409 conflict detection for key reuse with mismatched payloads.
- **Redacted Observability**: Complete privacy isolation preventing storage of prompt text, notes, or health PII.
- **Automated Evaluations Harness**: 50 synthetic/adversarial profiles evaluated via `pnpm evals` with 100% acceptance, 0 hard violations, 100% rubric pass rate, P95 latency 2ms, and $0.00021/generation cost.

### ⏳ Phase 5: Core Instrument UI & Form Lab (Next Up)
- **Production Instrument Interface**: High-density mobile-first ergonomics, micro-interactions, dark/light theme tokens.
- **Active Workout Session Logger**: Rest timers, RPE/RIR tracking, and superset support.
- **On-Device Form Lab**: Real-time rep counting and joint-angle analysis using client-side MediaPipe/TensorFlow. **No camera video or photos are ever sent to a remote server.**

### ⏳ Phase 6: Offline Sync, Privacy Lifecycle & Launch Readiness (Upcoming)
- **Offline First**: Dexie IndexedDB local queue with conflict-free background synchronization.
- **Privacy & Lifecycle Controls**: One-click GDPR/CCPA data export, cryptographic account purge, and quota monitoring.
- **Launch Gates Certification**: Performance audits (LCP < 1.2s, INP < 100ms), security penetration testing, and production deployment.

---

## Verification & Quality Commands

Every change to the repository must pass our non-mutating quality check:

```sh
# Run full static analysis, boundary check, typecheck, 59 tests, and build checks
pnpm check

# Run unit, contract, and AI pipeline tests in Vitest
pnpm test

# Run the 50-case AI pipeline evaluation benchmark harness
pnpm evals

# Run API smoke tests (requires API running on port 3001)
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

## Key Documentation

- [design/README.md](design/README.md) - Complete monochrome web and future Android design atlas: 54 screens in light and dark themes, with editable mockups, PNGs, diagrams, and implementation guidance.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System topology, data models, state machine, and design patterns.
- [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) - Step-by-step deliverable checklist for all 6 phases.
- [docs/EVALUATION_GUIDE.md](docs/EVALUATION_GUIDE.md) - Benchmark rubric dimensions, release gate thresholds, and LLM cost models.
- [docs/PHASE_4_REPORT.md](docs/PHASE_4_REPORT.md) - Full evidence and verification report for the Phase 4 verified AI pipeline.
- [docs/PHASE_3_REPORT.md](docs/PHASE_3_REPORT.md) - Evidence and verification report for the Phase 3 domain build.
- [docs/WORKFLOW.md](docs/WORKFLOW.md) - Git conventions, testing requirements, and coding standards.
- [PRIVACY.md](PRIVACY.md) - Data minimization guarantees and privacy policy.

