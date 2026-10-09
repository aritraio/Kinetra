import { z } from 'zod';
import { planGenerationInputSchema } from './plans';

export const timezoneSchema = z
  .string()
  .max(80)
  .refine((timezone) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }, 'Use a supported IANA timezone');
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Use a valid calendar date');
export const profileSchema = z.strictObject({
  display_name: z.string().trim().min(1).max(80),
  height_cm: z.number().finite().min(50).max(250),
  weight_kg: z.number().finite().min(20).max(500),
  goal: z.enum(['maintain', 'cut', 'bulk']),
  timezone: timezoneSchema,
  units: z.enum(['metric', 'imperial']),
  biological_sex: z.enum(['male', 'female']).optional(),
  age: z.number().int().min(13).max(120).optional(),
  activity_level: z
    .enum(['sedentary', 'light', 'moderate', 'very_active', 'extra_active'])
    .optional(),
  dietary_preferences: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  allergies: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  target_weight_kg: z.number().finite().min(20).max(500).optional(),
  equipment: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});
export const profileUpdateSchema = z.strictObject({
  expected_revision: z.number().int().min(0),
  profile: profileSchema,
});
export const profileRecordSchema = profileSchema.extend({
  owner_id: z.string().uuid(),
  revision: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;
export type ProfileRecord = z.infer<typeof profileRecordSchema>;
export const logUpdateSchema = z.strictObject({
  expected_revision: z.number().int().min(0),
  local_date: localDateSchema,
  timezone: timezoneSchema,
  weight: z.strictObject({
    value: z.number().finite().positive().max(1200),
    unit: z.enum(['kg', 'lb']),
  }),
  calories: z.number().finite().min(0).max(15000).optional(),
  protein_g: z.number().finite().min(0).max(1000).optional(),
  carbs_g: z.number().finite().min(0).max(1500).optional(),
  fat_g: z.number().finite().min(0).max(1000).optional(),
  water_ml: z.number().finite().min(0).max(30000).optional(),
  notes: z.string().max(500).optional(),
});
export const logRecordSchema = z.strictObject({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  local_date: localDateSchema,
  timezone: timezoneSchema,
  weight_kg: z.number().finite().min(20).max(500),
  calories: z.number().finite().min(0).max(15000).optional(),
  protein_g: z.number().finite().min(0).max(1000).optional(),
  carbs_g: z.number().finite().min(0).max(1500).optional(),
  fat_g: z.number().finite().min(0).max(1000).optional(),
  water_ml: z.number().finite().min(0).max(30000).optional(),
  notes: z.string().max(500).optional(),
  revision: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LogUpdate = z.infer<typeof logUpdateSchema>;
export type LogRecord = z.infer<typeof logRecordSchema>;
export const consentInputSchema = z.strictObject({
  purpose: z.enum(['camera_local', 'photo_storage', 'provider_processing']),
  action: z.enum(['grant', 'withdraw']),
  policy_version: z.literal('2026-10-01'),
});
export const generationRequestSchema = planGenerationInputSchema;
