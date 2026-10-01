import { z } from 'zod';

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
});
export const logRecordSchema = z.strictObject({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  local_date: localDateSchema,
  timezone: timezoneSchema,
  weight_kg: z.number().finite().min(20).max(500),
  revision: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const consentInputSchema = z.strictObject({
  purpose: z.enum(['camera_local', 'photo_storage', 'provider_processing']),
  action: z.enum(['grant', 'withdraw']),
  policy_version: z.literal('2026-10-01'),
});
export const generationRequestSchema = z.strictObject({ kind: z.enum(['meal', 'workout']) });
