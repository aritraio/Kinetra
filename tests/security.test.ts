import { describe, expect, it } from 'vitest';
import { profileUpdateSchema, localDateSchema } from '../packages/contracts/src/account';
import { localDateAt, weightInKg } from '../packages/domain/src/dates';
import {
  verifyIdentity,
  ApiFailure,
  requireLocalWrites,
  reserveBudget,
} from '../apps/api/src/security';
import { readEnvironment } from '../apps/api/src/env';
import { createApp } from '../apps/api/src/app';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../apps/api/src/router';

const env = readEnvironment({
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'synthetic-public',
});
const profile = {
  display_name: 'Synthetic',
  height_cm: 175,
  weight_kg: 75,
  goal: 'maintain',
  timezone: 'Asia/Kolkata',
  units: 'metric',
};
describe('account contracts', () => {
  it('rejects unknown owner, photo, credentials and invalid measurements', () => {
    for (const key of ['owner_id', 'photo', 'apiKey', 'state'])
      expect(
        profileUpdateSchema.safeParse({
          expected_revision: 0,
          profile: { ...profile, [key]: 'unsafe' },
        }).success,
      ).toBe(false);
    expect(
      profileUpdateSchema.safeParse({
        expected_revision: 0,
        profile: { ...profile, weight_kg: Infinity },
      }).success,
    ).toBe(false);
    expect(
      profileUpdateSchema.safeParse({
        expected_revision: 0,
        profile: { ...profile, timezone: 'Invalid/Zone' },
      }).success,
    ).toBe(false);
  });
  it('validates calendar dates independently of browser timezone', () => {
    expect(localDateSchema.safeParse('2026-02-29').success).toBe(false);
    expect(localDateSchema.safeParse('2024-02-29').success).toBe(true);
    expect(localDateAt('2026-03-08T06:59:00Z', 'America/New_York')).toBe('2026-03-08');
    expect(localDateAt('2026-03-08T07:01:00Z', 'America/New_York')).toBe('2026-03-08');
    expect(localDateAt('2026-11-01T05:30:00Z', 'America/New_York')).toBe('2026-11-01');
    expect(localDateAt('2026-11-01T06:30:00Z', 'America/New_York')).toBe('2026-11-01');
    expect(localDateAt('2026-10-01T00:01:00Z', 'America/Los_Angeles')).toBe('2026-09-30');
    expect(localDateAt('2026-10-01T00:01:00Z', 'Asia/Kolkata')).toBe('2026-10-01');
  });
  it('normalizes explicit weight units and rejects unsupported ranges', () => {
    expect(weightInKg(165, 'lb')).toBe(74.842741);
    expect(weightInKg(75, 'kg')).toBe(75);
    expect(() => weightInKg(NaN, 'kg')).toThrow();
    expect(() => weightInKg(1, 'kg')).toThrow();
  });
});
describe('verified identity', () => {
  it('does not trust the presence or shape of a bearer header', async () => {
    await expect(verifyIdentity(undefined, env)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(
      verifyIdentity('Bearer forged', env, async () => new Response('', { status: 401 })),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const identity = await verifyIdentity('Bearer opaque-token', env, async () =>
      Response.json({ id: '00000000-0000-4000-8000-000000000001' }),
    );
    expect(identity.id).toBe('00000000-0000-4000-8000-000000000001');
  });
  it('fails closed during outage and rejects malformed identity responses', async () => {
    await expect(
      verifyIdentity('Bearer valid-shape', env, async () => {
        throw new Error('private detail');
      }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE', message: 'Account service unavailable' });
    await expect(
      verifyIdentity('Bearer valid-shape', env, async () => Response.json({ id: 'wrong' })),
    ).rejects.toBeInstanceOf(ApiFailure);
  });
  it('fails closed with a safe budget error on network failure or malformed response', async () => {
    const budgetEnv = { ...env, SUPABASE_SERVICE_ROLE_KEY: 'server-test-only' };
    const identity = { id: '00000000-0000-4000-8000-000000000001', token: 'test-token' };
    for (const http of [
      async () => {
        throw new Error('private service detail');
      },
      async () => Response.json('invalid-lease'),
    ]) {
      await expect(reserveBudget(budgetEnv, identity, http)).rejects.toMatchObject({
        code: 'UNAVAILABLE',
        message: 'Budget service unavailable',
      });
    }
  });
  it('does not collect account data outside the local stack', () => {
    expect(() => requireLocalWrites(readEnvironment({}))).toThrow();
    expect(() => requireLocalWrites(env)).not.toThrow();
  });
  it('returns an unavailable result rather than granting access on auth outage', async () => {
    const app = createApp(env, async () => {
      throw new Error('secret backend details');
    });
    const rpc = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: 'http://localhost/api/trpc',
          headers: { Authorization: 'Bearer opaque' },
          fetch: async (input, init) => app.fetch(new Request(input, init as RequestInit)),
        }),
      ],
    });
    await expect(rpc.session.query()).rejects.toMatchObject({
      message: 'Account service unavailable',
    });
  });
  it('rejects provider headers and unauthorized browser origins', async () => {
    const app = createApp(env);
    expect(
      (await app.request('/api/health', { headers: { 'X-API-Key': 'client-key' } })).status,
    ).toBe(400);
    expect(
      (await app.request('/api/health', { headers: { Origin: 'https://evil.example' } })).status,
    ).toBe(403);
    expect((await app.request('/api/plans/generate')).status).toBe(405);
  });
});
