import { z } from 'zod';
const apiUrlSchema = z.string().refine((value) => {
  if (value === '/api') return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.pathname === '/api' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}, 'VITE_API_BASE_URL must be /api or an HTTPS API URL ending in /api');
export function readWebEnvironment(input: unknown) {
  const result = z
    .object({
      VITE_API_BASE_URL: apiUrlSchema.default('/api'),
      VITE_SUPABASE_URL: z.string().url().optional(),
      VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    })
    .safeParse(input);
  if (!result.success) throw new Error('Invalid web environment: VITE_API_BASE_URL');
  const env = result.data;
  if (Boolean(env.VITE_SUPABASE_URL) !== Boolean(env.VITE_SUPABASE_PUBLISHABLE_KEY))
    throw new Error('Configure both public Supabase variables');
  if (env.VITE_SUPABASE_URL) {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (url.protocol !== 'https:' && url.origin !== 'http://127.0.0.1:54321')
      throw new Error('Supabase URL requires HTTPS outside local development');
  }
  return env;
}
export const webEnvironment = readWebEnvironment(
  (import.meta as ImportMeta & { readonly env?: unknown }).env ?? {},
);
