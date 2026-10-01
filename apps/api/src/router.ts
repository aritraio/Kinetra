import {
  consentInputSchema,
  echoInputSchema,
  echoResultSchema,
  logRecordSchema,
  logUpdateSchema,
  profileRecordSchema,
  profileUpdateSchema,
} from '@kinetra/contracts';
import { echoMessage, weightInKg } from '@kinetra/domain';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { ApiEnvironment } from './env';
import { ApiFailure, databaseRequest, requireLocalWrites, type VerifiedIdentity } from './security';

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
});
export type AppRouter = typeof appRouter;
