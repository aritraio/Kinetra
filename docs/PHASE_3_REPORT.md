# Phase 3 implementation and verification report

Date: **2026-10-02**. Scope: **Domain contracts and an early synthetic demo**.

## Result and scope

Phase 3 is implemented and verified locally across the workspace. It delivers canonical contracts for profiles, daily logs, training sessions, meal and workout plans, coach events, and voice extraction; scientific calculations implemented as pure functions with stated assumptions and academic citations; a normalized ingredient and exercise catalog with nutrition provenance (USDA FoodData Central) and unknown-value fallback handling; interchangeable feature repository interfaces; two distinct, contrasting synthetic personas with 14 days of realistic logs, verified plan fixtures, and training history; an in-memory demo repository with instant persona switching and deterministic reset; and an interactive 6-destination web application that immediately demonstrates the core user experience without requiring authentication, server database instances, or paid AI provider keys.

The exit gate is satisfied:
- Shared contracts, pure calculations, and repository boundary tests pass (`38 tests in Vitest`).
- Both synthetic personas (Maya Lin: Cut/Pescatarian; Marcus Vance: Bulk/Strength) work reproducibly.
- Demo mode operates in-memory with zero server writes, zero database collection, and zero paid AI provider requests.
- All code respects workspace boundary enforcement (`check-boundaries.ts`), formatting (`biome format`), strict TypeScript types (`pnpm typecheck`), and secret scanning (`scan-web.ts`).

## Delivered behavior

### Canonical contracts and schemas (P3-01)

- Extended profile schemas in `@kinetra/contracts` (`packages/contracts/src/account.ts`) to validate demographics (biological sex, age 13–120), physical activity level (sedentary to extra active), dietary preferences, allergens/exclusions, target weight, and available equipment, while preserving strict object validation and backward compatibility with Phase 2 account tests.
- Comprehensive daily log update schemas (`packages/contracts/src/account.ts`) validating local date, timezone, normalized weight (kg/lb), daily calories, macronutrient grams (protein, carbs, fat), water volume (ml), and subjective notes.
- Structured meal and workout plan schemas (`packages/contracts/src/plans.ts`) with versioned payloads (`schema_version: '2026-10-01'`, `policy_version: '2026-10-01'`), day schedules, meal items with gram weights and item-level macros, and exercise prescriptions (sets, reps, rest seconds, prescribed loads, RPE, instructions).
- Training session record schemas (`packages/contracts/src/sessions.ts`) with detailed set-by-set load and rep telemetry.
- Coach streaming event protocol (`packages/contracts/src/coach.ts`) covering states: `started`, `status` (analyzing/synthesizing/reviewing), `text_delta`, `citation`, `action_suggestion`, `error`, and `done`.
- Voice transcription and extraction schemas (`packages/contracts/src/voice.ts`) with typed discriminated unions for meal logs, workout sets, and weight readings, including confidence scores and ambiguity detection.

### Pure domain calculation functions (P3-02)

- **Basal Metabolic Rate (BMR):** Implemented via the validated **Mifflin-St Jeor equation** (*Am J Clin Nutr. 1990*). Returns typed estimates with $\pm 10\%$ confidence intervals, explicit assumptions, and citations. Enforces boundaries (age 13–120, height 50–250 cm, weight 20–500 kg).
- **Total Daily Energy Expenditure (TDEE):** Calculates energy expenditure using evidence-based Physical Activity Level (PAL) multipliers (1.2 to 1.9).
- **Calorie Targets:** Computes goal-directed caloric adjustments (Cut: -20% deficit; Bulk: +10% surplus; Maintain: 0%) while enforcing clinical safe intake floors (1,200 kcal/day for females, 1,500 kcal/day for males) per ACSM and Dietary Guidelines for Americans.
- **Macronutrient Distribution:** Allocates protein (1.6–2.2 g/kg bodyweight, default 2.0 g/kg during cut, 1.8 g/kg during maintain/bulk per *Morton et al. Br J Sports Med 2018*), dietary fat (25% of energy), and carbohydrates (remaining balance). Reconciles macro totals against caloric targets.
- **Anthropometric Body Fat (US Navy Method):** Pure implementation of the tape-measure circumference formula (*Hodgdon & Beckett*). Clearly labeled as an anthropometric estimate, never a diagnostic DEXA scan.
- **Unit Conversions:** Pure, bidirectional conversions for weight (kg/lb), height (cm/in), and energy (kcal/kJ) with validation against non-finite or negative inputs.

