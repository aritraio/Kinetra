// Real local Supabase checks. Tokens are kept in memory and never printed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { z } from 'zod';
import { createApp } from '../apps/api/src/app';
import { readEnvironment } from '../apps/api/src/env';
import type { AppRouter } from '../apps/api/src/router';

const config = z
  .object({
    API_URL: z.literal('http://127.0.0.1:54321'),
    ANON_KEY: z.string(),
    SERVICE_ROLE_KEY: z.string(),
    JWT_SECRET: z.string(),
  })
  .parse(
    JSON.parse(
      execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' }),
    ) as unknown,
  );
const env = readEnvironment({
  SUPABASE_URL: config.API_URL,
  SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY,
});
const app = createApp(env);
const users: { id: string; token: string }[] = [];
async function db(path: string, token: string, body?: unknown, admin = false) {
  return fetch(`${config.API_URL}/rest/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      apikey: admin ? config.SERVICE_ROLE_KEY : config.ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function client(token?: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost/api/trpc',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        fetch: async (input, init) => app.fetch(new Request(input, init as RequestInit)),
      }),
    ],
  });
}
async function callBudget(
  actor: string,
  options: {
    tokens?: number;
    user_requests?: number;
    global_requests?: number;
    user_tokens?: number;
    global_tokens?: number;
    max_concurrent?: number;
  } = {},
) {
  const response = await db(
    'rpc/acquire_ai_budget',
    config.SERVICE_ROLE_KEY,
    {
      actor,
      tokens: 100,
      user_requests: 1,
      global_requests: 100,
      user_tokens: 10000,
      global_tokens: 1000000,
      max_concurrent: 10,
      ...options,
    },
    true,
  );
  assert.equal(response.status, 200);
  return (await response.json()) as unknown;
}
const profile = {
  display_name: '<img src=x onerror=alert(1)>',
  height_cm: 175,
  weight_kg: 75,
  goal: 'maintain' as const,
  timezone: 'Asia/Kolkata',
  units: 'metric' as const,
};
try {
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${config.API_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: config.ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `phase2-${randomUUID()}@example.test`,
        password: 'Local-security-fixture-2026!',
      }),
    });
    assert.equal(response.status, 200);
    const session = z
      .object({ access_token: z.string(), user: z.object({ id: z.string().uuid() }) })
      .parse(await response.json());
    users.push({ id: session.user.id, token: session.access_token });
  }
  const [a, b] = users;
  assert.ok(a && b);
  const alice = client(a.token),
    bob = client(b.token);
  await assert.rejects(client().profile.read.query(), /Sign in/);
  await assert.rejects(client('forged-token').session.query());
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: a.id,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) - 60,
    }),
  ).toString('base64url');
  const expired = `${header}.${payload}.${createHmac('sha256', config.JWT_SECRET).update(`${header}.${payload}`).digest('base64url')}`;
  await assert.rejects(client(expired).profile.read.query());
  assert.deepEqual(await alice.session.query(), { owner_id: a.id });
  const row = await alice.profile.save.mutate({ expected_revision: 0, profile });
  assert.equal(row.owner_id, a.id);
  assert.equal(row.revision, 1);
  assert.equal(await bob.profile.read.query(), null);
  const wrongOwner = await db(`profiles?owner_id=eq.${a.id}`, b.token);
  assert.equal(wrongOwner.status, 200);
  assert.deepEqual(await wrongOwner.json(), []);
  const anonymous = await fetch(`${config.API_URL}/rest/v1/profiles`, {
    headers: { apikey: config.ANON_KEY },
  });
  assert.ok([401, 403].includes(anonymous.status));
  const directWrite = await db('profiles', a.token, { owner_id: a.id, ...profile });
  assert.ok([401, 403].includes(directWrite.status));
  const photoInjection = await db('rpc/save_profile', a.token, {
    expected_revision: 1,
    profile_data: { ...profile, policy_version: '2026-10-01', photo: 'base64-data' },
  });
  assert.equal(photoInjection.status, 400);
  const edits = await Promise.allSettled([
    alice.profile.save.mutate({
      expected_revision: 1,
      profile: { ...profile, display_name: 'first' },
    }),
    alice.profile.save.mutate({
      expected_revision: 1,
      profile: { ...profile, display_name: 'second' },
    }),
  ]);
  assert.equal(edits.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(edits.filter((result) => result.status === 'rejected').length, 1);
  const latest = await alice.profile.read.query();
  assert.equal(latest?.revision, 2);
  const log = await alice.logs.save.mutate({
    expected_revision: 0,
    local_date: '2026-03-08',
    timezone: 'America/New_York',
    weight: { value: 165, unit: 'lb' },
  });
  assert.equal(log.local_date, '2026-03-08');
  assert.equal(log.weight_kg, 74.842741);
  await alice.profile.save.mutate({
    expected_revision: 2,
    profile: { ...profile, timezone: 'Asia/Tokyo' },
  });
  const historical = await alice.logs.save.mutate({
    expected_revision: 1,
    local_date: '2026-03-08',
    timezone: 'America/New_York',
    weight: { value: 75, unit: 'kg' },
  });
  assert.equal(historical.timezone, 'America/New_York');
  assert.equal(historical.created_at, log.created_at);
  assert.equal(historical.revision, 2);
  await assert.rejects(
    alice.logs.save.mutate({
      expected_revision: 2,
      local_date: '2026-03-08',
      timezone: 'Asia/Tokyo',
      weight: { value: 75, unit: 'kg' },
    }),
  );
  assert.deepEqual(await bob.logs.list.query(), []);
  await alice.consent.mutate({
    purpose: 'camera_local',
    action: 'grant',
    policy_version: '2026-10-01',
  });
  const otherConsent = await db(`consent_records?owner_id=eq.${a.id}`, b.token);
  assert.deepEqual(await otherConsent.json(), []);
  const unauthorizedBudget = await db('rpc/acquire_ai_budget', a.token, {
    actor: b.id,
    tokens: 1,
    user_requests: 100,
    global_requests: 100,
    user_tokens: 100,
    global_tokens: 100,
    max_concurrent: 1,
  });
  assert.ok([401, 403, 404].includes(unauthorizedBudget.status));
  const oversize = await app.request('/api/plans/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'meal', note: 'x'.repeat(17000) }),
  });
  assert.equal(oversize.status, 413);
  const clientKey = await app.request('/api/plans/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'meal', apiKey: 'must-reject' }),
  });
  assert.equal(clientKey.status, 400);
  const method = await app.request('/api/plans/generate', {
    headers: { Authorization: `Bearer ${a.token}` },
  });
  assert.equal(method.status, 405);
  const disabled = await app.request('/api/plans/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
    body: '{"kind":"meal"}',
  });
  assert.equal(disabled.status, 501);
  const before = await db(`usage_buckets?owner_id=eq.${a.id}`, a.token);
  assert.deepEqual(await before.json(), []);
  assert.equal(await callBudget(a.id, { tokens: 100, user_tokens: 50 }), null);
  const burst = await Promise.all(Array.from({ length: 10 }, () => callBudget(a.id)));
  assert.equal(burst.filter((value) => typeof value === 'string').length, 1);
  assert.equal(burst.filter((value) => value === null).length, 9);
  const counts = z
    .array(z.object({ requests: z.number(), reserved_tokens: z.number() }))
    .parse(await (await db(`usage_buckets?owner_id=eq.${a.id}`, a.token)).json());
  assert.equal(counts[0]?.requests, 1);
  assert.equal(counts[0]?.reserved_tokens, 100);
  assert.equal(await callBudget(a.id, { user_requests: 100, max_concurrent: 1 }), null);
  const lease = z
    .string()
    .uuid()
    .parse(burst.find((value) => typeof value === 'string'));
  await db('rpc/release_ai_budget', config.SERVICE_ROLE_KEY, { actor: b.id, lease }, true);
  assert.equal(await callBudget(a.id, { user_requests: 100, max_concurrent: 1 }), null);
  await db('rpc/release_ai_budget', config.SERVICE_ROLE_KEY, { actor: a.id, lease }, true);
  const global = z
    .array(z.object({ requests: z.number() }))
    .parse(
      await (
        await db(
          'global_usage_buckets?order=bucket.desc&limit=1',
          config.SERVICE_ROLE_KEY,
          undefined,
          true,
        )
      ).json(),
    );
  const limit = (global[0]?.requests ?? 0) + 1;
  const shared = await Promise.all([
    callBudget(a.id, { user_requests: 100, global_requests: limit }),
    callBudget(b.id, { user_requests: 100, global_requests: limit }),
  ]);
  assert.equal(shared.filter((value) => typeof value === 'string').length, 1);
  assert.equal(shared.filter((value) => value === null).length, 1);
  console.log(
    'Verified live identity/expiry, RLS isolation, allowed persistence, revision races, historical dates, consent ownership, per-user/global quotas, token and concurrency budgets.',
  );
} finally {
  for (const user of users) {
    const response = await fetch(`${config.API_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: {
        apikey: config.SERVICE_ROLE_KEY,
        Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`,
      },
    });
    if (!response.ok) {
      console.error('Synthetic test account cleanup failed');
      process.exitCode = 1;
    }
  }
}
