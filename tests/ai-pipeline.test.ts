import type {
  MealPlanPayload,
  PlanGenerationInput,
  WorkoutPlanPayload,
} from '../packages/contracts/src/index';
import {
  getFallbackMealPlan,
  getFallbackWorkoutPlan,
  verifyMealPlan,
  verifyWorkoutPlan,
} from '../packages/domain/src/index';
import { describe, expect, it } from 'vitest';
import { IdempotencyConflictError, IdempotencyStore } from '../apps/api/src/ai/idempotency';
import { TelemetryCollector, assertRedacted } from '../apps/api/src/ai/observability';
import { PlanGenerationOrchestrator } from '../apps/api/src/ai/orchestrator';
import { GeminiProviderAdapter } from '../apps/api/src/ai/provider-adapter';

function requireFallbackMeal(profile: Parameters<typeof getFallbackMealPlan>[0]): MealPlanPayload {
  const plan = getFallbackMealPlan(profile);
  if (!plan) throw new Error('Expected fallback meal plan to be generated');
  return plan;
}

function requireFallbackWorkout(
  profile: Parameters<typeof getFallbackWorkoutPlan>[0],
): WorkoutPlanPayload {
  const plan = getFallbackWorkoutPlan(profile);
  if (!plan) throw new Error('Expected fallback workout plan to be generated');
  return plan;
}

