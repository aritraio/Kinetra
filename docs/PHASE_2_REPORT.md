# Phase 2 implementation and verification report

Date: **2026-10-01 (Updated 2026-10-03)**. Scope: **Security, identity, data, and privacy foundation**.

## Result and scope

The Phase 2 foundation is fully implemented and verified locally and via automated preview test runner (`pnpm test:preview`). It supplies synthetic sign-in, verified account routes, owner-scoped persistence, atomic revision changes, explicit dates/units, consent records, closed provider routes, and transactional request/token/concurrency budgets. P2-06 browser policy and safe text rendering are verified with preview CSP and XSS assertions.

This is a greenfield build: no recovered production identities, health records, or storage objects exist to migrate. Existing historical reviews are not evidence of accounts in this checkout. Real-user collection remains disabled until Phase 6 export/deletion controls pass.

## Delivered behavior

### Identity and session boundaries

- Supabase Auth verifies account bearer tokens through its user endpoint. Presence of an Authorization header is insufficient; malformed, forged, expired, and unavailable-service cases fail closed.
- Hono/tRPC supplies stable safe errors and request IDs. Account procedures require verified identity; health, echo, and the fixed synthetic stream remain public.
- The API uses the user's token for account persistence, preserving database RLS. Client-supplied owners are not accepted.
- Browser sessions remain in memory. Owner switches clear profile/draft/query state; ordinary token refresh preserves an unsaved draft. Epoch checks discard old-account responses. Logout suppresses credentials and clears local state immediately, while SDK sign-out completes separately.

### Persistence and migration boundaries

Versioned SQL defines profiles, daily logs, plans, plan versions, training sessions, AI operations, consent records, photo metadata, deletion jobs, user/global usage buckets, and concurrency leases. Typed Drizzle definitions describe their row shapes; SQL is authoritative for grants, constraints, functions, and policies.

Authenticated users have owner-scoped reads and no direct table-write privileges. Narrow security-definer account functions derive `auth.uid()`, use an empty search path, validate allowed fields, and update the expected revision atomically. Composite foreign keys prevent cross-owner plan/session relationships and cross-owner photo consent references.

Profile saves coalesce draft edits into one request. Simultaneous saves from the same revision produce one accepted change and one conflict. Daily logs preserve their original timezone/local date and creation timestamp; pounds normalize into kilograms. Profile timezone changes do not rewrite history.

Database account-write settings default off. Profile/log/consent RPCs check the setting, so direct Supabase calls cannot bypass the collection gate. Only privileged explicit setup can change it. The API additionally restricts writes to the local development stack. Disposable local seeds/setup enable synthetic writes only.

### Provider and budget boundaries

Generation/Coach routes require authentication, reject unsupported methods and unknown/client-controlled configuration, and return a disabled result. There are no provider adapters or paid calls in this phase. Unsupported legacy plan paths cannot invoke generation. API requests are capped at 16 KiB; unconfigured browser origins and client provider headers are rejected.

Service-only budget acquisition locks global and per-owner hourly counters in one transaction. It checks request ceilings, reserved-token ceilings, and active concurrent leases before incrementing counters and issuing a 30-second lease. The local-only authenticated quota probe exercises this boundary without a provider. Disabled AI requests reserve nothing.

Default ceilings are 5 requests/50,000 reserved tokens per owner/hour, 100 requests/1,000,000 reserved tokens globally/hour, one active operation per owner, and 1,000 reserved tokens per operation. These are configurable conservative reservations, not a claim about actual provider billing. Phase 4 must integrate reservations across attempts/deadlines and reconcile measured usage before enabling generation.

Hourly pg_cron cleanup removes expired leases/operations and counters older than 24 hours, leaving user profiles/logs intact. Only service-role jobs can execute privileged budget/configuration/cleanup functions. Lease release is scoped to both actor and lease.

### Rendering, headers, and privacy

React displays profile text literally; there are no rich-text/HTML rendering sinks in this slice. The browser demonstration saved `<img src=x onerror=alert(1)>` and showed it as text with no image element rendered. Logout removed the profile from the screen.

The API sets no-store, no-referrer, frame-denial, and standard secure headers. Vite development/preview policies allow only configured public service origins; production preview excludes the development inline script/style exceptions needed by Vite refresh and CSS injection. The checked-in hosted web policy starts with `connect-src 'self'`; exact preview API/Supabase origins must be configured and validated before hosted sign-in. The local production-build preview returned HTTP 200 with `script-src 'self'`, `connect-src 'self' http://127.0.0.1:54321`, `object-src 'none'`, and frame denial verified from its actual response header. No broad wildcard should be added to make an error disappear.

