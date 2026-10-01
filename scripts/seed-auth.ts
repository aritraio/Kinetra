// Uses the local public key. Never accepts a remote project or service-role key.
import { execFileSync } from 'node:child_process';
import { z } from 'zod';

const status: unknown = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' }),
);
const config = z
  .object({
    API_URL: z.literal('http://127.0.0.1:54321'),
    ANON_KEY: z.string().min(1),
  })
  .parse(status);
const headers = { apikey: config.ANON_KEY, 'Content-Type': 'application/json' };
for (const email of ['foundation-cut@example.test', 'foundation-bulk@example.test']) {
  const body = JSON.stringify({ email, password: 'Local-synthetic-only-2026!' });
  const signIn = () =>
    fetch(`${config.API_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers,
      body,
    });
  let session = await signIn();
  if (!session.ok) {
    const created = await fetch(`${config.API_URL}/auth/v1/signup`, {
      method: 'POST',
      headers,
      body,
    });
    if (!created.ok)
      throw new Error(`Local seed failed (${created.status}); reset the local database and retry`);
    session = await signIn();
  }
  if (!session.ok) throw new Error(`Synthetic sign-in failed (${session.status})`);
  const result: unknown = await session.json();
  z.object({ access_token: z.string().min(1), user: z.object({ email: z.literal(email) }) }).parse(
    result,
  );
  console.log(`Synthetic local account sign-in verified: ${email}`);
}
