# Kinetra

Kinetra is a planned fitness web app that combines personal planning, daily tracking, offline logging, and measurable AI reliability. Its central goal is to turn user context into useful meal and workout plans, verify those plans before displaying them, and adapt recommendations using recorded progress.

**Project status: planning and documentation.** This checkout contains the project reviews and the documentation below. It does not yet contain an application, dependency manifest, database migrations, automated tests, or deployment configuration. Features and stack choices described here are proposed until implementation and validation evidence are added.

## Start here

| Document | What it answers |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | What are the components, data models, boundaries, and technical decisions? |
| [Workflow](docs/WORKFLOW.md) | How do we develop, test, review, deploy, and maintain the project? |
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
| Data and identity | Supabase Postgres, Auth, private Storage; Drizzle migrations |
| Offline | IndexedDB through Dexie; versioned service worker using Workbox |
| AI | Server-only provider adapters; Gemini as the first candidate, other adapters after capability and evaluation checks |
| Verification | Pure TypeScript domain rules, Vitest, component tests, a small Playwright suite, and AI evaluations |
| Repository | pnpm workspaces; a single chosen formatter/linter and GitHub Actions |

Versions, model identifiers, SDK compatibility, hosting limits, and pricing must be verified and pinned during implementation. No free-tier or monthly-cost guarantee is made here.

## Local setup

There is no runnable development setup yet. Do not expect `pnpm install` or `pnpm dev` to work until Phase 1 creates the workspace.

After the scaffold is implemented, the intended onboarding is:

1. Install the runtime and pnpm versions pinned by the repository.
2. Install dependencies using the committed lockfile.
3. Copy each application's documented environment example to its local environment file.
4. Start local database/auth services and apply migrations plus synthetic seed data.
5. Run the web and API development services.
6. Run formatting, lint, type checks, unit/contract tests, and the production build.

Phase 1 must replace this section with exact, tested commands and troubleshooting instructions. Secrets belong in local ignored files or the hosting secret store. Provider keys and privileged database credentials must never appear in browser assets.

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
