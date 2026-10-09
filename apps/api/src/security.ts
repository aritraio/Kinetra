import { z } from 'zod';
import type { ApiEnvironment } from './env';

export class ApiFailure extends Error {
  constructor(
    readonly code:
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN'
      | 'UNAVAILABLE'
      | 'CONFLICT'
      | 'BAD_REQUEST'
      | 'RATE_LIMITED',
    message: string,
  ) {
    super(message);
  }
}
export interface VerifiedIdentity {
  id: string;
  token: string;
}
const identitySchema = z.object({ id: z.string().uuid() });
export async function verifyIdentity(
  header: string | undefined,
  env: ApiEnvironment,
  http: typeof fetch = fetch,
): Promise<VerifiedIdentity> {
  const token = /^Bearer ([^\s]+)$/.exec(header ?? '')?.[1];
  if (!token || token.length > 8192) throw new ApiFailure('UNAUTHENTICATED', 'Sign in to continue');
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
    throw new ApiFailure('UNAVAILABLE', 'Account service unavailable');
  try {
    const response = await http(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403)
      throw new ApiFailure('UNAUTHENTICATED', 'Session expired. Sign in again');
    if (!response.ok) throw new ApiFailure('UNAVAILABLE', 'Account service unavailable');
    const body: unknown = await response.json();
    return { id: identitySchema.parse(body).id, token };
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    throw new ApiFailure('UNAVAILABLE', 'Account service unavailable');
  }
}
export function requireLocalWrites(env: ApiEnvironment) {
  if (
    env.KINETRA_ENV !== 'development' ||
    !env.SUPABASE_URL ||
    new URL(env.SUPABASE_URL).hostname !== '127.0.0.1'
  ) {
    throw new ApiFailure(
      'FORBIDDEN',
      'Account writes are limited to local development until privacy controls are complete',
    );
  }
}
export async function databaseRequest(
  env: ApiEnvironment,
  identity: VerifiedIdentity,
  path: string,
  body?: unknown,
  http: typeof fetch = fetch,
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  useServiceRole?: boolean,
): Promise<unknown> {
  try {
    const bearer =
      useServiceRole && env.SUPABASE_SERVICE_ROLE_KEY
        ? env.SUPABASE_SERVICE_ROLE_KEY
        : identity.token;
    const apikey =
      useServiceRole && env.SUPABASE_SERVICE_ROLE_KEY
        ? env.SUPABASE_SERVICE_ROLE_KEY
        : (env.SUPABASE_PUBLISHABLE_KEY ?? '');
    const httpMethod = method ?? (body === undefined ? 'GET' : 'POST');
    const response = await http(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      method: httpMethod,
      headers: {
        apikey,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      if (response.status === 409)
        throw new ApiFailure('CONFLICT', 'Changed elsewhere. Reload before saving');
      if (response.status === 401)
        throw new ApiFailure('UNAUTHENTICATED', 'Session expired. Sign in again');
      if (response.status === 403) throw new ApiFailure('FORBIDDEN', 'Access denied');
      if (response.status === 400) throw new ApiFailure('BAD_REQUEST', 'Invalid record');
      throw new ApiFailure('UNAVAILABLE', 'Data service unavailable');
    }
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    throw new ApiFailure('UNAVAILABLE', 'Data service unavailable');
  }
}
export async function reserveBudget(
  env: ApiEnvironment,
  identity: VerifiedIdentity,
  http: typeof fetch = fetch,
): Promise<string> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY)
    throw new ApiFailure('UNAVAILABLE', 'Budget service unavailable');
  try {
    const response = await http(`${env.SUPABASE_URL}/rest/v1/rpc/acquire_ai_budget`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actor: identity.id,
        tokens: env.AI_RESERVED_TOKENS,
        user_requests: env.AI_REQUEST_LIMIT,
        global_requests: env.AI_GLOBAL_REQUEST_LIMIT,
        user_tokens: env.AI_TOKEN_LIMIT,
        global_tokens: env.AI_GLOBAL_TOKEN_LIMIT,
        max_concurrent: env.AI_MAX_CONCURRENT,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new ApiFailure('UNAVAILABLE', 'Budget service unavailable');
    const value: unknown = await response.json();
    if (value === null) throw new ApiFailure('RATE_LIMITED', 'Request budget exhausted. Try later');
    return z.string().uuid().parse(value);
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    throw new ApiFailure('UNAVAILABLE', 'Budget service unavailable');
  }
}
