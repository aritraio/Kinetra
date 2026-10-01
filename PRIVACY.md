# Kinetra privacy and data lifecycle

Policy version: **2026-10-01**. Current scope: **local development with synthetic records only**.

This document describes implemented behavior separately from release requirements. Kinetra is not open to real users. Do not enter real health information, photographs, or private conversations into the development app. Production collection must remain disabled until export, deletion, storage cleanup, and recovery gates in Phase 6 pass and this policy is reviewed against the actual hosting configuration.

## Current collection and processing

Local Supabase Auth stores synthetic account identifiers, email addresses, and password authentication records. The browser keeps its session in memory; it does not persist the auth session to localStorage. Reloading requires sign-in. Supabase session refresh operates while signed in. Signing out immediately suppresses outgoing credentials, clears the displayed profile and query cache, and attempts local SDK sign-out even if the auth service is unavailable.

The profile contains only display name, height in centimetres, weight in kilograms, goal, IANA timezone, and unit preference, with ownership, revision, timestamps, and policy version added by trusted code. Daily logs contain explicit local date and timezone, normalized weight, ownership, revision, and UTC timestamps. Past log dates and their timezone are preserved when a profile timezone changes. Unknown fields, credentials, image bytes, and arbitrary UI state are rejected.

There are also foundational tables for plans, versions, training sessions, AI operations, consent, photo metadata, deletion jobs, and usage budgets. Their presence does not mean their product workflows are available. Authenticated users can read their own records under row-level security; account changes use narrowly scoped database functions. Other users and anonymous callers cannot read account records. Administrative service credentials can bypass RLS and must stay server-side and restricted to explicit setup, budget, cleanup, and test operations.

The app has no photo upload, camera processing, Coach conversation storage, sharing, paid generation, or application analytics integration. Meal/workout and Coach endpoints remain disabled after authentication and input checks. No provider receives profile data from this implementation. Synthetic stream text is generated locally. Development/server infrastructure may emit request paths and operational errors; do not include sensitive data in URLs, add raw payload logging, or connect a telemetry service without reviewing its retention and redaction.

## Collection gate

Migrations default the database account-write flag to **off**. Profile, log, and consent functions check this flag, including direct calls outside the application API. Ordinary users cannot enable it. The API separately permits account writes only in development against the exact local Supabase host. Disposable local SQL seeding and `pnpm dev:configure` enable local writes; never run those seeds on a hosted project.

A future production rollout must replace this temporary development restriction with a reviewed release gate only after Phase 6 passes. Having a service-role key or an authenticated user is insufficient authorization to open real-user collection.

## Consent boundaries

Consent records are append-only and bind a verified owner, purpose, grant/withdraw action, timestamp, and policy version. The three distinct purposes are:

| Purpose | Required disclosure before the future feature can operate |
| --- | --- |
| `camera_local` | Camera permission, local processing, supported conditions, and stopping capture on exit |
| `photo_storage` | Optional private upload, access rules, storage period, deletion, and backup limitations |
| `provider_processing` | Which provider receives which fields, processing purpose, provider retention, and alternatives |

A grant for one purpose is not a grant for another. Browser camera permission is not consent to upload. A recorded grant currently enables no feature. Later features must enforce the latest applicable grant, handle withdrawal, and show the versioned disclosure before accepting consent. No consent workflow is presented as implemented in the current UI.

## Retention decisions and implementation status

These periods are explicit engineering targets for release, not promises that unimplemented workflows already fulfill.

| Data class | Release retention decision | Current enforcement |
| --- | --- | --- |
| Account/profile, logs, private plans, training history | Until the owner deletes the record or account | Synthetic local records persist until explicit local removal/reset; auth-user deletion cascades owned rows |
| Optional uploaded progress photos | Maximum 30 days after upload; earlier on owner deletion or withdrawal | No uploads or storage buckets enabled; metadata has an expiry field; object lifecycle and deletion worker are Phase 6 work |
| Coach conversation content | Maximum 14 days; owner can delete sooner | No conversations stored; lifecycle remains to be implemented |
| AI operation records | Maximum 24 hours after terminal completion unless a shorter expiry applies | Cleanup removes rows whose explicit expiry has passed; future creation paths must set and enforce the terminal expiry |
| Hourly request/token counters | 24 hours plus up to one hourly cleanup interval | Hourly database job deletes buckets older than 24 hours |
| Active AI budget leases | 30 seconds; expired rows removed on hourly cleanup | Expired leases cease counting immediately; cleanup removes expired rows |
| Redacted operational metrics | Maximum 30 days | No application metrics store; future vendor configuration and log retention require verification |
| Consent evidence and deletion-job status | Until account deletion; retain only minimal evidence if a documented obligation requires it | Owned rows cascade with account deletion; no additional post-deletion archive |
| Hosted backups | Maximum 30 days proposed; exact availability and expiry must be verified before launch | No hosted backup policy or restore/deletion rehearsal verified; local container backups are operator-managed |

The hourly job is installed with pg_cron. Its behavior is tested through the same cleanup function; scheduling on a hosted deployment still needs verification. Cleanup does not delete profiles or logs. No expiry should silently destroy an unsynchronized user edit.

## Export and deletion

User-facing export and deletion endpoints are **not implemented**. Their absence is a release blocker for real-user collection. Phase 6 must deliver an authenticated export of owned records and a resumable deletion process covering auth identity, database rows, private objects, local caches/outbox, and processor-related artifacts where applicable. Deletion must prevent new writes, support retries, and report completion accurately.

The local developer can delete a synthetic test identity through the local administrative API or reset the disposable local stack. These are development operations, not a substitute for user controls. Integration tests delete only the temporary identities they create.

Future deletion removes active data first. Backups may retain encrypted copies until their configured expiry; a restored backup must reapply deletion tombstones before serving users. This behavior and its maximum delay must be verified and disclosed before release. Export must not include secrets, other owners' data, or internal privileged configuration.

## Security and policy changes

Access controls, revision conflicts, request-size limits, service failures, rendering, and concurrent quotas have local test coverage documented in [the Phase 2 report](docs/PHASE_2_REPORT.md). They do not establish clinical safety, legal compliance, or a completed independent security audit.

Before inviting real users, identify the operator and privacy contact, processing locations and providers, support process, applicable obligations, and verified backup policy. Update this file when processing changes; version disclosures and request renewed consent where the purpose changes. Never publish stronger privacy claims than the deployed controls can support.
