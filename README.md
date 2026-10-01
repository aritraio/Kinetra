# Kinetra

Kinetra is a planned fitness web app that combines personal planning, daily tracking, offline logging, and measurable AI reliability. Its central goal is to turn user context into useful meal and workout plans, verify those plans before displaying them, and adapt recommendations using recorded progress.

**Project status: Phase 2 security foundation implemented locally.** The typed web/API workspace now includes synthetic sign-in, verified account access, owner-scoped tables and RLS, revision-protected profile/log writes, consent records, and atomic budget reservations. AI, photos, and real-user collection remain disabled. Hosted preview verification and observed GitHub Actions evidence are pending. See the [Phase 2 evidence report](docs/PHASE_2_REPORT.md) and [privacy policy](PRIVACY.md).

## Start here

| Document | What it answers |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | What are the components, data models, boundaries, and technical decisions? |
| [Workflow](docs/WORKFLOW.md) | How do we develop, test, review, deploy, and maintain the project? |
| [Privacy](PRIVACY.md) | What is collected locally, what remains disabled, and which lifecycle gates block launch? |
| [Completion plan](docs/PROJECT_PLAN.md) | What do we build, in what order, and what proves each phase is finished? |

The three original reviews are retained as inputs: [feature and quality audit](ideas.improve.md), [stack and design blueprint](improve.md), and [recommendations](recomenation-for-imporvemt.md). They describe a prior FitnessBaba implementation and suggest other names, including Metria. **Kinetra** is the name used in this repository. Historical file paths, vulnerability findings, coverage numbers, provider prices, and performance claims in those reviews have not been verified against application code in this checkout.

When the reviews disagree, use the completion plan for sequencing and the architecture document for the proposed technical baseline. Record later changes as architecture decisions instead of silently editing the historical reviews.

## Product direction

Kinetra should help a user answer three practical questions:

1. What should I do today to work toward my goal?
2. What does my recorded progress show?
3. Why should I trust this generated recommendation?

The proposed navigation has six destinations: **Today, Measure, Plan, Coach, Form Lab, and Progress**. Onboarding gathers only the information required for the next useful action, with optional details collected later.

### Initial usable release

- Account access and a validated fitness profile with explicit units and timezone.
- Explainable calculations with documented assumptions and configurable target policies.
- Meal and workout generation with shared schemas, deterministic verification, and bounded recovery.
- A Today dashboard, daily logs, history, and versioned private plans.
- Offline reading and queued log writes with visible sync state.
- Two synthetic demo personas that work without an account or paid AI requests.
- Data export, deletion, accessible controls, and tested tenant isolation.

### Full v1 additions

- Coach responses streamed with clear cancellation and error handling.
- Voice-assisted logging that requires user confirmation before saving.
- Local camera-based Form Lab for a supported exercise, with landmark overlays, rep detection, and documented limits.
- Explainable adaptive progression based on sufficient recorded training history.
- Tested photo retention controls, optional progress photos, revocable plan sharing, and the instrument-inspired visual system.
- Published evaluation results, critical end-to-end checks, monitoring, and a reproducible release process.

These are goals, not implemented capabilities. [The phase checklist](docs/PROJECT_PLAN.md) tracks delivery and defines the distinction between the initial release and full v1.

## Proposed technical baseline

| Area | Proposed choice |
| --- | --- |
| Web client | React, strict TypeScript, Vite, TanStack Router and Query |
| Forms and contracts | React Hook Form, Zod; validation on the server and client |
| Styling | Tailwind CSS with custom accessible design tokens |
| API | Hono on a Vercel Node serverless runtime; typed tRPC procedures and a separate SSE transport |
| Data and identity | Supabase Postgres and Auth; SQL migrations with typed Drizzle row models; private Storage planned |
| Offline | IndexedDB through Dexie; versioned service worker using Workbox |
| AI | Server-only provider adapters; Gemini as the first candidate, other adapters after capability and evaluation checks |
| Verification | Pure TypeScript domain rules, Vitest, component tests, a small Playwright suite, and AI evaluations |
| Repository | pnpm workspaces; a single chosen formatter/linter and GitHub Actions |

Versions, model identifiers, SDK compatibility, hosting limits, and pricing must be verified and pinned during implementation. No free-tier or monthly-cost guarantee is made here.

## Local setup

Use Node **24.19.0** (pinned in `.node-version`/`.nvmrc`; newer Node 24 patch releases are supported) and pnpm **11.19.0**. If needed, install the pinned package manager with `npm install --global pnpm@11.19.0`.

From the repository root:

```sh
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Open [the local app](http://127.0.0.1:5173). The API runs at `http://127.0.0.1:3001`; Vite proxies `/api` to it. The connection card exercises a typed request, and **Start stream** exercises a finite synthetic SSE response. **Cancel** aborts it. The transport slice requires no cloud account, provider key, or database service. Account sign-in is optional and requires the local setup below. Enter synthetic data only. Stop the development services with Ctrl+C.

### Checks and builds

```sh
pnpm check
pnpm smoke
```

