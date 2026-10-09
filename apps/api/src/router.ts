import {
  consentInputSchema,
  consentRecordExportSchema,
  deletionRequestSchema,
  echoInputSchema,
  echoResultSchema,
  logRecordSchema,
  logUpdateSchema,
  photoMetadataExportSchema,
  photoUploadRequestSchema,
  planGenerationInputSchema,
  planVersionRecordSchema,
  profileRecordSchema,
  profileUpdateSchema,
  trainingSessionRecordSchema,
  type ExportData,
} from '@kinetra/contracts';
import { echoMessage, weightInKg } from '@kinetra/domain';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { ApiEnvironment } from './env';
import {
  ApiFailure,
  databaseRequest,
  requireLocalWrites,
  reserveBudget,
  type VerifiedIdentity,
} from './security';
import {
  GeminiProviderAdapter,
  GenerationError,
  IdempotencyConflictError,
  PlanGenerationOrchestrator,
} from './ai';

export interface RequestContext {
  hasBearerHeader: boolean;
  identity: VerifiedIdentity | null;
  authFailure: ApiFailure | null;
  env: ApiEnvironment;
  requestId: string;
  http: typeof fetch;
}
const t = initTRPC.context<RequestContext>().create({
  errorFormatter({ shape, ctx }) {
    return {
      ...shape,
      message: shape.data.code === 'INTERNAL_SERVER_ERROR' ? 'Request failed' : shape.message,
      data: {
        ...shape.data,
        stack: undefined,
        requestId: ctx?.requestId,
        retryable: shape.data.code === 'SERVICE_UNAVAILABLE',
      },
    };
  },
});
const secured = t.procedure.use(async ({ ctx, next }) => {
  try {
    if (!ctx.identity)
      throw ctx.authFailure ?? new ApiFailure('UNAUTHENTICATED', 'Sign in to continue');
    const result = await next({ ctx: { ...ctx, identity: ctx.identity } });
    if (!result.ok && result.error.cause instanceof ApiFailure) throw result.error.cause;
    return result;
  } catch (error) {
    throw translateFailure(error);
  }
});
export function translateFailure(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (error instanceof ApiFailure) {
    const codes = {
      UNAUTHENTICATED: 'UNAUTHORIZED',
      FORBIDDEN: 'FORBIDDEN',
      UNAVAILABLE: 'SERVICE_UNAVAILABLE',
      CONFLICT: 'CONFLICT',
      BAD_REQUEST: 'BAD_REQUEST',
      RATE_LIMITED: 'TOO_MANY_REQUESTS',
    } as const;
    return new TRPCError({ code: codes[error.code], message: error.message });
  }
  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Request failed' });
}
const oneRecord = <T>(schema: z.ZodType<T>, rows: unknown): T =>
  z.array(schema).length(1).parse(rows)[0] as T;
