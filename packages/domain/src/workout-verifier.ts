import type {
  PlanVerificationResult,
  PlanVerificationViolation,
  WorkoutPlanPayload,
} from '@kinetra/contracts';
import { workoutPlanPayloadSchema } from '@kinetra/contracts';
import { checkExerciseEquipment, findExercise, type MuscleGroup, resolveExercise } from './catalog';

export interface WorkoutVerificationProfile {
  readonly days_per_week: number;
  readonly available_equipment?: readonly string[] | undefined;
  readonly split_name?: string | undefined;
  readonly experience_level?: ('beginner' | 'intermediate' | 'advanced') | undefined;
  readonly max_exercises_per_day?: number | undefined;
  readonly max_sets_per_exercise?: number | undefined;
  readonly max_sets_per_muscle_group?: number | undefined;
}

export interface WorkoutVerificationOptions {
  readonly min_compound_rest_seconds?: number | undefined;
  readonly min_isolation_rest_seconds?: number | undefined;
  readonly max_rest_seconds?: number | undefined;
  readonly min_sets_per_exercise?: number | undefined;
  readonly max_sets_per_exercise?: number | undefined;
  readonly min_exercises_per_day?: number | undefined;
  readonly max_exercises_per_day?: number | undefined;
  readonly max_sets_per_muscle_group?: number | undefined;
  readonly allow_custom_exercises?: boolean | undefined;
}

interface ResolvedWorkoutOptions {
  readonly min_compound_rest_seconds: number;
  readonly min_isolation_rest_seconds: number;
  readonly max_rest_seconds: number;
  readonly min_sets_per_exercise: number;
  readonly max_sets_per_exercise: number;
  readonly min_exercises_per_day: number;
  readonly max_exercises_per_day: number;
  readonly max_sets_per_muscle_group: number;
  readonly allow_custom_exercises: boolean;
}

const DEFAULT_OPTIONS: ResolvedWorkoutOptions = {
  min_compound_rest_seconds: 60,
  min_isolation_rest_seconds: 30,
  max_rest_seconds: 360,
  min_sets_per_exercise: 1,
  max_sets_per_exercise: 6,
  min_exercises_per_day: 2,
  max_exercises_per_day: 10,
  max_sets_per_muscle_group: 16,
  allow_custom_exercises: true,
};