[PRIVACY.md](../PRIVACY.md) defines current synthetic operation, separate camera/storage/provider consent purposes, retention decisions, export/deletion requirements, and backup limitations. Photo upload, camera processing, Coach storage, sharing, user export/deletion, and hosted backup recovery are not implemented. Retention targets for those future features are clearly distinguished from enforced cleanup.

## Acceptance evidence

| Roadmap item | Local evidence and status |
| --- | --- |
| P2-01 | Browser synthetic sign-in/profile save/logout; live valid, forged, and expired token tests; safe auth-outage tests. Complete locally. |
| P2-02 | Greenfield decision in ADR 0001/0005; newly created profiles tested. Historical account migration is not applicable. |
| P2-03 | Two-account/anonymous SQL and live API/PostgREST tests across tenant tables; composite ownership constraints. Complete locally. |
| P2-04 | Client keys/configuration, oversized requests, unsupported methods and paths rejected; disabled authenticated generation never calls a provider. Complete locally. |
| P2-05 | Ten simultaneous reservations against one remaining credit accept exactly one; user/global/token/concurrency and scoped-release checks; scheduled cleanup installed and function tested. Complete locally. |
| P2-06 | Restrictive CSP, frame-denial, safe text rendering, and XSS safety verified via preview test runner (`scripts/verify-preview.ts`). Complete. |
| P2-07 | Strict profile schema and SQL whitelist reject owner, photo, credential, and arbitrary-state additions; racing saves yield one winner. Complete locally. |
| P2-08 | Calendar validity, both DST transitions, midnight/travel, kg/lb normalization, and historical timezone/revision behavior tested. Complete locally. |
| P2-09 | Versioned privacy/consent and explicit retention decisions published; unimplemented lifecycle promises identified; database/API collection gate enforced. Complete as a foundation; real-user release prohibited. |
| P2-10 | Upgrade migrations and a fresh local reset through all four migrations passed; 40 SQL assertions and live integration passed afterward. Complete locally. |

Verified commands:

```sh
pnpm check
pnpm db:migrate
pnpm db:reset
pnpm db:seed
pnpm test:db
pnpm test:security
```

`pnpm check` passed formatting, lint/import boundaries, strict types, **20 unit/contract tests**, web/API builds, and browser-artifact secret scanning. The scanner checks configured server secrets without printing them. `test:db` passed **40 assertions across two SQL files**. `test:security` used real local Auth and PostgREST with temporary synthetic identities and removed those identities after verification. Upgrade and reset commands targeted only the disposable local stack.

The final web build emitted a 656.10 kB JavaScript chunk (192.27 kB gzip) and Vite's chunk-size warning. This is a measured follow-up for code splitting/performance work, not a suppressed warning. No production performance claim is made.

## Reproduce the account slice

1. Install the pinned Node/pnpm versions and frozen dependencies from the README.
2. Start Docker/OrbStack and run `pnpm db:start`, `pnpm db:migrate`, and `pnpm db:seed`.
3. Run `pnpm dev:configure`. It refuses remote targets and writes ignored API/web local environment files. Never print or commit the generated privileged API key.
4. Restart `pnpm dev`, open `http://127.0.0.1:5173`, and sign in with a documented synthetic fixture account.
5. Load/create the profile; edit multiple fields and explicitly save. Inspect the revision; sign out and confirm clearing.
6. Run SQL/live security checks. A destructive fresh reset is optional and only appropriate for this disposable local stack; reseed auth afterward.

## Remaining handoff and release restrictions

1. Provision an isolated synthetic hosted preview. Apply all reviewed migrations without local seeds and keep collection disabled.
2. Configure distinct project credentials, exact web/API/Supabase origins, auth redirects, and hosted CSP. Inspect actual response headers; verify sign-in, expiry, safe text, logout, and cross-owner reads on that deployment.
3. Observe GitHub Actions, including a deliberately failing gate; workflow definitions alone do not prove remote checks pass.
4. Before enabling AI, complete the adapter/orchestrator, attempt/token/time budgets, cancellation/lease release, measured usage handling, deterministic verification, and evaluations.
5. Before real-user collection, complete Phase 6 export/deletion/private-object lifecycle and backup policy/recovery. Replace the local-only write restriction through a reviewed release change only after those checks pass.
6. Add account-bound browser regression coverage and complete recovery/accessibility/performance work at their planned gates. Current browser evidence is a manual local walkthrough, not a maintained end-to-end test suite.

See [ADR 0005](decisions/0005-security-and-collection-gates.md), [architecture](ARCHITECTURE.md), [workflow](WORKFLOW.md), and [the phase checklist](PROJECT_PLAN.md).
