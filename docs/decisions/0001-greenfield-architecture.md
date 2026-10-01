# ADR 0001: Greenfield Architecture and Identity Baseline

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Kinetra Core Team
- **Task ID:** P0-01, P0-05

## Context

Historical review documents (`ideas.improve.md`, `improve.md`, `recomenation-for-imporvemt.md`) describe a prior prototype ("FitnessBaba") featuring vanilla JS, Clerk authentication, and three serverless AI endpoints. An inventory of the current repository reveals that no legacy application source, package manifests, or database instances exist in this checkout.

We must decide whether to plan for an identity and data migration from the prior prototype or to declare Kinetra a greenfield project.

## Decision

1. **Greenfield Implementation:** Kinetra will be developed as a greenfield monorepo project starting from the Phase 1 scaffold.
2. **Unified Auth and Storage:** We adopt **Supabase Auth** directly alongside **Supabase Postgres (with Row-Level Security)** and **Supabase Storage**.
3. **Legacy Migration Removal:** All migration-specific tasks involving Clerk-to-Supabase account transfers, identity mapping tables, and legacy schema backfills are classified as **Not Applicable (N/A)** for this codebase.

## Consequences

### Positive
- Zero legacy migration debt: avoids handling deprecated schema quirks, broken foreign keys, or orphaned user sessions.
- Cohesive security model: Supabase Auth integrates natively with PostgreSQL Row-Level Security (`auth.uid() = owner_id`), eliminating JWT bridging layers.
- Simplified developer experience: local development boots via Supabase CLI without external third-party auth dependencies.

### Negative / Tradeoffs
- Any prior test accounts or demo users from the prototype phase are not preserved and must be created fresh via seed scripts.
