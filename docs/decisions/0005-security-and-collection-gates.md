# ADR 0005: Verified identity, constrained writes, and a closed collection gate

Date: 2026-10-01. Status: accepted for the Phase 2 local foundation.

## Context

The recovered repository has no imported live identities or account records. New account storage must resist caller-supplied ownership, racing writes, and accidental opening of health collection before export/deletion exist. The browser can call Supabase directly, so an API-only restriction is insufficient.

## Decision

Use Supabase Auth verification through the auth service for every account-bound request. The API forwards the verified user's token to PostgREST. RLS restricts reads to the owner; authenticated users have no direct table-write grants. Narrow security-definer functions derive their actor from `auth.uid()`, validate allow-listed data, and update only the expected revision. Pin an empty search path and schema-qualify access.

Migrations disable account writes by default in a private setting. Ordinary users cannot change it. Account mutation functions enforce the flag; the API additionally limits writes to the disposable local development stack. Local-only setup enables it. Retain this gate until Phase 6 lifecycle verification is complete.

Keep service-role credentials out of browser code. Explicit server-only functions reserve hourly user/global request and token budgets using transactional locks; expiring leases bound concurrent work. A scheduled cleanup function removes expired operational records. Disabled AI routes perform no provider calls and consume no budget; a local-only synthetic probe verifies reservation behavior.

Use memory-only browser sessions and clear account state on owner changes/logout. Persist explicit log local dates and immutable entry timezones alongside UTC event timestamps. Use React text rendering and restrictive CSP; rich content is unsupported until a sanitization policy exists.

## Consequences and remaining gates

Hosted collection remains closed even with working sign-in. Export/deletion, private object lifecycle, provider adapters and usage reconciliation, deployed CSP/auth checks, backup recovery, and observed CI are separate requirements. Budget reservations are conservative ceilings rather than measured token billing. Typed Drizzle definitions describe row shapes; versioned SQL is authoritative for policies, functions, checks, and relational constraints.

There is no Clerk cutover to perform in this checkout. If historical identities are later imported, design and test an explicit ownership mapping before enabling access; do not match accounts by an unverified email claim.
