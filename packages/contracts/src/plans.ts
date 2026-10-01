import { z } from 'zod';

export const planKindSchema = z.enum(['meal', 'workout']);
export type PlanKind = z.infer<typeof planKindSchema>;

// --- Meal Plan Contracts ---
export const mealItemSchema = z.strictObject({
  ingredient_id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  amount: z.number().finite().positive().max(5000),
  unit: z.string().trim().min(1).max(30),
  calories: z.number().finite().min(0).max(5000),
  protein_g: z.number().finite().min(0).max(500),
  carbs_g: z.number().finite().min(0).max(500),
  fat_g: z.number().finite().min(0).max(500),
});
export type MealItem = z.infer<typeof mealItemSchema>;

export const mealSchema = z.strictObject({
  meal_id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  target_time: z.string().trim().max(10).optional(),
  calories: z.number().finite().min(0).max(5000),
  protein_g: z.number().finite().min(0).max(500),
  carbs_g: z.number().finite().min(0).max(500),
  fat_g: z.number().finite().min(0).max(500),
  items: z.array(mealItemSchema).min(1).max(30),
});
export type Meal = z.infer<typeof mealSchema>;

export const mealDaySchema = z.strictObject({
  day_number: z.number().int().min(1).max(7),
  day_name: z.string().trim().min(1).max(30),
  total_calories: z.number().finite().min(0).max(15000),
  total_protein_g: z.number().finite().min(0).max(1000),
  total_carbs_g: z.number().finite().min(0).max(1500),
  total_fat_g: z.number().finite().min(0).max(1000),
  meals: z.array(mealSchema).min(1).max(10),
});
export type MealDay = z.infer<typeof mealDaySchema>;

export const mealPlanPayloadSchema = z.strictObject({
  kind: z.literal('meal'),
  schema_version: z.literal('2026-10-01'),
  policy_version: z.literal('2026-10-01'),
  target_calories: z.number().finite().min(500).max(10000),
  target_protein_g: z.number().finite().min(20).max(800),
  target_carbs_g: z.number().finite().min(0).max(1500),
  target_fat_g: z.number().finite().min(10).max(500),
  days: z.array(mealDaySchema).min(1).max(7),
  notes: z.string().max(1000).optional(),
});
export type MealPlanPayload = z.infer<typeof mealPlanPayloadSchema>;

// --- Workout Plan Contracts ---
export const workoutExerciseSchema = z.strictObject({
  exercise_id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  target_sets: z.number().int().min(1).max(20),
  target_reps: z.string().trim().min(1).max(30),
  rest_seconds: z.number().int().min(0).max(600),
  prescribed_load: z
    .strictObject({
      value: z.number().finite().min(0).max(1000),
      unit: z.enum(['kg', 'lb']),
    })
    .optional(),
  rpe: z.number().finite().min(1).max(10).optional(),
  instructions: z.string().trim().max(500).optional(),
  equipment: z.string().trim().max(50),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

export const workoutDaySchema = z.strictObject({
  day_number: z.number().int().min(1).max(7),
  day_name: z.string().trim().min(1).max(30),
  focus: z.string().trim().min(1).max(100),
  is_rest_day: z.boolean(),
  exercises: z.array(workoutExerciseSchema).max(20),
});
export type WorkoutDay = z.infer<typeof workoutDaySchema>;

export const workoutPlanPayloadSchema = z.strictObject({
  kind: z.literal('workout'),
  schema_version: z.literal('2026-10-01'),
  policy_version: z.literal('2026-10-01'),
  split_name: z.string().trim().min(1).max(80),
  days_per_week: z.number().int().min(1).max(7),
  days: z.array(workoutDaySchema).min(1).max(7),
  notes: z.string().max(1000).optional(),
});
export type WorkoutPlanPayload = z.infer<typeof workoutPlanPayloadSchema>;

export const planPayloadSchema = z.discriminatedUnion('kind', [
  mealPlanPayloadSchema,
  workoutPlanPayloadSchema,
]);
export type PlanPayload = z.infer<typeof planPayloadSchema>;

// --- Plan & Version DB/DTO Records ---
export const planRecordSchema = z.strictObject({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  kind: planKindSchema,
  current_version: z.number().int().positive(),
  created_at: z.string(),
});
export type PlanRecord = z.infer<typeof planRecordSchema>;

export const planVersionProvenanceSchema = z.enum([
  'generated',
  'repaired',
  'template',
  'synthetic_fixture',
]);
export type PlanVersionProvenance = z.infer<typeof planVersionProvenanceSchema>;

export const planVersionRecordSchema = z.strictObject({
  plan_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  version: z.number().int().positive(),
  payload: planPayloadSchema,
  schema_version: z.literal('2026-10-01'),
  policy_version: z.literal('2026-10-01'),
  prompt_version: z.string().max(80),
  provenance: planVersionProvenanceSchema,
  created_at: z.string(),
});
export type PlanVersionRecord = z.infer<typeof planVersionRecordSchema>;

export interface PlanWithVersion {
  plan: PlanRecord;
  current_version: PlanVersionRecord;
}
