import { z } from 'zod';

export const trainingSetSchema = z.strictObject({
  set_number: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(200),
  load: z.strictObject({
    value: z.number().finite().min(0).max(1000),
    unit: z.enum(['kg', 'lb']),
  }),
  rpe: z.number().finite().min(1).max(10).optional(),
  completed: z.boolean(),
});
export type TrainingSet = z.infer<typeof trainingSetSchema>;

export const performedExerciseSchema = z.strictObject({
  exercise_id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  sets: z.array(trainingSetSchema).min(1).max(50),
  notes: z.string().max(500).optional(),
});
export type PerformedExercise = z.infer<typeof performedExerciseSchema>;

export const trainingSessionInputSchema = z.strictObject({
  plan_id: z.string().uuid().optional(),
  plan_version: z.number().int().positive().optional(),
  started_at: z.string(),
  completed_at: z.string().optional(),
  exercises: z.array(performedExerciseSchema).min(1).max(30),
  notes: z.string().max(500).optional(),
});
export type TrainingSessionInput = z.infer<typeof trainingSessionInputSchema>;

export const trainingSessionRecordSchema = trainingSessionInputSchema.extend({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  created_at: z.string(),
});
export type TrainingSessionRecord = z.infer<typeof trainingSessionRecordSchema>;
