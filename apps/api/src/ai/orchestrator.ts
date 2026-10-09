import { randomUUID } from 'node:crypto';
import type {
  MealPlanPayload,
  PlanGenerationInput,
  PlanGenerationResult,
  PlanVersionProvenance,
  WorkoutPlanPayload,
} from '@kinetra/contracts';
import { mealPlanPayloadSchema, workoutPlanPayloadSchema } from '@kinetra/contracts';
import {
  getFallbackMealPlan,
  getFallbackWorkoutPlan,
  type MealVerificationProfile,
  type WorkoutVerificationProfile,
  verifyMealPlan,
  verifyWorkoutPlan,
} from '@kinetra/domain';
import { globalIdempotencyStore, type IdempotencyStore } from './idempotency';
import { globalTelemetry, hashOwnerId, type TelemetryCollector } from './observability';
import {
  GeminiProviderAdapter,
  PINNED_MODEL_CONFIG,
  type ProviderResponse,
} from './provider-adapter';

export interface OrchestratorConfig {
  readonly adapter?: GeminiProviderAdapter;
  readonly idempotencyStore?: IdempotencyStore;
  readonly telemetry?: TelemetryCollector;
  readonly promptVersion?: string;
  readonly schemaVersion?: '2026-10-01';
  readonly policyVersion?: '2026-10-01';
  readonly globalTimeoutMs?: number;
}

export class GenerationError extends Error {
  readonly code: 'INVALID_INPUT' | 'RECOVERY_EXHAUSTED' | 'TIMEOUT' | 'UNSATISFIABLE_CONSTRAINTS';

  constructor(
    code: 'INVALID_INPUT' | 'RECOVERY_EXHAUSTED' | 'TIMEOUT' | 'UNSATISFIABLE_CONSTRAINTS',
    message: string,
  ) {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
  }
}

export class PlanGenerationOrchestrator {
  private readonly adapter: GeminiProviderAdapter;
  private readonly idempotencyStore: IdempotencyStore;
  private readonly telemetry: TelemetryCollector;
  private readonly promptVersion: string;
  private readonly schemaVersion = '2026-10-01' as const;
  private readonly policyVersion = '2026-10-01' as const;
  private readonly globalTimeoutMs: number;

  constructor(config?: OrchestratorConfig) {
    this.adapter = config?.adapter ?? new GeminiProviderAdapter();
    this.idempotencyStore = config?.idempotencyStore ?? globalIdempotencyStore;
    this.telemetry = config?.telemetry ?? globalTelemetry;
    this.promptVersion = config?.promptVersion ?? '2026-10-01-v1';
    this.globalTimeoutMs = config?.globalTimeoutMs ?? 15000;
  }

  async generatePlan(
    ownerId: string,
    input: PlanGenerationInput,
    profileContext?: {
      target_calories?: number;
      target_protein_g?: number;
      target_carbs_g?: number;
      target_fat_g?: number;
      days_per_week?: number;
      equipment?: readonly string[];
      allergies?: readonly string[];
      dietary_preferences?: readonly string[];
    },
  ): Promise<PlanGenerationResult> {
    const startTime = Date.now();
    const opId = randomUUID();

    // Idempotency check
    if (input.idempotency_key) {
      const decision = await this.idempotencyStore.acquire<PlanGenerationResult>(
        ownerId,
        input.idempotency_key,
        input,
      );

      if (decision.kind === 'replayed') {
        this.telemetry.record({
          operation_id: opId,
          owner_hash: hashOwnerId(ownerId),
          kind: input.kind,
          provider: PINNED_MODEL_CONFIG.provider,
          model: PINNED_MODEL_CONFIG.model,
          prompt_version: this.promptVersion,
          schema_version: this.schemaVersion,
          policy_version: this.policyVersion,
          outcome: decision.result.provenance,
          attempts: 1,
          rejection_reasons: [],
          duration_ms: Date.now() - startTime,
          prompt_tokens: 0,
          candidate_tokens: 0,
          total_tokens: 0,
          replayed: true,
          timestamp: new Date().toISOString(),
        });
        return { ...decision.result, replayed: true };
      }

      // Wrap execution to commit or release lease
      const executionPromise = this.executeGeneration(
        opId,
        ownerId,
        input,
        profileContext,
        startTime,
      );
      decision.setPromise(executionPromise);
      try {
        const result = await executionPromise;
        decision.commit(result);
        return result;
      } catch (err) {
        decision.release();
        throw err;
      }
    }

    return this.executeGeneration(opId, ownerId, input, profileContext, startTime);
  }

