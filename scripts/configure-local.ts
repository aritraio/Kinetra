import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
const config = z
  .object({
    API_URL: z.literal('http://127.0.0.1:54321'),
    ANON_KEY: z.string().min(1),
    SERVICE_ROLE_KEY: z.string().min(1),
  })
  .parse(
    JSON.parse(
      execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' }),
    ) as unknown,
  );
function updateFile(path: string, values: Record<string, string>) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  // Never replace a configured remote project with local values implicitly.
  const existingUrl = current.match(/^(?:VITE_)?SUPABASE_URL=(.*)$/m)?.[1];
  if (existingUrl && existingUrl !== config.API_URL)
    throw new Error(`${path} targets another project; use a separate local file`);
  const lines = current
    .split('\n')
    .filter((line) => !Object.keys(values).some((key) => line.startsWith(`${key}=`)));
  const next = `${lines.join('\n').trim()}\n${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
  writeFileSync(path, next, { mode: 0o600 });
  chmodSync(path, 0o600);
}
const response = await fetch(`${config.API_URL}/rest/v1/rpc/configure_account_writes`, {
  method: 'POST',
  headers: {
    apikey: config.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ enabled: true }),
});
if (!response.ok) throw new Error('Apply local migrations before configuring account writes');
updateFile('apps/api/.env.local', {
  NODE_ENV: 'development',
  KINETRA_ENV: 'development',
  SUPABASE_URL: config.API_URL,
  SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY,
});
updateFile('apps/web/.env.local', {
  VITE_API_BASE_URL: '/api',
  VITE_SUPABASE_URL: config.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
});
console.log(
  'Configured ignored local environment files. No credentials were printed. Restart pnpm dev.',
);
