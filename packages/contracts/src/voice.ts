import { z } from 'zod';
import { localDateSchema, timezoneSchema } from './account';

export const voiceExtractionInputSchema = z.strictObject({
  transcript: z.string().trim().min(1).max(2000),
  timezone: timezoneSchema,
  local_date: localDateSchema,
});
export type VoiceExtractionInput = z.infer<typeof voiceExtractionInputSchema>;

export const voiceMealItemExtractionSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  amount: z.number().finite().positive().max(5000),
  unit: z.string().trim().min(1).max(30),
  estimated_calories: z.number().finite().min(0).max(5000),
  estimated_protein_g: z.number().finite().min(0).max(500),
  estimated_carbs_g: z.number().finite().min(0).max(500),
  estimated_fat_g: z.number().finite().min(0).max(500),
});
export type VoiceMealItemExtraction = z.infer<typeof voiceMealItemExtractionSchema>;

export const voiceMealExtractionSchema = z.strictObject({
  kind: z.literal('meal_log'),
  meal_name: z.string().trim().min(1).max(80),
  items: z.array(voiceMealItemExtractionSchema).min(1).max(20),
  total_estimated_calories: z.number().finite().min(0).max(10000),
});
export type VoiceMealExtraction = z.infer<typeof voiceMealExtractionSchema>;

export const voiceWorkoutSetExtractionSchema = z.strictObject({
  set_number: z.number().int().min(1).max(50),
  reps: z.number().int().min(1).max(200),
  load_kg: z.number().finite().min(0).max(1000),
  rpe: z.number().finite().min(1).max(10).optional(),
});
export type VoiceWorkoutSetExtraction = z.infer<typeof voiceWorkoutSetExtractionSchema>;

export const voiceWorkoutExtractionSchema = z.strictObject({
  kind: z.literal('workout_log'),
  exercise_name: z.string().trim().min(1).max(100),
  sets: z.array(voiceWorkoutSetExtractionSchema).min(1).max(20),
});
export type VoiceWorkoutExtraction = z.infer<typeof voiceWorkoutExtractionSchema>;

export const voiceWeightExtractionSchema = z.strictObject({
  kind: z.literal('weight_log'),
  weight_kg: z.number().finite().min(20).max(500),
});
export type VoiceWeightExtraction = z.infer<typeof voiceWeightExtractionSchema>;

export const voiceExtractionPayloadSchema = z.discriminatedUnion('kind', [
  voiceMealExtractionSchema,
  voiceWorkoutExtractionSchema,
  voiceWeightExtractionSchema,
]);
export type VoiceExtractionPayload = z.infer<typeof voiceExtractionPayloadSchema>;

export const voiceExtractionResultSchema = z.strictObject({
  extraction: voiceExtractionPayloadSchema.nullable(),
  confidence: z.number().finite().min(0).max(1),
  ambiguities: z.array(z.string().trim().max(200)).max(5),
  raw_transcript: z.string().max(2000),
});
export type VoiceExtractionResult = z.infer<typeof voiceExtractionResultSchema>;