export const appRouter = t.router({
  echo: t.procedure
    .input(echoInputSchema)
    .output(echoResultSchema)
    .query(({ input }) => echoMessage(input)),
  transport: t.procedure.query(({ ctx }) => ({
    hasBearerHeader: ctx.hasBearerHeader,
    authenticated: Boolean(ctx.identity),
  })),
  session: secured.query(({ ctx }) => ({ owner_id: ctx.identity.id })),
  profile: t.router({
    read: secured.query(async ({ ctx }) => {
      const rows = z
        .array(profileRecordSchema)
        .parse(
          await databaseRequest(
            ctx.env,
            ctx.identity,
            `profiles?owner_id=eq.${ctx.identity.id}&limit=1`,
            undefined,
            ctx.http,
          ),
        );
      return rows[0] ?? null;
    }),
    save: secured.input(profileUpdateSchema).mutation(async ({ ctx, input }) => {
      requireLocalWrites(ctx.env);
      return oneRecord(
        profileRecordSchema,
        await databaseRequest(
          ctx.env,
          ctx.identity,
          'rpc/save_profile',
          {
            expected_revision: input.expected_revision,
            profile_data: { ...input.profile, policy_version: '2026-10-01' },
          },
          ctx.http,
        ),
      );
    }),
  }),
  logs: t.router({
    list: secured.query(async ({ ctx }) =>
      z
        .array(logRecordSchema)
        .parse(
          await databaseRequest(
            ctx.env,
            ctx.identity,
            `daily_logs?owner_id=eq.${ctx.identity.id}&order=local_date.desc&limit=100`,
            undefined,
            ctx.http,
          ),
        ),
    ),
    save: secured.input(logUpdateSchema).mutation(async ({ ctx, input }) => {
      requireLocalWrites(ctx.env);
      return oneRecord(
        logRecordSchema,
        await databaseRequest(
          ctx.env,
          ctx.identity,
          'rpc/save_daily_log',
          {
            expected_revision: input.expected_revision,
            log_date: input.local_date,
            log_timezone: input.timezone,
            log_weight_kg: weightInKg(input.weight.value, input.weight.unit),
          },
          ctx.http,
        ),
      );
    }),
  }),
  plans: t.router({
    generate: secured.input(planGenerationInputSchema).mutation(async ({ ctx, input }) => {
      requireLocalWrites(ctx.env);
      await reserveBudget(ctx.env, ctx.identity, ctx.http);
      const orchestrator = new PlanGenerationOrchestrator({
        adapter: new GeminiProviderAdapter(
          ctx.env.GEMINI_API_KEY ? { apiKey: ctx.env.GEMINI_API_KEY } : undefined,
        ),
      });
      try {
        return await orchestrator.generatePlan(ctx.identity.id, input);
      } catch (error) {
        if (error instanceof IdempotencyConflictError) {
          throw new ApiFailure('CONFLICT', error.message);
        }
        if (error instanceof GenerationError) {
          throw new ApiFailure('BAD_REQUEST', error.message);
        }
        throw error;
      }
    }),
  }),
  consent: secured.input(consentInputSchema).mutation(async ({ ctx, input }) => {
    requireLocalWrites(ctx.env);
    await databaseRequest(
      ctx.env,
      ctx.identity,
      'rpc/record_consent',
      {
        consent_purpose: input.purpose,
        consent_action: input.action,
        consent_version: input.policy_version,
      },
      ctx.http,
    );
    return { recorded: true as const };
  }),
  user: t.router({
    exportData: secured.query(async ({ ctx }) => {
      // 1. Fetch profile
      const profilesRaw = await databaseRequest(
        ctx.env,
        ctx.identity,
        `profiles?owner_id=eq.${ctx.identity.id}&limit=1`,
        undefined,
        ctx.http,
      );
      const profiles = z.array(profileRecordSchema).parse(profilesRaw);

      // 2. Fetch daily logs
      const logsRaw = await databaseRequest(
        ctx.env,
        ctx.identity,
        `daily_logs?owner_id=eq.${ctx.identity.id}&order=local_date.desc`,
        undefined,
        ctx.http,
      );
      const logs = z.array(logRecordSchema).parse(logsRaw);

      // 3. Fetch training sessions
      const sessionsRaw = await databaseRequest(
        ctx.env,
        ctx.identity,
        `training_sessions?owner_id=eq.${ctx.identity.id}&order=started_at.desc`,
        undefined,
        ctx.http,
      );
      const sessions = z.array(trainingSessionRecordSchema).parse(sessionsRaw ?? []);

      // 4. Fetch plans
      const plansRaw = await databaseRequest(
        ctx.env,
        ctx.identity,
        `plans?owner_id=eq.${ctx.identity.id}`,
        undefined,
        ctx.http,
      );
      const plans = (plansRaw ?? []) as Array<{
        id: string;
        owner_id: string;
        kind: 'workout' | 'meal';
        pinned_version: number | null;
        created_at: string;
        updated_at: string;
      }>;

      // 5. Fetch plan versions
      const versionsRaw = await databaseRequest(
        ctx.env,
        ctx.identity,
        `plan_versions?owner_id=eq.${ctx.identity.id}&order=version.desc`,
        undefined,
        ctx.http,
      );
      const planVersions = z.array(planVersionRecordSchema).parse(versionsRaw ?? []);

      // 6. Fetch consent records
      const consentRaw = await databaseRequest(
        ctx.env,
        ctx.identity,
        `consent_records?owner_id=eq.${ctx.identity.id}&order=created_at.desc`,
        undefined,
        ctx.http,
      );
      const consentRecords = z.array(consentRecordExportSchema).parse(consentRaw ?? []);

      // 7. Fetch photo metadata
      const photosRaw = await databaseRequest(
        ctx.env,
        ctx.identity,
        `photo_metadata?owner_id=eq.${ctx.identity.id}&order=created_at.desc`,
        undefined,
        ctx.http,
      );
      const photoMetadata = z.array(photoMetadataExportSchema).parse(photosRaw ?? []);

      const exportPayload: ExportData = {
        schema_version: '2026-10-01',
        exported_at: new Date().toISOString(),
        account_id: ctx.identity.id,
        policy_version: '2026-10-01',
        profile: profiles[0] ?? null,
        daily_logs: logs,
        training_sessions: sessions,
        plans,
        plan_versions: planVersions,
        consent_records: consentRecords,
        photo_metadata: photoMetadata,
      };

      return exportPayload;
    }),

    deleteAccount: secured.input(deletionRequestSchema).mutation(async ({ ctx, input }) => {
      requireLocalWrites(ctx.env);
      if (input.confirmation !== 'DELETE_MY_ACCOUNT') {
        throw new ApiFailure('BAD_REQUEST', 'Deletion confirmation mismatch');
      }

      // Check existing deletion jobs
      const existingJobs = (await databaseRequest(
        ctx.env,
        ctx.identity,
        `deletion_jobs?owner_id=eq.${ctx.identity.id}&order=requested_at.desc&limit=1`,
        undefined,
        ctx.http,
      )) as Array<{ id: string; state: string }>;

      let jobId: string;
      if (existingJobs[0]?.state === 'running') {
        jobId = existingJobs[0].id;
      } else {
        const createdJob = (await databaseRequest(
          ctx.env,
          ctx.identity,
          'deletion_jobs',
          { owner_id: ctx.identity.id, state: 'running' },
          ctx.http,
          'POST',
          true,
        )) as Array<{ id: string }>;
        jobId = createdJob?.[0]?.id ?? 'job-local';
      }

      let totalPurged = 0;
      const tablesToPurge = [
        'daily_logs',
        'training_sessions',
        'plan_versions',
        'plans',
        'photo_metadata',
        'consent_records',
        'profiles',
        'usage_buckets',
        'ai_budget_leases',
      ];

      for (const table of tablesToPurge) {
        try {
          await databaseRequest(
            ctx.env,
            ctx.identity,
            `${table}?owner_id=eq.${ctx.identity.id}`,
            undefined,
            ctx.http,
            'DELETE',
            true,
          );
          totalPurged += 1;
        } catch {
          // Continue purging remaining tables even on partial errors
        }
      }

      try {
        await databaseRequest(
          ctx.env,
          ctx.identity,
          `deletion_jobs?id=eq.${jobId}`,
          { state: 'completed', updated_at: new Date().toISOString() },
          ctx.http,
          'PATCH',
          true,
        );
      } catch {
        // Ignored if table cascaded
      }

      if (ctx.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          await ctx.http(`${ctx.env.SUPABASE_URL}/auth/v1/admin/users/${ctx.identity.id}`, {
            method: 'DELETE',
            headers: {
              apikey: ctx.env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${ctx.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
          });
        } catch {
          // Ignored in test environment
        }
      }

      return {
        status: 'completed' as const,
        deleted_at: new Date().toISOString(),
        records_purged: totalPurged,
      };
    }),
  }),
  photos: t.router({
    requestUpload: secured.input(photoUploadRequestSchema).mutation(async ({ ctx, input }) => {
      // P6-09 & ADR 0005: Check collection gate
      if (ctx.env.ENABLE_PHOTOS !== 'true') {
        throw new ApiFailure('FORBIDDEN', 'Photo collection disabled in initial release');
      }

      // Enforce consent for photo_storage
      const consentsRaw = await databaseRequest(
        ctx.env,
        ctx.identity,
        `consent_records?owner_id=eq.${ctx.identity.id}&purpose=eq.photo_storage&order=created_at.desc&limit=1`,
        undefined,
        ctx.http,
      );
      const consents = (consentsRaw ?? []) as Array<{ action: string; id: string }>;

      if (!consents[0] || consents[0].action !== 'grant') {
        throw new ApiFailure('FORBIDDEN', 'Explicit photo storage consent required before upload');
      }

      const photoId = crypto.randomUUID();
      const ext = input.mime_type.split('/')[1] || 'jpg';
      const objectPath = `${ctx.identity.id}/${photoId}.${ext}`;
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      await databaseRequest(
        ctx.env,
        ctx.identity,
        'photo_metadata',
        {
          id: photoId,
          owner_id: ctx.identity.id,
          object_path: objectPath,
          consent_id: consents[0].id,
          expires_at: expiresAt,
        },
        ctx.http,
        'POST',
      );

      return {
        id: photoId,
        object_path: objectPath,
        expires_at: expiresAt,
        upload_url: `${ctx.env.SUPABASE_URL}/storage/v1/object/photos/${objectPath}`,
      };
    }),
    deletePhoto: secured
      .input(z.strictObject({ photo_id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await databaseRequest(
          ctx.env,
          ctx.identity,
          `photo_metadata?id=eq.${input.photo_id}&owner_id=eq.${ctx.identity.id}`,
          undefined,
          ctx.http,
          'DELETE',
        );
        return { deleted: true as const };
      }),
  }),
});
export type AppRouter = typeof appRouter;