### Normalized ingredient and exercise catalog (P3-03)

- **Ingredients Catalog (`packages/domain/src/catalog.ts`):** 20+ staple nutritional items with macronutrients per 100g, fiber, standard units, allergen tags, and explicit provenance citations (USDA FoodData Central SR Legacy & Foundation Foods).
- **Ingredient Resolution:** Bidirectional exact, alias, and substring matching (e.g. "oatmeal" $\to$ `rolled_oats`, "grilled chicken breast" $\to$ `chicken_breast`). Uncataloged food queries fall back to a typed, safe heuristic baseline labeled `is_unknown: true, is_estimated: true`.
- **Allergen & Exclusion Checker:** Checks food items against dietary restrictions and common allergens (dairy, gluten, peanuts, tree nuts, fish, shellfish, soy, eggs).
- **Exercise Catalog (`packages/domain/src/catalog.ts`):** Essential resistance training movements across all major movement patterns (squat, horizontal push/pull, vertical push/pull, hip hinge, lunge, isolation) with primary/secondary muscle targets, equipment needs, and form cues.
- **Exercise Resolution:** Bidirectional alias matching (e.g. "back squat" $\to$ `barbell_back_squat`, "rdl" $\to$ `romanian_deadlift_dumbbell`) and equipment compatibility checking.

### Interchangeable feature repository architecture (P3-04)

- Defined `ProfileRepository`, `LogsRepository`, `PlansRepository`, `HistoryRepository`, and `FeatureRepositories` interfaces in `@kinetra/contracts`.
- Implemented `InMemoryDemoRepositories` in `@kinetra/domain` operating fully in memory with deterministic fixtures.
- Implemented `ApiRepositories` in `@kinetra/web` proxying to typed tRPC procedures for authenticated accounts.
- Provided `RepositoryProvider` and `useRepositories()` React hook in `@kinetra/web`. UI components consume the repository contracts without branching on `isDemo` flags.

### Contrasting synthetic personas (P3-05)

1. **Maya Lin (Goal: Cut / Fat Loss):**
   - 28-year-old female, 168 cm, 68.0 kg (target: 62.0 kg), moderate activity (PAL 1.55).
   - Pescatarian (strict shellfish exclusion). Target: 1,750 kcal/day (136g P, 163g C, 46g F).
   - 14 days of realistic daily logs showing gradual, healthy fat loss from 68.8 kg down to 68.0 kg.
   - Accepted 7-day pescatarian meal plan and 4-day Upper/Lower hypertrophy split.
   - Logged training session history with realistic barbell squat and RDL loads.
2. **Marcus Vance (Goal: Bulk / Hypertrophy & Strength):**
   - 32-year-old male, 183 cm, 82.5 kg (target: 87.0 kg), very active (PAL 1.725).
   - Omnivore. Target: 3,150 kcal/day (180g P, 410g C, 85g F).
   - 14 days of daily logs showing steady weight progression from 81.8 kg up to 82.5 kg.
   - Accepted 7-day high-calorie omnivore meal plan and 5-day Push/Pull/Legs strength split.
   - Logged training history with progressive overload on core lifts (100kg bench press, 130kg squat).
- All synthetic data stamped with `SYNTHETIC_DATA_DISCLAIMER` disclaiming clinical/medical claims.

### Demo entry, reset, and walkthrough UI (P3-06, P3-07)

- **Entry & Persona Switcher:** Accessible top navigation with persona selection pills ("Maya Lin (Cut)" / "Marcus Vance (Bulk)") and URL parameter initialization (`?demo=marcus` or `?demo=maya`).
- **Deterministic Reset:** Single-click "Reset Fixtures" button restores in-memory repositories to initial persona data instantly.
- **Today Briefing:** Immediate actionable dashboard showing planned workout, target vs logged nutrition progress gauge, macro breakdown pills, quick log form, and local demo storage status.
- **Measure View:** Live interactive calculator testing Mifflin-St Jeor BMR, PAL TDEE, Calorie Target, Macro Distribution, and US Navy Body Fat with real-time recalculation and academic citations.
- **Plan View:** Structured view of 7-day meal schedules (item gram weights, calories, macros) and resistance workout routines (sets, reps, prescribed loads, rest times, cues) with version badges (`provenance: synthetic_fixture`).
- **Progress View:** 14-day weight history telemetry, KPI cards (Day 1 vs Day 14 delta), visual CSS trend bar chart, daily log records table, and completed session history.
- **Foundation & Auth Panel:** Preserved under the "Foundation & Auth" navigation tab for Phase 1 & 2 transport, SSE stream testing, and Supabase identity verification.

