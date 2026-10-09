import { z } from 'zod';
import { logRecordSchema, profileRecordSchema } from './account';
import { planVersionRecordSchema } from './plans';
import { trainingSessionRecordSchema } from './sessions';

export const consentRecordExportSchema = z.strictObject({
  id: z.string().uuid(),
  purpose: z.string(),
  action: z.string(),
  policy_version: z.string(),
  created_at: z.string(),
});
export type ConsentRecordExport = z.infer<typeof consentRecordExportSchema>;

export const photoMetadataExportSchema = z.strictObject({
  id: z.string().uuid(),
  object_path: z.string(),
  expires_at: z.string(),
  created_at: z.string(),
});
export type PhotoMetadataExport = z.infer<typeof photoMetadataExportSchema>;

export const exportDataSchema = z.strictObject({
  schema_version: z.literal('2026-10-01'),
  exported_at: z.string(),
  account_id: z.string().uuid(),
  policy_version: z.literal('2026-10-01'),
  profile: profileRecordSchema.nullable(),
  daily_logs: z.array(logRecordSchema),
  training_sessions: z.array(trainingSessionRecordSchema),
  plans: z.array(
    z.strictObject({
      id: z.string().uuid(),
      owner_id: z.string().uuid(),
      kind: z.enum(['workout', 'meal']),
      pinned_version: z.number().int().positive().nullable(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
  plan_versions: z.array(planVersionRecordSchema),
  consent_records: z.array(consentRecordExportSchema),
  photo_metadata: z.array(photoMetadataExportSchema),
});
export type ExportData = z.infer<typeof exportDataSchema>;

export const deletionRequestSchema = z.strictObject({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
  reason: z.string().max(200).optional(),
});
export type DeletionRequest = z.infer<typeof deletionRequestSchema>;

export const deletionResultSchema = z.strictObject({
  status: z.enum(['completed', 'running']),
  deleted_at: z.string(),
  records_purged: z.number().int().nonnegative(),
});
export type DeletionResult = z.infer<typeof deletionResultSchema>;

export const outboxMutationStateSchema = z.enum(['queued', 'syncing', 'failed', 'conflict']);
export type OutboxMutationState = z.infer<typeof outboxMutationStateSchema>;

export const outboxMutationSchema = z.strictObject({
  id: z.string().uuid(),
  ownerId: z.string(),
  entity: z.enum(['profile', 'log', 'session', 'plan']),
  entityId: z.string(),
  operation: z.enum(['upsert', 'delete']),
  payload: z.unknown(),
  baseRevision: z.number().int().nonnegative(),
  createdAt: z.string(),
  attempts: z.number().int().nonnegative(),
  state: outboxMutationStateSchema,
  error: z.string().optional(),
  conflictRecord: z.unknown().optional(),
});
export type OutboxMutation<T = unknown> = Omit<z.infer<typeof outboxMutationSchema>, 'payload'> & {
  payload: T;
};

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  error: string | null;
}