describe('Phase 4: Verified AI Pipeline & Verifiers', () => {
  describe('Meal Verifier Strict Tolerances & Deterministic Invariants', () => {
    const baseProfile = {
      target_calories: 2000,
      target_protein_g: 150,
      target_carbs_g: 200,
      target_fat_g: 65,
      days_count: 7,
      allergies: ['peanuts'],
      dietary_preferences: ['omnivore'],
    };

    it('accepts plans strictly within +/-50 kcal and +/-10g protein', () => {
      const plan = requireFallbackMeal(baseProfile);
      const verification = verifyMealPlan(plan, baseProfile);
      expect(verification.valid).toBe(true);
      expect(verification.hard_violations).toHaveLength(0);
    });

    it('rejects plan when calories differ by 51 kcal (boundary check)', () => {
      const plan = requireFallbackMeal(baseProfile);
      const modified: MealPlanPayload = {
        ...plan,
        days: plan.days.map((d, i) =>
          i === 0
            ? {
                ...d,
                total_calories: baseProfile.target_calories + 51,
                meals: d.meals.map((m, mi) =>
                  mi === 0
                    ? {
                        ...m,
                        calories: m.calories + 51,
                        items: m.items.map((it, iti) =>
                          iti === 0 ? { ...it, calories: it.calories + 51 } : it,
                        ),
                      }
                    : m,
                ),
              }
            : d,
        ),
      };
      const verification = verifyMealPlan(modified, baseProfile);
      expect(verification.valid).toBe(false);
      expect(
        verification.hard_violations.some((v) => v.code === 'CALORIE_TOLERANCE_EXCEEDED'),
      ).toBe(true);
    });

    it('rejects plan when protein differs by 11g (boundary check)', () => {
      const plan = requireFallbackMeal(baseProfile);
      const modified: MealPlanPayload = {
        ...plan,
        days: plan.days.map((d, i) =>
          i === 0
            ? {
                ...d,
                total_protein_g: baseProfile.target_protein_g + 11,
                meals: d.meals.map((m, mi) =>
                  mi === 0
                    ? {
                        ...m,
                        protein_g: m.protein_g + 11,
                        items: m.items.map((it, iti) =>
                          iti === 0 ? { ...it, protein_g: it.protein_g + 11 } : it,
                        ),
                      }
                    : m,
                ),
              }
            : d,
        ),
      };
      const verification = verifyMealPlan(modified, baseProfile);
      expect(verification.valid).toBe(false);
      expect(
        verification.hard_violations.some((v) => v.code === 'PROTEIN_TOLERANCE_EXCEEDED'),
      ).toBe(true);
    });

    it('enforces allergen and dietary preference exclusions (dairy, vegan, meat)', () => {
      const veganProfile = {
        ...baseProfile,
        dietary_preferences: ['vegan'],
        allergies: ['dairy'],
      };
      const plan = requireFallbackMeal(veganProfile);
      const verification = verifyMealPlan(plan, veganProfile);
      expect(verification.valid).toBe(true);

      // Inject prohibited ingredient (chicken)
      const poisoned: MealPlanPayload = {
        ...plan,
        days: plan.days.map((d, i) =>
          i === 0
            ? {
                ...d,
                meals: d.meals.map((m, mi) =>
                  mi === 0
                    ? {
                        ...m,
                        items: [
                          ...m.items,
                          {
                            ingredient_id: 'chicken_breast',
                            name: 'Boneless Skinless Chicken Breast',
                            amount: 100,
                            unit: 'g',
                            calories: 165,
                            protein_g: 31,
                            carbs_g: 0,
                            fat_g: 3.6,
                          },
                        ],
                      }
                    : m,
                ),
              }
            : d,
        ),
      };
      const poisonedVerification = verifyMealPlan(poisoned, veganProfile);
      expect(poisonedVerification.valid).toBe(false);
      expect(
        poisonedVerification.hard_violations.some((v) => v.code === 'HARD_EXCLUSION_VEGAN'),
      ).toBe(true);
    });
  });

  describe('Workout Verifier Biomechanical & Structural Constraints', () => {
    const profile = {
      days_per_week: 4,
      available_equipment: ['barbell', 'squat_rack', 'bench', 'dumbbells'],
      split_name: '4-Day Upper/Lower Split',
    };

    it('verifies valid workout plan matching equipment and rest periods', () => {
      const plan = getFallbackWorkoutPlan(profile);
      expect(plan).not.toBeNull();
      const verification = verifyWorkoutPlan(plan, profile);
      expect(verification.valid).toBe(true);
      expect(verification.hard_violations).toHaveLength(0);
    });

    it('rejects compound exercises with insufficient rest (<60s)', () => {
      const plan = requireFallbackWorkout(profile);
      const modified: WorkoutPlanPayload = {
        ...plan,
        days: plan.days.map((d) => ({
          ...d,
          exercises: d.exercises.map((e) =>
            e.exercise_id === 'barbell_bench_press' ? { ...e, rest_seconds: 45 } : e,
          ),
        })),
      };
      const verification = verifyWorkoutPlan(modified, profile);
      expect(verification.valid).toBe(false);
      expect(
        verification.hard_violations.some((v) => v.code === 'INSUFFICIENT_COMPOUND_REST'),
      ).toBe(true);
    });

    it('rejects exercises using unavailable equipment', () => {
      const homeProfile = {
        days_per_week: 3,
        available_equipment: ['bodyweight'],
      };
      const plan = requireFallbackWorkout(homeProfile);
      // Inject barbell movement
      const modified: WorkoutPlanPayload = {
        ...plan,
        days: plan.days.map((d, i) =>
          i === 0
            ? {
                ...d,
                exercises: [
                  ...d.exercises,
                  {
                    exercise_id: 'barbell_deadlift',
                    name: 'Conventional Barbell Deadlift',
                    target_sets: 3,
                    target_reps: '5',
                    rest_seconds: 180,
                    equipment: 'barbell',
                    instructions: 'Drive floor away',
                  },
                ],
              }
            : d,
        ),
      };
      const verification = verifyWorkoutPlan(modified, homeProfile);
      expect(verification.valid).toBe(false);
      expect(verification.hard_violations.some((v) => v.code === 'EQUIPMENT_UNAVAILABLE')).toBe(
        true,
      );
    });

    it('enforces maximum 16 sets per muscle group volume ceiling', () => {
      const plan = requireFallbackWorkout(profile);
      const modified: WorkoutPlanPayload = {
        ...plan,
        days: plan.days.map((d, i) =>
          i === 0
            ? {
                ...d,
                exercises: [
                  ...d.exercises,
                  {
                    exercise_id: 'barbell_bench_press_extra',
                    name: 'Barbell Bench Press',
                    target_sets: 6,
                    target_reps: '8',
                    rest_seconds: 120,
                    equipment: 'barbell',
                    instructions: 'Press',
                  },
                  {
                    exercise_id: 'pushup_standard_extra',
                    name: 'Standard Push-Up',
                    target_sets: 6,
                    target_reps: '15',
                    rest_seconds: 60,
                    equipment: 'bodyweight',
                    instructions: 'Push',
                  },
                  {
                    exercise_id: 'dumbbell_incline_extra',
                    name: 'Incline Dumbbell Bench Press',
                    target_sets: 6,
                    target_reps: '10',
                    rest_seconds: 90,
                    equipment: 'dumbbells',
                    instructions: 'Press',
                  },
                ],
              }
            : d,
        ),
      };
      const verification = verifyWorkoutPlan(modified, profile);
      expect(verification.valid).toBe(false);
      expect(verification.hard_violations.some((v) => v.code === 'JUNK_VOLUME_EXCEEDED')).toBe(
        true,
      );
    });
  });

  describe('Bounded Recovery Orchestrator (1 Attempt -> 1 Repair -> Fallback)', () => {
    it('succeeds on first pass when model output is valid', async () => {
      const validPlan = requireFallbackMeal({
        target_calories: 2000,
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 65,
      });

      const adapter = new GeminiProviderAdapter({
        transport: {
          generateContent: async () => ({
            text: JSON.stringify(validPlan),
            promptTokens: 100,
            candidateTokens: 200,
          }),
        },
      });

      const orchestrator = new PlanGenerationOrchestrator({ adapter });
      const input: PlanGenerationInput = {
        kind: 'meal',
        idempotency_key: 'test_pass_1',
        target_calories: 2000,
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 65,
      };

      const result = await orchestrator.generatePlan('user_1', input);
      expect(result.provenance).toBe('generated');
      expect(result.verification.valid).toBe(true);
    });

    it('triggers semantic repair on initial failure and falls back to template if repair fails', async () => {
      let callCount = 0;
      const driftedPlan = requireFallbackMeal({
        target_calories: 2000 + 80, // 80 kcal drift violates 50 kcal tolerance
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 65,
      });

      const adapter = new GeminiProviderAdapter({
        transport: {
          generateContent: async () => {
            callCount++;
            return {
              text: JSON.stringify(driftedPlan),
              promptTokens: 50,
              candidateTokens: 50,
            };
          },
        },
      });

      const orchestrator = new PlanGenerationOrchestrator({ adapter });
      const input: PlanGenerationInput = {
        kind: 'meal',
        idempotency_key: 'test_fallback_recovery',
        target_calories: 2000,
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 65,
      };

      const result = await orchestrator.generatePlan('user_1', input);
      expect(callCount).toBe(2); // 1 initial + 1 repair attempt
      expect(result.provenance).toBe('template'); // Safely fell back to deterministic template!
      expect(result.verification.valid).toBe(true);
      expect(result.verification.hard_violations).toHaveLength(0);
    });
  });

  describe('Idempotency & Conflict Detection', () => {
    it('returns identical cached result on identical input replay', async () => {
      const store = new IdempotencyStore();
      const validPlan = requireFallbackMeal({
        target_calories: 2000,
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 65,
      });
      const adapter = new GeminiProviderAdapter({
        transport: {
          generateContent: async () => ({
            text: JSON.stringify(validPlan),
            promptTokens: 100,
            candidateTokens: 200,
          }),
        },
      });

      const orchestrator = new PlanGenerationOrchestrator({
        adapter,
        idempotencyStore: store,
      });

      const input: PlanGenerationInput = {
        kind: 'meal',
        idempotency_key: 'idempotent_key_1',
        target_calories: 2000,
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 65,
      };

      const res1 = await orchestrator.generatePlan('user_1', input);
      const res2 = await orchestrator.generatePlan('user_1', input);
      expect(res1.plan.id).toBe(res2.plan.id);
    });

    it('rejects with IdempotencyConflictError if key reused with different payload', async () => {
      const store = new IdempotencyStore();
      const validPlan = requireFallbackMeal({
        target_calories: 2000,
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 65,
      });
      const adapter = new GeminiProviderAdapter({
        transport: {
          generateContent: async () => ({
            text: JSON.stringify(validPlan),
            promptTokens: 100,
            candidateTokens: 200,
          }),
        },
      });

      const orchestrator = new PlanGenerationOrchestrator({
        adapter,
        idempotencyStore: store,
      });

      const inputA: PlanGenerationInput = {
        kind: 'meal',
        idempotency_key: 'conflict_key_1',
        target_calories: 2000,
        target_protein_g: 150,
        target_carbs_g: 200,
        target_fat_g: 65,
      };

      const inputB: PlanGenerationInput = {
        kind: 'meal',
        idempotency_key: 'conflict_key_1',
        target_calories: 2500, // Different payload!
        target_protein_g: 180,
        target_carbs_g: 250,
        target_fat_g: 75,
      };

      await orchestrator.generatePlan('user_1', inputA);
      await expect(orchestrator.generatePlan('user_1', inputB)).rejects.toBeInstanceOf(
        IdempotencyConflictError,
      );
    });
  });

  describe('Redacted Telemetry & Privacy Observability', () => {
    it('assertRedacted forbids prompt text, notes, and medical PII in telemetry events', () => {
      const safeEvent = {
        operation_id: 'op_123',
        kind: 'meal',
        duration_ms: 150,
        attempts: 1,
        success: true,
        tokens_total: 350,
      };
      expect(() => assertRedacted(safeEvent)).not.toThrow();

      const leakedPrompt = {
        ...safeEvent,
        prompt: 'User is allergic to nuts and has diabetes',
      };
      expect(() => assertRedacted(leakedPrompt)).toThrow();

      const leakedNotes = {
        ...safeEvent,
        health_notes: 'Medical condition',
      };
      expect(() => assertRedacted(leakedNotes)).toThrow();
    });

    it('records clean aggregate metrics without leaks', () => {
      const collector = new TelemetryCollector();
      collector.record({
        operation_id: 'op_1',
        owner_hash: 'hash_user_1',
        kind: 'meal',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        prompt_version: '2026-10-01-v1',
        schema_version: '2026-10-01-v1',
        policy_version: '2026-10-01-v1',
        outcome: 'generated',
        attempts: 1,
        rejection_reasons: [],
        duration_ms: 100,
        prompt_tokens: 150,
        candidate_tokens: 250,
        total_tokens: 400,
        replayed: false,
        timestamp: new Date().toISOString(),
      });

      const summary = collector.getSummary();
      expect(summary.total).toBe(1);
      expect(summary.outcomes.generated).toBe(1);
      expect(summary.latency_p95).toBe(100);
      expect(summary.total_tokens).toBe(400);
    });
  });
});
