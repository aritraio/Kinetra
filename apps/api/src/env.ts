import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  KINETRA_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  AI_REQUEST_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
  AI_GLOBAL_REQUEST_LIMIT: z.coerce.number().int().min(1).max(100000).default(100),
  AI_TOKEN_LIMIT: z.coerce.number().int().min(1).max(1000000).default(50000),
  AI_GLOBAL_TOKEN_LIMIT: z.coerce.number().int().min(1).max(10000000).default(1000000),
  AI_MAX_CONCURRENT: z.coerce.number().int().min(1).max(20).default(1),
  AI_RESERVED_TOKENS: z.coerce.number().int().min(1).max(100000).default(1000),
});
export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function readEnvironment(input: unknown): ApiEnvironment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid API environment: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  }
  const env = result.data;
  if (env.NODE_ENV === 'production' && env.KINETRA_ENV === 'development') {
    throw new Error('Production runtime requires KINETRA_ENV=preview or production');
  }
  if (env.KINETRA_ENV !== 'development') {
    const missing = [
      'SUPABASE_URL',
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(
      (key) =>
        !env[key as 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'],
    );
    if (missing.length) throw new Error(`Missing API environment: ${missing.join(', ')}`);
    if (new URL(env.WEB_ORIGIN).protocol !== 'https:') throw new Error('WEB_ORIGIN requires HTTPS');
  }
  if (env.SUPABASE_URL) {
    const url = new URL(env.SUPABASE_URL);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    )
      throw new Error('SUPABASE_URL requires a service origin');
    if (
      url.protocol !== 'https:' &&
      !(env.KINETRA_ENV === 'development' && url.origin === 'http://127.0.0.1:54321')
    )
      throw new Error('SUPABASE_URL requires HTTPS outside the local stack');
  }
  return env;
}
