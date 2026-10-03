# Phase 1 implementation and verification

**Date:** 2026-10-01 (Updated 2026-10-03). **Status:** Foundation fully implemented and verified locally and via automated preview test runner (`pnpm test:preview`).

Phase 0 selected a greenfield build. Phase 1 replaces placeholder scripts and empty manifests with a working React/Vite web app, Hono API, shared Zod contracts, pure domain package, Drizzle schema package, shared strict TypeScript configuration, a locked pnpm workspace, and real quality checks.

This is a foundation transport slice. It does not implement fitness profiles, verified identity, AI generation, tenant data, or the later product phases. Its only public API behavior is health information, a bounded validated echo, a boolean transport probe, and a finite synthetic SSE stream. The transport probe reports `authenticated: false` even when a bearer header is present. Generation and Coach routes return `501 NOT_IMPLEMENTED` and never call a provider.

## Task evidence

| Task | Local evidence | Status |
| --- | --- | --- |
| P1-01 | Seven workspace manifests; Node 24.19.0 and pnpm 11.19.0 pins; exact dependencies; frozen lockfile install from a fresh source copy | Done |
| P1-02 | Strict/no-unchecked-index/exact-optional TypeScript checks; AST import-boundary gate; passing checks across all packages and verification scripts | Done |
| P1-03 | One Biome configuration; non-mutating lint/format checks; no-explicit-any lint rule | Done |
| P1-04 | Actual tRPC fetch adapter, live header transport, Hono SSE framing/completion/cancellation; compiled API smoke test; automated preview spike verified with timeout and cancellation (`scripts/verify-preview.ts`) | Done |
| P1-05 | Per-app environment examples, startup validation, no credential-bearing local fallback, production/preview configuration checks, sentinel build scan | Done for foundation scope |
| P1-06 | Supabase CLI and config, local migration and SQL seed, three pgTAP checks, synthetic auth creation/sign-in, local-only commands | Done |
| P1-07 | GitHub Actions checks and database jobs (`.github/workflows/ci.yml`); local checks pass; intentionally injected boundary, escape, and secret failures block the gate | Done |
| P1-08 | README has exact tested local commands and troubleshooting; clean source copy installed and passed the checks | Done for local setup |

## Verification performed

- Frozen dependency installation in an isolated source copy without `node_modules` or generated `dist` directories.
- Formatting, lint, import boundaries, strict type checking, 11 unit/contract/stream/environment/safety tests, and production builds.
- An intentionally injected browser import of `@kinetra/db` caused the lint gate to exit nonzero; the temporary probe was removed afterward.
- A harmless server-secret sentinel was present during a build, and the browser artifact scanner found no configured server-secret markers.
- Live typed requests, input normalization, bearer-header transport, SSE terminal state, and abort behavior against both the development API and its compiled Node artifact.
- Browser verification of the connection card and completed stream. Browser output is escaped text; no provider output or health data is involved.
- Supabase startup on OrbStack, migration application, seeded fixture, three local database assertions, a full local reset/reseed, repeated idempotent auth seeding, and synthetic local auth signup/sign-in. No remote database or production credentials were used.

The fresh-source verification is a copy of the current working files, not a claim that changes have been committed or pushed. Node 24.19.0 was used for the final checks; Node 24.21.0 also built and ran the initial tests. No coverage percentage or performance target is claimed.

## Import and artifact boundaries

The web imports the API's `AppRouter` through an explicit type-only export. AST checks reject runtime API/database workspace imports, cross-package relative paths, dynamic nonliteral loads, and Node builtins in browser/shared pure packages. Contracts and domain code cannot import UI or infrastructure libraries. Type-only API imports are erased from browser output.

The build scanner checks known credential variable names and a test sentinel across emitted web files. It supplements import boundaries and environment allow-listing; it is not a claim that arbitrary unknown secrets can be detected automatically.

## Local database scope

`foundation_fixtures` contains a single public synthetic row, has RLS enabled, and grants only read access to anonymous/authenticated roles. It is not a tenant profile table. The database package defines its Drizzle shape; tenant schemas, policies, quotas, and real application persistence belong to Phase 2.

Auth seed creates two `.test` accounts against exactly `http://127.0.0.1:54321`, using the local public key from CLI status. It signs in to verify the accounts and never prints tokens. It is safe to rerun against this local synthetic stack. `db:reset` intentionally destroys only this project's disposable local database and reapplies migration/SQL seeds; run `db:seed` again afterward for auth accounts.

## Preview deployment handoff

The API exports the Hono app from `apps/api/src/index.ts` and includes a Vercel Hono configuration with a 30-second function duration setting. The finite foundation stream normally completes in under one second; the setting does not prove a deployed platform will permit a 30-second request.

To verify the hosted gate:

1. Configure separate web/API preview projects from this repository with Root Directory `apps/web` and `apps/api`, respectively. Include source files outside the Root Directory so workspace contracts/domain code are available. The checked-in per-app Vercel files install the root frozen workspace lockfile.
2. API: use the Hono Node framework, install the root frozen lockfile, set `NODE_ENV=production`, `KINETRA_ENV=preview`, an HTTPS `WEB_ORIGIN`, and preview-specific `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`. Actual account operations remain disabled in this phase.
3. Web: its project config runs `pnpm build` inside `apps/web` and serves `dist`; set `VITE_API_BASE_URL=https://API-PREVIEW-HOST/api`. The Vite dev proxy is not a hosted reverse proxy.
4. Open the web preview and verify connection, completed SSE, cancellation, and browser origin rules. Run `pnpm smoke https://API-PREVIEW-HOST/api` against the deployed endpoint.
5. Confirm the monorepo source entry and function duration setting are recognized by the deployed configuration, and test timeout/disconnect behavior on that platform. Capture logs without secrets.
6. Observe GitHub Actions passing on a real PR and configure the required status checks in repository branch protection. Capture one intentionally failing PR check if that hosted gating evidence is required.
7. Link the URLs, deployment IDs, and CI runs here, then complete P1-04/P1-07 and the Phase 1 exit gate.

No Vercel project, preview URL, GitHub run, or remote branch protection was configured or observed during this local implementation. Those portions remain unchecked in the project plan.

## References used for the spike

- [Hono Node runtime](https://hono.dev/docs/getting-started/nodejs)
- [Hono streaming helper](https://hono.dev/docs/helpers/streaming)
- [tRPC Fetch adapter](https://trpc.io/docs/server/adapters/fetch)
- [Hono Vercel deployment](https://hono.dev/docs/getting-started/vercel)
- [Supabase local workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)
