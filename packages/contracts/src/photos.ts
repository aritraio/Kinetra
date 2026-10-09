import { z } from 'zod';

export const allowedPhotoMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const PHOTO_RETENTION_DAYS = 30; // Max 30 days retention per PRIVACY.md

export const photoUploadRequestSchema = z.strictObject({
  file_name: z.string().trim().min(1).max(120),
  mime_type: z.enum(allowedPhotoMimeTypes),
  size_bytes: z.number().int().positive().max(MAX_PHOTO_SIZE_BYTES),
});
export type PhotoUploadRequest = z.infer<typeof photoUploadRequestSchema>;

export const photoMetadataRecordSchema = z.strictObject({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  object_path: z.string(),
  consent_id: z.string().uuid(),
  expires_at: z.string(),
  created_at: z.string(),
});
export type PhotoMetadataRecord = z.infer<typeof photoMetadataRecordSchema>;

export const signedPhotoUrlSchema = z.strictObject({
  read_url: z.string().url(),
  expires_at: z.string(),
});
export type SignedPhotoUrl = z.infer<typeof signedPhotoUrlSchema>;