## Acceptance evidence

| Roadmap item | Local evidence and status |
| --- | --- |
| P3-01 | Canonical Zod schemas for profiles, logs, plans, sessions, coach events, and voice extraction; strict bounds, unit validation, and version tags tested in `tests/domain.test.ts`. Complete locally. |
| P3-02 | Pure calculation functions for Mifflin-St Jeor BMR, PAL TDEE, Calorie targets with safe floors, macro distributions, US Navy body fat, and unit conversions tested across valid boundaries and invalid inputs in `tests/domain.test.ts`. Complete locally. |
| P3-03 | Normalized ingredient catalog (provenance: USDA FoodData Central) and exercise catalog with alias matching, allergen/exclusion checking, and unknown-value heuristic fallbacks tested in `tests/domain.test.ts`. Complete locally. |
| P3-04 | Feature repository interfaces (`FeatureRepositories`, `ProfileRepository`, `LogsRepository`, etc.) implemented and verified with interchangeable `InMemoryDemoRepositories` and `ApiRepositories`; zero `if (isDemo)` branches in UI widgets. Complete locally. |
| P3-05 | Two contrasting personas (Maya Lin: Cut/Pescatarian; Marcus Vance: Bulk/Strength) with 14 days of realistic logs, accepted plan fixtures, and training history verified in `tests/domain.test.ts`. Complete locally. |
| P3-06 | URL query selector (`?demo=marcus`), in-app persona pills, and deterministic reset function tested; in-memory isolation prevents any leak into signed-in accounts or server databases. Complete locally. |
| P3-07 | Interactive 6-destination web interface displaying Today briefing, Measure calculations, Plan routines, Progress telemetry, and Foundation diagnostics; boots cleanly without server secrets, Docker, or paid AI keys. Complete locally. |

Verified command:

```sh
pnpm check
```

Output:
```text
$ biome format .
Checked 63 files in 7ms. No fixes applied.
$ biome lint . && node --import tsx scripts/check-boundaries.ts
Checked 64 files in 13ms. No fixes applied.
Workspace import boundaries passed.
$ pnpm -r typecheck && tsc -p tsconfig.json
Scope: 6 of 7 workspace projects
packages/contracts typecheck: Done in 314ms
packages/db typecheck: Done in 349ms
packages/domain typecheck: Done in 331ms
apps/api typecheck: Done in 583ms
apps/web typecheck: Done in 1s
tsc -p tsconfig.json: Done in 1.2s
$ vitest run
Test Files  3 passed (3)
     Tests  38 passed (38)
$ pnpm -r build && node --import tsx scripts/scan-web.ts
packages/contracts build: Done
packages/db build: Done
packages/domain build: Done
apps/api build: Done
apps/web build: Done in 118ms
Web artifacts contain no configured server secret markers.
```

## Reproduce the demo walkthrough

1. Clone or open the repository with Node `>=24.19.0` and pnpm `11.19.0`.
2. Run `pnpm dev` from the workspace root.
3. Open `http://127.0.0.1:5173` in any modern browser.
4. **Inspect Today:** The app immediately opens to Today's briefing for **Maya Lin (Cut / Pescatarian)**, displaying the Lower Body A workout recommendation, 1,750 kcal target gauge, macro progress pills, and quick log entry form.
5. **Inspect Measure:** Click **Measure** in the top navigation. Explore live Mifflin-St Jeor calculations; adjust weight, age, or activity level to see real-time recalculation of BMR, TDEE, safe caloric deficits, and macro distribution.
6. **Inspect Plan:** Click **Plan**. Toggle between the verified 4-Day Upper/Lower workout routine and 7-day pescatarian meal schedule with gram weights and item-level macros.
7. **Inspect Progress:** Click **Progress**. View the 14-day weight trend bar graph, net trend delta (-0.8 kg), daily records table, and completed training sessions.
8. **Switch Persona:** Click **Marcus Vance (Bulk)** in the top demo bar. The app reloads with Marcus's 3,150 kcal lean bulk targets, imperial units (lb), 5-day Push/Pull/Legs routine, and 14 days of surplus weight progression.
9. **Reset State:** Click **Reset Fixtures** to immediately revert any edits back to the pristine synthetic baseline.
10. **Inspect Diagnostics:** Click **Foundation & Auth** to test the Phase 1 typed tRPC connection, SSE stream response, or synthetic Supabase Auth.