  private async executeGeneration(
    opId: string,
    ownerId: string,
    input: PlanGenerationInput,
    profileContext:
      | {
          target_calories?: number;
          target_protein_g?: number;
          target_carbs_g?: number;
          target_fat_g?: number;
          days_per_week?: number;
          equipment?: readonly string[];
          allergies?: readonly string[];
          dietary_preferences?: readonly string[];
        }
      | undefined,
    startTime: number,
  ): Promise<PlanGenerationResult> {
    if (input.kind === 'meal') {
      return this.generateMealPlan(opId, ownerId, input, profileContext, startTime);
    }
    return this.generateWorkoutPlan(opId, ownerId, input, profileContext, startTime);
  }

  private async generateMealPlan(
    opId: string,
    ownerId: string,
    input: PlanGenerationInput,
    profileContext:
      | {
          target_calories?: number;
          target_protein_g?: number;
          target_carbs_g?: number;
          target_fat_g?: number;
          allergies?: readonly string[];
          dietary_preferences?: readonly string[];
        }
      | undefined,
    startTime: number,
  ): Promise<PlanGenerationResult> {
    const targetCalories = input.target_calories ?? profileContext?.target_calories ?? 2000;
    const targetProtein = input.target_protein_g ?? profileContext?.target_protein_g ?? 150;
    const targetCarbs = input.target_carbs_g ?? profileContext?.target_carbs_g ?? 200;
    const targetFat = input.target_fat_g ?? profileContext?.target_fat_g ?? 65;
    const allergies = input.allergies ?? profileContext?.allergies ?? [];
    const dietaryPreferences =
      input.dietary_preferences ?? profileContext?.dietary_preferences ?? [];

    const verificationProfile: MealVerificationProfile = {
      target_calories: targetCalories,
      target_protein_g: targetProtein,
      target_carbs_g: targetCarbs,
      target_fat_g: targetFat,
      allergies,
      dietary_preferences: dietaryPreferences,
      pantry_only: input.pantry_only,
      pantry_ingredients: input.pantry_ingredients,
    };

    let attempts = 0;
    let totalPromptTokens = 0;
    let totalCandidateTokens = 0;
    const rejectionReasons: string[] = [];

    let provenance: PlanVersionProvenance = 'generated';
    let verifiedPayload: MealPlanPayload | null = null;
    let finalVerification = null;

    // Step 1: Initial Generation Attempt
    attempts++;
    const initialPrompt = `Generate a verified 7-day meal plan.
Target calories: ${targetCalories} kcal/day
Target protein: ${targetProtein}g
Target carbs: ${targetCarbs}g
Target fat: ${targetFat}g
Allergies: ${allergies.join(', ') || 'none'}
Dietary preferences: ${dietaryPreferences.join(', ') || 'none'}
${input.pantry_only ? `Pantry-only ingredients: ${(input.pantry_ingredients ?? []).join(', ')}` : ''}
Return strict JSON matching MealPlanPayload schema.`;

    try {
      const response: ProviderResponse<MealPlanPayload> = await this.adapter.generateStructured(
        initialPrompt,
        mealPlanPayloadSchema,
        'MealPlanPayload',
        { timeout_ms: 7000 },
      );

      totalPromptTokens += response.prompt_tokens;
      totalCandidateTokens += response.candidate_tokens;

      const verification = verifyMealPlan(response.data, verificationProfile);
      if (verification.valid) {
        verifiedPayload = response.data;
        finalVerification = verification;
        provenance = 'generated';
      } else {
        for (const v of verification.hard_violations) {
          rejectionReasons.push(`${v.code}: ${v.message}`);
        }

        // Step 2: Bounded Semantic Repair (Max 1 Repair Attempt)
        attempts++;
        provenance = 'repaired';
        const repairPrompt = `The previous meal plan had verification failures:
${rejectionReasons.slice(0, 5).join('\n')}
Fix these specific violations. Maintain calories within ±50 kcal and protein within ±10g.
Preserve valid meals. Return corrected MealPlanPayload JSON.
Target calories: ${targetCalories} kcal/day
Target protein: ${targetProtein}g
Target carbs: ${targetCarbs}g
Target fat: ${targetFat}g
Allergies: ${allergies.join(', ') || 'none'}
Dietary preferences: ${dietaryPreferences.join(', ') || 'none'}
${input.pantry_only ? `Pantry-only ingredients: ${(input.pantry_ingredients ?? []).join(', ')}` : ''}`;

        const repairResponse: ProviderResponse<MealPlanPayload> =
          await this.adapter.generateStructured(
            repairPrompt,
            mealPlanPayloadSchema,
            'MealPlanPayload',
            { timeout_ms: 6000 },
          );

        totalPromptTokens += repairResponse.prompt_tokens;
        totalCandidateTokens += repairResponse.candidate_tokens;

        const repairVerification = verifyMealPlan(repairResponse.data, verificationProfile);
        if (repairVerification.valid) {
          verifiedPayload = repairResponse.data;
          finalVerification = repairVerification;
        } else {
          for (const v of repairVerification.hard_violations) {
            rejectionReasons.push(`REPAIR_${v.code}: ${v.message}`);
          }
        }
      }
    } catch (err) {
      rejectionReasons.push(`ADAPTER_ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 3: Verified Template Fallback
    if (!verifiedPayload) {
      provenance = 'template';
      const fallback = getFallbackMealPlan(verificationProfile);
      if (fallback) {
        verifiedPayload = fallback;
        finalVerification = verifyMealPlan(fallback, verificationProfile);
      }
    }

    // If even fallback cannot satisfy constraints
    if (!verifiedPayload || !finalVerification?.valid) {
      this.telemetry.record({
        operation_id: opId,
        owner_hash: hashOwnerId(ownerId),
        kind: 'meal',
        provider: PINNED_MODEL_CONFIG.provider,
        model: PINNED_MODEL_CONFIG.model,
        prompt_version: this.promptVersion,
        schema_version: this.schemaVersion,
        policy_version: this.policyVersion,
        outcome: 'failed',
        attempts,
        rejection_reasons: rejectionReasons,
        duration_ms: Date.now() - startTime,
        prompt_tokens: totalPromptTokens,
        candidate_tokens: totalCandidateTokens,
        total_tokens: totalPromptTokens + totalCandidateTokens,
        replayed: false,
        timestamp: new Date().toISOString(),
      });
      throw new GenerationError(
        'UNSATISFIABLE_CONSTRAINTS',
        `Meal plan could not satisfy constraints: ${rejectionReasons.join('; ')}`,
      );
    }

    const planId = randomUUID();
    const nowIso = new Date().toISOString();

    const result: PlanGenerationResult = {
      plan: {
        id: planId,
        owner_id: ownerId,
        kind: 'meal',
        current_version: 1,
        created_at: nowIso,
      },
      version: {
        plan_id: planId,
        owner_id: ownerId,
        version: 1,
        payload: verifiedPayload,
        schema_version: this.schemaVersion,
        policy_version: this.policyVersion,
        prompt_version: this.promptVersion,
        provenance,
        created_at: nowIso,
      },
      provenance,
      verification: finalVerification,
      replayed: false,
    };

    this.telemetry.record({
      operation_id: opId,
      owner_hash: hashOwnerId(ownerId),
      kind: 'meal',
      provider: PINNED_MODEL_CONFIG.provider,
      model: PINNED_MODEL_CONFIG.model,
      prompt_version: this.promptVersion,
      schema_version: this.schemaVersion,
      policy_version: this.policyVersion,
      outcome: provenance,
      attempts,
      rejection_reasons: rejectionReasons,
      duration_ms: Date.now() - startTime,
      prompt_tokens: totalPromptTokens,
      candidate_tokens: totalCandidateTokens,
      total_tokens: totalPromptTokens + totalCandidateTokens,
      replayed: false,
      timestamp: nowIso,
    });

    return result;
  }

  private async generateWorkoutPlan(
    opId: string,
    ownerId: string,
    input: PlanGenerationInput,
    profileContext:
      | {
          days_per_week?: number;
          equipment?: readonly string[];
        }
      | undefined,
    startTime: number,
  ): Promise<PlanGenerationResult> {
    const daysPerWeek = input.days_per_week ?? profileContext?.days_per_week ?? 4;
    const equipment = input.equipment ?? profileContext?.equipment ?? ['barbell', 'dumbbells'];

    const verificationProfile: WorkoutVerificationProfile = {
      days_per_week: daysPerWeek,
      available_equipment: equipment,
      split_name: input.split_name,
    };

    let attempts = 0;
    let totalPromptTokens = 0;
    let totalCandidateTokens = 0;
    const rejectionReasons: string[] = [];

    let provenance: PlanVersionProvenance = 'generated';
    let verifiedPayload: WorkoutPlanPayload | null = null;
    let finalVerification = null;

    // Step 1: Initial Generation Attempt
    attempts++;
    const initialPrompt = `Generate a verified workout plan.
Days per week: ${daysPerWeek}
Available equipment: ${equipment.join(', ') || 'bodyweight'}
Split name: ${input.split_name ?? `${daysPerWeek}-Day Targeted Split`}
Return strict JSON matching WorkoutPlanPayload schema.`;

    try {
      const response: ProviderResponse<WorkoutPlanPayload> = await this.adapter.generateStructured(
        initialPrompt,
        workoutPlanPayloadSchema,
        'WorkoutPlanPayload',
        { timeout_ms: 7000 },
      );

      totalPromptTokens += response.prompt_tokens;
      totalCandidateTokens += response.candidate_tokens;

      const verification = verifyWorkoutPlan(response.data, verificationProfile);
      if (verification.valid) {
        verifiedPayload = response.data;
        finalVerification = verification;
        provenance = 'generated';
      } else {
        for (const v of verification.hard_violations) {
          rejectionReasons.push(`${v.code}: ${v.message}`);
        }

        // Step 2: Bounded Semantic Repair (Max 1 Repair Attempt)
        attempts++;
        provenance = 'repaired';
        const repairPrompt = `The previous workout plan had verification failures:
${rejectionReasons.slice(0, 5).join('\n')}
Fix these specific violations. Ensure exercises only use available equipment: ${equipment.join(', ') || 'bodyweight'}.
Days per week: ${daysPerWeek}. Rest must be >= 60s on compound exercises. Return corrected WorkoutPlanPayload JSON.`;

        const repairResponse: ProviderResponse<WorkoutPlanPayload> =
          await this.adapter.generateStructured(
            repairPrompt,
            workoutPlanPayloadSchema,
            'WorkoutPlanPayload',
            { timeout_ms: 6000 },
          );

        totalPromptTokens += repairResponse.prompt_tokens;
        totalCandidateTokens += repairResponse.candidate_tokens;

        const repairVerification = verifyWorkoutPlan(repairResponse.data, verificationProfile);
        if (repairVerification.valid) {
          verifiedPayload = repairResponse.data;
          finalVerification = repairVerification;
        } else {
          for (const v of repairVerification.hard_violations) {
            rejectionReasons.push(`REPAIR_${v.code}: ${v.message}`);
          }
        }
      }
    } catch (err) {
      rejectionReasons.push(`ADAPTER_ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 3: Verified Template Fallback
    if (!verifiedPayload) {
      provenance = 'template';
      const fallback = getFallbackWorkoutPlan(verificationProfile);
      if (fallback) {
        verifiedPayload = fallback;
        finalVerification = verifyWorkoutPlan(fallback, verificationProfile);
      }
    }

    // If even fallback cannot satisfy constraints
    if (!verifiedPayload || !finalVerification?.valid) {
      this.telemetry.record({
        operation_id: opId,
        owner_hash: hashOwnerId(ownerId),
        kind: 'workout',
        provider: PINNED_MODEL_CONFIG.provider,
        model: PINNED_MODEL_CONFIG.model,
        prompt_version: this.promptVersion,
        schema_version: this.schemaVersion,
        policy_version: this.policyVersion,
        outcome: 'failed',
        attempts,
        rejection_reasons: rejectionReasons,
        duration_ms: Date.now() - startTime,
        prompt_tokens: totalPromptTokens,
        candidate_tokens: totalCandidateTokens,
        total_tokens: totalPromptTokens + totalCandidateTokens,
        replayed: false,
        timestamp: new Date().toISOString(),
      });
      throw new GenerationError(
        'UNSATISFIABLE_CONSTRAINTS',
        `Workout plan could not satisfy constraints: ${rejectionReasons.join('; ')}`,
      );
    }

    const planId = randomUUID();
    const nowIso = new Date().toISOString();

    const result: PlanGenerationResult = {
      plan: {
        id: planId,
        owner_id: ownerId,
        kind: 'workout',
        current_version: 1,
        created_at: nowIso,
      },
      version: {
        plan_id: planId,
        owner_id: ownerId,
        version: 1,
        payload: verifiedPayload,
        schema_version: this.schemaVersion,
        policy_version: this.policyVersion,
        prompt_version: this.promptVersion,
        provenance,
        created_at: nowIso,
      },
      provenance,
      verification: finalVerification,
      replayed: false,
    };

    this.telemetry.record({
      operation_id: opId,
      owner_hash: hashOwnerId(ownerId),
      kind: 'workout',
      provider: PINNED_MODEL_CONFIG.provider,
      model: PINNED_MODEL_CONFIG.model,
      prompt_version: this.promptVersion,
      schema_version: this.schemaVersion,
      policy_version: this.policyVersion,
      outcome: provenance,
      attempts,
      rejection_reasons: rejectionReasons,
      duration_ms: Date.now() - startTime,
      prompt_tokens: totalPromptTokens,
      candidate_tokens: totalCandidateTokens,
      total_tokens: totalPromptTokens + totalCandidateTokens,
      replayed: false,
      timestamp: nowIso,
    });

    return result;
  }
}

export const globalOrchestrator = new PlanGenerationOrchestrator();
