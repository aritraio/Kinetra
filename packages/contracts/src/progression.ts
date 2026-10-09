import { z } from 'zod';

export const PROGRESSION_POLICY_VERSION = '2026-10-01' as const;
export const progressionPolicyVersionSchema = z.literal(PROGRESSION_POLICY_VERSION);
export type ProgressionPolicyVersion = z.infer<typeof progressionPolicyVersionSchema>;

export const progressionActionSchema = z.enum([
  'progress',
  'maintain',
  'deload',
  'reintroduce',
  'insufficient_data',
]);
export type ProgressionAction = z.infer<typeof progressionActionSchema>;

export const progressionEvidenceSchema = z.strictObject({
  sessions_analyzed: z.number().int().min(0).max(100),
  session_dates: z.array(z.string()).max(100),
  avg_rpe: z.number().finite().min(1).max(10).optional(),
  completion_rate_pct: z.number().finite().min(0).max(100),
  plateau_sessions_count: z.number().int().min(0).max(100),
  days_since_last_session: z.number().finite().min(0).max(1000),
  sets_evaluated: z.number().int().min(0).max(500).optional(),
});
export type ProgressionEvidence = z.infer<typeof progressionEvidenceSchema>;

export const exercisePrescriptionSnapshotSchema = z.strictObject({
  target_sets: z.number().int().min(1).max(20),
  target_reps: z.string().trim().min(1).max(30),
  load: z
    .strictObject({
      value: z.number().finite().min(0).max(1000),
      unit: z.enum(['kg', 'lb']),
    })
    .optional(),
  rpe: z.number().finite().min(1).max(10).optional(),
});
export type ExercisePrescriptionSnapshot = z.infer<typeof exercisePrescriptionSnapshotSchema>;

export const progressionDeltaSchema = z.strictObject({
  load_delta: z.number().finite(),
  reps_delta: z.number().finite(),
  sets_delta: z.number().int(),
  unit: z.enum(['kg', 'lb']),
});
export type ProgressionDelta = z.infer<typeof progressionDeltaSchema>;

export const exerciseProgressionAdjustmentSchema = z.strictObject({
  exercise_id: z.string().trim().min(1).max(80),
  exercise_name: z.string().trim().min(1).max(100),
  action: progressionActionSchema,
  current_prescription: exercisePrescriptionSnapshotSchema,
  proposed_prescription: exercisePrescriptionSnapshotSchema,
  delta: progressionDeltaSchema,
  reason: z.string().trim().min(1).max(500),
  evidence: progressionEvidenceSchema,
  confidence: z.number().finite().min(0).max(1),
  warnings: z.array(z.string().trim().max(300)),
});
export type ExerciseProgressionAdjustment = z.infer<typeof exerciseProgressionAdjustmentSchema>;

export const progressionProposalSchema = z.strictObject({
  id: z.string().uuid(),
  plan_id: z.string().uuid(),
  base_version: z.number().int().positive(),
  policy_version: progressionPolicyVersionSchema,
  evaluated_at: z.string(),
  overall_action: progressionActionSchema,
  exercise_adjustments: z.array(exerciseProgressionAdjustmentSchema),
  global_summary: z.string().trim().min(1).max(1000),
  requires_user_review: z.literal(true),
});
export type ProgressionProposal = z.infer<typeof progressionProposalSchema>;

export const progressionReviewInputSchema = z.strictObject({
  proposal_id: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
  accepted_exercise_ids: z.array(z.string().trim().min(1).max(80)).optional(),
});
export type ProgressionReviewInput = z.infer<typeof progressionReviewInputSchema>;

export const progressionReviewResultSchema = z.strictObject({
  proposal_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  action: z.enum(['accepted', 'rejected']),
  created_version: z.number().int().positive().optional(),
  message: z.string().trim().min(1).max(500),
});
export type ProgressionReviewResult = z.infer<typeof progressionReviewResultSchema>;
