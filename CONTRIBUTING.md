# Contributing to Kinetra

Thank you for contributing to Kinetra. This guide outlines architectural invariants, code quality standards, local workflow, and the validation commands required before opening pull requests.

---

## 1. Architectural Boundaries & Monorepo Structure

Kinetra enforces strict architectural isolation via `scripts/check-boundaries.ts` (executed during `pnpm lint`). Violating package boundaries will fail CI immediately.

```
├── packages/
│   ├── contracts/   # Pure TypeScript & Zod schemas. Zero dependencies outside Zod.
│   │                # Shared across server and browser.
│   ├── domain/      # Pure domain logic (kinematics, progression, planning, voice, coach).
│   │                # Imports only @kinetra/contracts. ZERO Node.js builtins (e.g. node:crypto),
│   │                # ZERO database or HTTP network dependencies. Runs in both Node & Browser.
│   └── db/          # PostgreSQL migrations, SQL functions, pg_cron jobs, and Supabase config.
└── apps/
    ├── api/         # Node.js backend (Hono, AI provider adapters, circuit breaker, telemetry).
    │                # Imports contracts, domain, and db. Never imported by web.
    └── web/         # React SPA (Vite, IndexedDB offline engine, WebRTC camera, UI components).
                     # Imports contracts and domain. Erased tRPC/router types only from API.
```

### Import Rules
1. **`packages/contracts`**: Must not import anything except `zod`.
2. **`packages/domain`**: Must not import Node.js builtins (like `node:crypto`). Use web-standard `globalThis.crypto` for random tokens and UUIDs so it executes identically in browser and Node runtimes.
3. **`apps/web`**: Never import server runtime code or server environment variables. All secrets belong exclusively in `apps/api`.
4. **No Tailwind / External Component Libraries**: UI uses pure vanilla CSS with design tokens defined in `apps/web/src/styles.css`.

---

## 2. Local Development Setup

### Prerequisites
- **Node.js**: `>= 24.19.0 < 25`
- **pnpm**: `11.19.0`
- **Docker**: (Optional, required only for local Supabase database CLI)

### Quick Start
```bash
# 1. Install workspace dependencies
pnpm install

# 2. Configure local development environment
pnpm dev:configure

# 3. Start local development servers (Vite + Hono API concurrently)
pnpm dev
```
Web client runs on `http://127.0.0.1:5173`. API server runs on `http://127.0.0.1:3001`.

---

## 3. Strict Quality & Verification Pipeline

Before committing or submitting a pull request, run the unified verification suite:

```bash
# Full verification (Format check, Lint + Boundaries, Typecheck, Unit Tests, Build + Secret scan)
pnpm check

# Machine learning and deterministic domain evaluation benchmarks
pnpm evals
```

### Individual Check Commands
- `pnpm format:check` — Check code style with Biome.
- `pnpm format` — Auto-format code with Biome.
- `pnpm lint` — Run Biome linter and `scripts/check-boundaries.ts`.
- `pnpm typecheck` — Run TypeScript compiler across all packages and root test suite.
- `pnpm test` — Run all 19 Vitest test suites (168+ tests).
- `pnpm build` — Build packages, bundle backend with esbuild, build client with Vite, and run `scripts/scan-web.ts` to verify zero secret markers leaked into web assets.
- `pnpm evals` — Run the 44-profile benchmark evaluation runner for plan generation and progression models.

---

## 4. Engineering Principles & Invariants

1. **Deterministic Verification First**: Every AI output (workout plans, coaching suggestions, progression adjustments) must pass domain validation rules before reaching user state. Unverified AI outputs are never stored.
2. **Strict Privacy by Design**:
   - Zero biometric or raw camera frames sent off-device. All posture estimation runs locally in the browser via TF.js/MediaPipe.
   - Progress photos are strictly optional, isolated in private storage, and auto-expire in 30 days.
   - Plan sharing exports only sanitized exercise names, sets, reps, and target loads with expiring, revocable tokens. No profile, body weight, photos, or conversation history are ever included.
3. **Offline-First Resilience**: Mutations are recorded to local IndexedDB outbox atomically before synchronization. The app must remain functional when disconnected.
4. **TypeScript Strictness**: `exactOptionalPropertyTypes: true` is enabled across the workspace. When working with optional properties, use conditional object spread `...(val ? { val } : {})` rather than assigning `undefined`.
5. **No PII in Telemetry**: Operational metrics and logs must strictly sanitize user identifiers and health details.
