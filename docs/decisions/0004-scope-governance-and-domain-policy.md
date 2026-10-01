# ADR 0004: Scope Governance, Domain Policy, and Licensing

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Kinetra Core Team
- **Task ID:** P0-04, P0-05

## Context

Previous iterations contemplated an expansive set of features, including skincare routines, body-fat percentage estimation from photos, food label barcode scanning, wearable integrations, and social feeds. Unconstrained scope and unverified health claims create significant technical debt, regulatory risk, and privacy liabilities.

## Decision

1. **Frozen Six-Destination Navigation:**
   - **Today:** Single next action, active daily plan summary, daily logging widget, network sync indicator.
   - **Measure:** Transparent target calculations (BMR/TDEE), trend history, unit conversions.
   - **Plan:** Verified meal and workout plans with immutable versioning and revision history.
   - **Coach:** Real-time streamed interactive coaching with bounded conversation context and cancellation.
   - **Form Lab:** Local camera-based pose analysis for a single supported movement (Squat) via on-device landmark tracking.
   - **Progress:** Historical charts, logs, consistency metrics, and data export/deletion controls.

2. **Explicit Exclusions (Out of Scope for v1):**
   - *Skincare routines & acne analysis:* Removed completely (non-core domain).
   - *Body-fat estimation from photos:* Prohibited. Replaced with objective body circumference inputs and standard anthropometric formulas (US Navy method).
   - *Barcode / OCR food scanning:* Deferred to post-v1.
   - *Wearable & health device sync:* Deferred to post-v1.
   - *Social leaderboards / marketplace:* Excluded.

3. **Domain Calculation Policy:**
   - **Energy Baselines:** Use the validated **Mifflin-St Jeor equation** for Basal Metabolic Rate (BMR), adjusted by standard Physical Activity Level (PAL) multipliers (1.2 to 1.9).
   - **Estimates vs. Measurements:** All caloric calculations, macro goals, and form analysis scores must be explicitly labeled as *estimates with stated assumptions*, never clinical diagnoses.

4. **License & Governance:**
   - The repository candidate license is **MIT License**.
   - A health disclaimer must be displayed during onboarding: Kinetra is not a medical device and does not offer medical advice.

## Consequences

### Positive
- Defensible, high-integrity product: removes dubious AI claims (e.g. diagnosing skin or guessing body fat from a selfie).
- Manageable v1 delivery: focuses team effort on verifiable reliability, offline synchronization, and deterministic plan verification.
- Clear legal posture: transparent health estimates and clear open-source licensing.