`pnpm check` runs non-mutating format checks, lint/import boundaries, strict types, 20 tests, both builds, and a browser artifact scan. `pnpm smoke` requires the development API to be running and checks real HTTP transport and stream cancellation. The underlying commands are `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; `pnpm format` rewrites formatting.

To run the built artifacts, use two terminals after `pnpm build`:

```sh
pnpm --filter @kinetra/api start
```

```sh
pnpm --filter @kinetra/web preview
```

Open [the built web preview](http://127.0.0.1:4173). The preview proxy expects the API on port 3001. For account mutations in this preview, restart the API with `WEB_ORIGIN=http://127.0.0.1:4173`; restore port 5173 as the web origin when returning to development. This is a local build preview, not evidence of hosted deployment.

### Local database and auth

Start Docker Desktop or OrbStack and confirm `docker version` can reach the server. The pinned Supabase CLI is installed with workspace dependencies.

```sh
pnpm db:start
pnpm db:migrate
pnpm db:seed
pnpm dev:configure
pnpm test:db
pnpm test:security
```

The first start downloads the official local-service images. API/auth is on `http://127.0.0.1:54321`, Postgres on port 54322, Studio on port 54323, and the local mail viewer on port 54324. Migrations create tenant tables, RLS, constrained write functions, quota reservations, and hourly cleanup. SQL seeding enables local synthetic writes and creates one public synthetic fixture; `db:seed` creates and verifies sign-in for `foundation-cut@example.test` and `foundation-bulk@example.test` with the disposable local password `Local-synthetic-only-2026!`. Never reuse these credentials outside local development. Restart `pnpm dev` after configuration, sign in, and use **Load profile** or save a synthetic profile. `dev:configure` writes ignored local environment files, placing only the public Supabase key in web config; the privileged service key stays in API config. It refuses remote targets and enables only the disposable local database write gate.

`pnpm db:status` shows local connection details. `pnpm db:stop` stops this project's services. **`pnpm db:reset` destroys this project's disposable local database**, reapplies migrations and SQL seeds, and requires `pnpm db:seed` afterward to recreate auth fixtures. `test:db` runs 40 SQL assertions. `test:security` creates temporary synthetic accounts and checks real Auth/PostgREST isolation, conflicts, expiry, and concurrent budgets, then removes those accounts. All migration/reset scripts explicitly target local services; none requires linking a remote project.

### Environment and troubleshooting

- Local defaults work even without copied environment files. The optional API file uses `NODE_ENV=development`, `KINETRA_ENV=development`, `PORT=3001`, and `WEB_ORIGIN=http://127.0.0.1:5173`. Web config uses `VITE_API_BASE_URL=/api`.
- For separate hosted previews, use an HTTPS web origin, `KINETRA_ENV=preview`, preview-specific Supabase configuration, and a web API URL ending in `/api`. See [the preview checklist](docs/PHASE_1_REPORT.md#preview-deployment-handoff). Development mode is rejected when the Node runtime is production.
- If the connection card fails, confirm both services are running. If port 5173 is occupied, stop the other process; Vite intentionally refuses to choose a hidden alternate port. If changing the API port, also update the Vite proxy.
- If Docker is missing from PATH on an OrbStack Mac, make its Docker CLI available before starting Supabase. For the standard install, `export PATH="/Applications/OrbStack.app/Contents/MacOS/xbin:$PATH"` works. Start OrbStack first.
- If Supabase cannot start, check that Docker is running and ports 54320–54324 are available. Fresh startup can take several minutes while downloading images.
- If frozen installation fails, check Node/pnpm versions and registry access. Update dependency manifests and the lockfile together; CI must never silently rewrite the lockfile.

Hosted migrations leave account writes disabled. Do not enable real-user collection until Phase 6 lifecycle controls pass. Configure exact API/Supabase origins in hosted CSP and verify sign-in in the deployed preview; the checked-in web hosting policy starts with `connect-src 'self'`.

Secrets belong in ignored local environment files or hosting secret stores. Only explicitly public `VITE_` values may be used in browser code; provider keys and privileged database credentials must never appear in browser assets.

## Reliability and privacy principles

- Schema validation checks shape; deterministic verification checks product constraints. Both are required before a generated plan is accepted.
- Generated text remains untrusted even after schema validation. Render it as text; sanitize any explicitly supported rich content.
- Authentication, authorization, atomic quotas, and request limits protect every account-bound AI and data endpoint.
- Health calculations and form scores are estimates with stated limitations. The app must not claim diagnosis or body-fat measurement from a photo.
- Camera analysis runs locally by default. Stored photos require separate consent and private access.
- Demo data is synthetic and isolated from real accounts. Logs and telemetry exclude raw photos, secrets, and private conversation content.

## Contributing and completion

Use [the workflow](docs/WORKFLOW.md) for changes and [the project plan](docs/PROJECT_PLAN.md) for task selection. A task is complete only when its acceptance checks pass and evidence is recorded; an unchecked item remains outstanding.

A license has not been selected. Choose one deliberately before public distribution. A live URL, screenshots, measured coverage, and evaluation scores should be added only after they exist and can be reproduced.
