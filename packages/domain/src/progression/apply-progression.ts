import type {
  PlanVerificationResult,
  ProgressionProposal,
  WorkoutExercise,
  WorkoutPlanPayload,
} from '@kinetra/contracts';
import { findExercise } from '../catalog';
import { type WorkoutVerificationProfile, verifyWorkoutPlan } from '../workout-verifier';

export interface ApplyProgressionOptions {
  readonly acceptedExerciseIds?: readonly string[] | undefined;
  readonly verificationProfile?: WorkoutVerificationProfile | undefined;
}

export interface ApplyProgressionResult {
  readonly updatedPayload: WorkoutPlanPayload;
  readonly verification: PlanVerificationResult;
  readonly adjustedExercisesCount: number;
}

export function applyProgressionToWorkoutPlan(
  basePayload: WorkoutPlanPayload,
  proposal: ProgressionProposal,
  options?: ApplyProgressionOptions,
): ApplyProgressionResult {
  const acceptedSet = options?.acceptedExerciseIds
    ? new Set(options.acceptedExerciseIds)
    : new Set(
        proposal.exercise_adjustments
          .filter((a) => a.action === 'progress' || a.action === 'deload')
          .map((a) => a.exercise_id),
      );

  const adjustmentMap = new Map(proposal.exercise_adjustments.map((a) => [a.exercise_id, a]));

  let adjustedExercisesCount = 0;

  const newDays = basePayload.days.map((day) => {
    const updatedExercises: WorkoutExercise[] = day.exercises.map((ex) => {
      const adj = adjustmentMap.get(ex.exercise_id);
      if (!adj || !acceptedSet.has(ex.exercise_id)) {
        return { ...ex };
      }

      if (adj.action === 'insufficient_data' || adj.action === 'maintain') {
        return { ...ex };
      }

      adjustedExercisesCount++;

      const updatedEx: WorkoutExercise = {
        ...ex,
        target_sets: adj.proposed_prescription.target_sets,
        target_reps: adj.proposed_prescription.target_reps,
        prescribed_load: adj.proposed_prescription.load
          ? {
              value: adj.proposed_prescription.load.value,
              unit: adj.proposed_prescription.load.unit,
            }
          : undefined,
        rpe: adj.proposed_prescription.rpe ?? ex.rpe,
      };

      return updatedEx;
    });

    return {
      ...day,
      exercises: updatedExercises,
    };
  });

  const timestampIso = new Date().toISOString().slice(0, 10);
  const progressionNote = `[Adaptive Progression v${proposal.policy_version} on ${timestampIso}: ${adjustedExercisesCount} exercise(s) adjusted based on logged performance]`;
  const existingNotes = basePayload.notes ? `${basePayload.notes} ` : '';
  const updatedNotes = `${existingNotes}${progressionNote}`.trim().slice(0, 1000);

  const updatedPayload: WorkoutPlanPayload = {
    ...basePayload,
    days: newDays,
    notes: updatedNotes,
  };

  const catalogEquipment = Array.from(
    new Set(
      basePayload.days.flatMap((d) =>
        d.exercises.flatMap((e) => {
          const catalogEx = findExercise(e.exercise_id) ?? findExercise(e.name);
          return catalogEx ? [...catalogEx.equipment] : [e.equipment];
        }),
      ),
    ),
  );

  const verificationProfile: WorkoutVerificationProfile = options?.verificationProfile ?? {
    days_per_week: basePayload.days_per_week,
    split_name: basePayload.split_name,
    available_equipment:
      catalogEquipment.length > 0
        ? catalogEquipment
        : ['barbell', 'squat_rack', 'bench', 'dumbbells', 'bodyweight'],
  };

  const verification = verifyWorkoutPlan(updatedPayload, verificationProfile);

  return {
    updatedPayload,
    verification,
    adjustedExercisesCount,
  };
}