export function verifyWorkoutPlan(
  plan: unknown,
  profile: WorkoutVerificationProfile,
  options?: WorkoutVerificationOptions,
): PlanVerificationResult {
  const opts: ResolvedWorkoutOptions = {
    min_compound_rest_seconds:
      options?.min_compound_rest_seconds ?? DEFAULT_OPTIONS.min_compound_rest_seconds,
    min_isolation_rest_seconds:
      options?.min_isolation_rest_seconds ?? DEFAULT_OPTIONS.min_isolation_rest_seconds,
    max_rest_seconds: options?.max_rest_seconds ?? DEFAULT_OPTIONS.max_rest_seconds,
    min_sets_per_exercise: options?.min_sets_per_exercise ?? DEFAULT_OPTIONS.min_sets_per_exercise,
    max_sets_per_exercise: options?.max_sets_per_exercise ?? DEFAULT_OPTIONS.max_sets_per_exercise,
    min_exercises_per_day: options?.min_exercises_per_day ?? DEFAULT_OPTIONS.min_exercises_per_day,
    max_exercises_per_day: options?.max_exercises_per_day ?? DEFAULT_OPTIONS.max_exercises_per_day,
    max_sets_per_muscle_group:
      options?.max_sets_per_muscle_group ?? DEFAULT_OPTIONS.max_sets_per_muscle_group,
    allow_custom_exercises:
      options?.allow_custom_exercises ?? DEFAULT_OPTIONS.allow_custom_exercises,
  };
  const hard_violations: PlanVerificationViolation[] = [];
  const soft_warnings: PlanVerificationViolation[] = [];

  // 1. Schema check
  const parsed = workoutPlanPayloadSchema.safeParse(plan);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      hard_violations.push({
        code: 'SCHEMA_INVALID',
        message: `Schema violation at ${issue.path.join('.')}: ${issue.message}`,
        severity: 'hard',
        path: issue.path.join('.'),
      });
    }
    return { valid: false, hard_violations, soft_warnings };
  }

  const workoutPlan: WorkoutPlanPayload = parsed.data;

  // 2. Days per week consistency
  if (workoutPlan.days_per_week !== profile.days_per_week) {
    hard_violations.push({
      code: 'DAYS_PER_WEEK_MISMATCH',
      message: `Plan specifies ${workoutPlan.days_per_week} days/week, profile requested ${profile.days_per_week}`,
      severity: 'hard',
      actual: workoutPlan.days_per_week,
      expected: profile.days_per_week,
    });
  }

  // Count active training days
  const activeTrainingDays = workoutPlan.days.filter((d) => !d.is_rest_day);
  if (activeTrainingDays.length !== profile.days_per_week) {
    hard_violations.push({
      code: 'ACTIVE_DAYS_COUNT_MISMATCH',
      message: `Plan has ${activeTrainingDays.length} active training days, expected ${profile.days_per_week}`,
      severity: 'hard',
      actual: activeTrainingDays.length,
      expected: profile.days_per_week,
    });
  }

  // Sequential day numbers
  const dayNumbers = workoutPlan.days.map((d) => d.day_number);
  const uniqueDayNumbers = new Set(dayNumbers);
  if (uniqueDayNumbers.size !== dayNumbers.length) {
    hard_violations.push({
      code: 'DUPLICATE_DAY_NUMBERS',
      message: 'Workout plan contains non-unique day numbers',
      severity: 'hard',
    });
  }

  const availableEquipment = profile.available_equipment ?? [];
  let totalPrescribedSets = 0;
  let maxDailyExercises = 0;
  let maxMuscleGroupSets = 0;

  // 3. Inspect each day
  for (const day of workoutPlan.days) {
    const dayPath = `days[day_${day.day_number}]`;

    if (day.is_rest_day) {
      if (day.exercises.length > 0) {
        hard_violations.push({
          code: 'REST_DAY_HAS_EXERCISES',
          message: `Day ${day.day_number} is designated as rest day but includes ${day.exercises.length} exercises`,
          severity: 'hard',
          path: `${dayPath}.exercises`,
          actual: day.exercises.length,
          expected: 0,
        });
      }
      continue;
    }

    // Active training day exercise count bounds
    if (day.exercises.length > maxDailyExercises) {
      maxDailyExercises = day.exercises.length;
    }

    if (
      day.exercises.length < opts.min_exercises_per_day ||
      day.exercises.length > opts.max_exercises_per_day
    ) {
      hard_violations.push({
        code: 'EXERCISE_COUNT_OUT_OF_BOUNDS',
        message: `Day ${day.day_number} has ${day.exercises.length} exercises. Must have between ${opts.min_exercises_per_day} and ${opts.max_exercises_per_day}`,
        severity: 'hard',
        path: `${dayPath}.exercises`,
        actual: day.exercises.length,
      });
    }

    const muscleGroupSets: Partial<Record<MuscleGroup, number>> = {};
    const seenExerciseIds = new Set<string>();

    for (const [exIdx, ex] of day.exercises.entries()) {
      const exPath = `${dayPath}.exercises[${exIdx}]`;

      // Duplicate exercise within same workout
      const normalizedId = ex.exercise_id.trim().toLowerCase();
      if (seenExerciseIds.has(normalizedId)) {
        hard_violations.push({
          code: 'DUPLICATE_EXERCISE_IN_WORKOUT',
          message: `Day ${day.day_number} contains duplicate exercise: "${ex.name}"`,
          severity: 'hard',
          path: exPath,
        });
      }
      seenExerciseIds.add(normalizedId);

      // Exercise resolution
      const catalogExercise = findExercise(ex.exercise_id) ?? findExercise(ex.name);
      const resolved = catalogExercise ?? resolveExercise(ex.name);

      if (!catalogExercise) {
        if (!opts.allow_custom_exercises) {
          hard_violations.push({
            code: 'UNRESOLVED_EXERCISE',
            message: `Exercise "${ex.name}" (id: ${ex.exercise_id}) not found in exercise catalog`,
            severity: 'hard',
            path: exPath,
          });
        } else {
          soft_warnings.push({
            code: 'CUSTOM_UNRESOLVED_EXERCISE',
            message: `Exercise "${ex.name}" is not in the canonical catalog and uses custom defaults`,
            severity: 'soft',
            path: exPath,
          });
        }
      }

      // Equipment compatibility check
      const compatible = checkExerciseEquipment(resolved, availableEquipment);
      if (!compatible) {
        hard_violations.push({
          code: 'EQUIPMENT_UNAVAILABLE',
          message: `Exercise "${ex.name}" requires equipment [${resolved.equipment.join(', ')}] not in user profile [${availableEquipment.join(', ')}]`,
          severity: 'hard',
          path: exPath,
          actual: resolved.equipment.join(', '),
          expected: availableEquipment.join(', '),
        });
      }

      // Sets bounds
      if (
        ex.target_sets < opts.min_sets_per_exercise ||
        ex.target_sets > opts.max_sets_per_exercise
      ) {
        hard_violations.push({
          code: 'EXCESSIVE_SETS',
          message: `Exercise "${ex.name}" prescribes ${ex.target_sets} sets (limit ${opts.min_sets_per_exercise}–${opts.max_sets_per_exercise})`,
          severity: 'hard',
          path: `${exPath}.target_sets`,
          actual: ex.target_sets,
        });
      }

      totalPrescribedSets += ex.target_sets;

      // Rest period bounds
      const isCompound = resolved.is_compound;
      const minRest = isCompound ? opts.min_compound_rest_seconds : opts.min_isolation_rest_seconds;

      if (ex.rest_seconds < minRest) {
        hard_violations.push({
          code: isCompound ? 'INSUFFICIENT_COMPOUND_REST' : 'INSUFFICIENT_ISOLATION_REST',
          message: `Exercise "${ex.name}" (${isCompound ? 'compound' : 'isolation'}) has ${ex.rest_seconds}s rest (minimum ${minRest}s required)`,
          severity: 'hard',
          path: `${exPath}.rest_seconds`,
          actual: ex.rest_seconds,
          expected: minRest,
        });
      }

      if (ex.rest_seconds > opts.max_rest_seconds) {
        hard_violations.push({
          code: 'EXCESSIVE_REST',
          message: `Exercise "${ex.name}" prescribes ${ex.rest_seconds}s rest (maximum allowed ${opts.max_rest_seconds}s)`,
          severity: 'hard',
          path: `${exPath}.rest_seconds`,
          actual: ex.rest_seconds,
          expected: opts.max_rest_seconds,
        });
      }

      // Reps validation (sanity check rep string)
      const repsLower = ex.target_reps.toLowerCase().trim();
      if (
        repsLower === '0' ||
        repsLower.includes('-0') ||
        /\b(?:[5-9]\d{2}|\d{4,})\b/.test(repsLower)
      ) {
        hard_violations.push({
          code: 'INVALID_REPS_PRESCRIPTION',
          message: `Exercise "${ex.name}" has unrealistic target reps: "${ex.target_reps}"`,
          severity: 'hard',
          path: `${exPath}.target_reps`,
          actual: ex.target_reps,
        });
      }

      // Accumulate muscle group volume
      const muscle = resolved.primary_muscle;
      muscleGroupSets[muscle] = (muscleGroupSets[muscle] ?? 0) + ex.target_sets;
    }

    // Volume per muscle group in a single session
    for (const [muscle, sets] of Object.entries(muscleGroupSets)) {
      if (sets && sets > maxMuscleGroupSets) {
        maxMuscleGroupSets = sets;
      }
      if (sets && sets > opts.max_sets_per_muscle_group) {
        hard_violations.push({
          code: 'JUNK_VOLUME_EXCEEDED',
          message: `Day ${day.day_number} prescribes ${sets} sets for "${muscle}" in one session (limit ${opts.max_sets_per_muscle_group} sets)`,
          severity: 'hard',
          path: `${dayPath}.volume.${muscle}`,
          actual: sets,
          expected: opts.max_sets_per_muscle_group,
        });
      }
    }
  }

  return {
    valid: hard_violations.length === 0,
    hard_violations,
    soft_warnings,
    metrics: {
      total_prescribed_sets: totalPrescribedSets,
      max_daily_exercises: maxDailyExercises,
      max_muscle_group_sets: maxMuscleGroupSets,
      active_days_count: activeTrainingDays.length,
      hard_violation_count: hard_violations.length,
      soft_warning_count: soft_warnings.length,
    },
  };
}
