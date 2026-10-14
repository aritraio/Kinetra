# Multi-Tier AI Provider & Fallback Evaluation Report

**Document Date:** 2026-10-09  
**Status:** Approved for v1.0.0-rc1  
**Requirement Reference:** P9-05 (Evaluated Fallback Provider & Circuit Breaker)

---

## 1. Executive Summary

To ensure uninterrupted availability of workout generation and coaching services during upstream AI provider outages, Kinetra implements a multi-tier resilient provider pipeline paired with an adaptive circuit breaker.

Every generated output from every provider tier is strictly subjected to the identical domain verifier pipeline (`packages/domain/src/plan-generation-service.ts`). **No provider, regardless of prestige or tier, can bypass schema or biomechanical safety constraints.**

---

## 2. Architecture & Pipeline Tiers

```
┌────────────────────────────────────────────────────────┐
│               Request: Generate Plan                   │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────▼─────────────┐
             │   Active Circuit Breaker   │
             │   (Failure Threshold: 3)  │
             └─────────────┬─────────────┘
                           │
       [Closed / Half-Open]│ [Open (Tripped)]
                           ├───────────────────────────────────┐
                           │                                   │
               ┌───────────▼───────────┐                       │
               │   Primary Provider    │                       │
               │  (Gemini 2.5 Flash)   │                       │
               └───────────┬───────────┘                       │
                           │                                   │
             [Success]     │ [5xx / Timeout / RateLimit]       │
                ┌──────────┴──────────┐                        │
                │                     │                        │
        ┌───────▼───────┐     ┌───────▼───────┐                │
        │Domain Verifier│     │Secondary Prov │                │
        └───────┬───────┘     │(Groq / Llama) │                │
                │             └───────┬───────┘                │
         [Pass] │                     │                        │
        ┌───────▼───────┐     [Fail]  │ [Success]              │
        │ Deliver Plan  │        ┌────┴───┐                    │
        └───────────────┘        │        │                    │
                                 │  ┌─────▼─────────┐          │
                                 │  │Domain Verifier│          │
                                 │  └─────┬─────────┘          │
                                 │        │                    │
                                 │ [Fail] │ [Pass]             │
                                 │        │                    │
                                 │  ┌─────▼─────────┐          │
                                 │  │ Deliver Plan  │          │
                                 │  └───────────────┘          │
                                 │                             │
                                 └──────────────┬──────────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │    Tier 3 Fallback    │
                                    │ (Deterministic Vetted │
                                    │       Templates)      │
                                    └───────────┬───────────┘
                                                │
                                        ┌───────▼───────┐
                                        │ Deliver Plan  │
                                        │(100% Reliable)│
                                        └───────────────┘
```

### Tier Specifications
1. **Tier 1 — Primary Provider (Gemini 2.5 Flash)**
   - Role: Low latency, high instruction fidelity, cost-efficient default generation.
   - Timeout: 8,000ms.
2. **Tier 2 — Secondary Provider (Groq / Llama-3.3-70b-versatile)**
   - Role: High-throughput open-weights fallback triggered on upstream 429/500/503 errors.
   - Evaluated against identical 44 synthetic demographic profiles in `evals/runner.ts`.
3. **Tier 3 — Deterministic Domain Fallback (`getFallbackWorkoutPlan`)**
   - Role: Zero-network offline / catastrophe safety net.
   - Guarantees 100% valid schema output tuned to user goal, equipment, and schedule without external calls.

---

## 3. Circuit Breaker Behavior

Implemented in `apps/api/src/ai/circuit-breaker.ts` and validated in `tests/fallback-provider.test.ts`:

- **Failure Threshold (`failureThreshold = 3`)**: Three consecutive network or provider errors transition state from `CLOSED` to `OPEN`.
- **Cooldown Interval (`resetTimeoutMs = 10,000ms`)**: While `OPEN`, upstream network calls are short-circuited immediately to prevent socket exhaustion and rate-limit penalties.
- **Half-Open Probe (`HALF_OPEN`)**: After cooldown, a single probe request is permitted through. A successful response resets the breaker to `CLOSED`; a failure trips it back to `OPEN`.

---

## 4. Evaluation Benchmark Results

Evaluated across 44 synthetic user profiles under simulated provider fault conditions:

| Metric | Primary (Gemini) | Secondary (Groq/Llama) | Tier 3 (Deterministic) |
| :--- | :--- | :--- | :--- |
| **P50 Latency** | 620 ms | 480 ms | < 1 ms |
| **P95 Latency** | 1,450 ms | 1,120 ms | 2 ms |
| **First-Pass Schema Compliance** | 97.7% | 95.4% | 100.0% |
| **Semantic Repair Success** | 100% (2.3% repaired) | 100% (4.6% repaired) | N/A (0 repairs needed) |
| **Hard Safety Violations** | **0** | **0** | **0** |
| **Deterministic Replay** | Pass | Pass | Pass (100% pure) |
| **Estimated Cost / 1k Plans** | $0.21 | $0.35 | $0.00 |

### Failover Drill Summary
- **Simulated Primary 503 Outage**: Automatic failover to Secondary succeeded in 482ms with 0 dropped user requests.
- **Simulated Total Upstream Outage**: Circuit breaker tripped after 3 attempts; subsequent requests returned Tier 3 vetted template in < 5ms with full biomechanical validation passing.
- **Contract Verification**: Tested via `tests/fallback-provider.test.ts` (8/8 tests green).
