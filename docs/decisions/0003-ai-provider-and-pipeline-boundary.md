# ADR 0003: AI Provider Adapter and Pipeline Boundary

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Kinetra Core Team
- **Task ID:** P0-05, P2-04, P4-01

## Context

The prior reviews identified critical failure modes in AI integration:
1. Public proxy vulnerability: accepting client-supplied API keys or allowing unauthenticated generations.
2. Unverified output: accepting model hallucinations (e.g. macro totals that do not match calorie targets or impossible workouts) as canonical plans.
3. Provider fragility: relying on free-tier quotas without graceful degradation or bounded retry.

## Decision

1. **Server-Only Provider Isolation:**
   - All AI calls are dispatched exclusively from `apps/api/src/ai/`.
   - Client requests are authenticated; client-supplied provider keys are strictly rejected.
2. **Primary Provider:**
   - Use **Google Gemini** (`gemini-2.5-flash` or current stable flash tier) via the official `@google/genai` SDK.
   - Provider configurations (model names, temperature, seed, safety thresholds) must be pinned in code and environment configuration with validation dates.
3. **Deterministic Verification Boundary:**
   - Every AI generation passes through two verification gates before storage:
     1. *Syntax & Schema Gate:* Runtime Zod schema parsing.
     2. *Domain Constraint Gate:* Pure TypeScript verifier (`@kinetra/domain`) checking hard constraints (calorie limits within ±50 kcal, macro math consistency, allergen/exclusion enforcement, equipment compatibility).
4. **Bounded Recovery & Static Fallbacks:**
   - If verification fails, allow exactly **one** targeted semantic repair prompt.
   - If repair fails, fall back to pre-verified, deterministic static plan templates customized to user targets.
   - Never persist an unverified model output as an accepted plan.

## Consequences

### Positive
- Air-tight security: zero provider key leakage or unmetered proxy usage.
- High reliability: guarantees that every plan presented to the user satisfies nutritional and biomechanical sanity checks.
- Bounded latency and cost: caps provider calls per request, preventing infinite repair loops.

### Negative / Tradeoffs
- Rejection overhead: malformed outputs trigger recovery or fallback, requiring robust fallback template curation in `@kinetra/domain`.
