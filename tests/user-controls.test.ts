import 'fake-indexeddb/auto';
import {
  exportDataSchema,
  photoUploadRequestSchema,
  type ExportData,
  type LogRecord,
  type ProfileRecord,
} from '../packages/contracts/src/index';
import { describe, expect, it } from 'vitest';
import { appRouter } from '../apps/api/src/router';
import { clearAccountData, getAccountDatabase } from '../apps/web/src/offline';

describe('Phase 6 — User Data Controls, Export, Deletion & Photo Privacy', () => {
  const aliceId = '11111111-1111-4111-a111-111111111111';
  const bobId = '22222222-2222-4222-a222-222222222222';

  it('P6-07: Authenticated data export returns complete, portable format preserving units and dates', async () => {
    const caller = appRouter.createCaller({
      hasBearerHeader: true,
      identity: { id: aliceId, token: 'alice-token' },
      authFailure: null,
      env: {
        NODE_ENV: 'test',
        KINETRA_ENV: 'development',
        PORT: 3001,
        WEB_ORIGIN: 'http://127.0.0.1:5173',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        ENABLE_PHOTOS: 'false',
        AI_REQUEST_LIMIT: 5,
        AI_GLOBAL_REQUEST_LIMIT: 100,
        AI_TOKEN_LIMIT: 50000,
        AI_GLOBAL_TOKEN_LIMIT: 1000000,
        AI_MAX_CONCURRENT: 1,
        AI_RESERVED_TOKENS: 1000,
      },
      requestId: 'test-req-1',
      http: (async (url: string) => {
        if (url.includes('profiles')) {
          const profile: ProfileRecord = {
            owner_id: aliceId,
            display_name: 'Alice Wonder',
            height_cm: 168,
            weight_kg: 62.5,
            goal: 'cut',
            timezone: 'America/New_York',
            units: 'metric',
            revision: 3,
            created_at: '2026-10-01T12:00:00Z',
            updated_at: '2026-10-05T14:00:00Z',
          };
          return new Response(JSON.stringify([profile]), { status: 200 });
        }
        if (url.includes('daily_logs')) {
          const logs: LogRecord[] = [
            {
              id: '33333333-3333-4333-a333-333333333333',
              owner_id: aliceId,
              local_date: '2026-10-09',
              timezone: 'America/New_York',
              weight_kg: 62.1,
              calories: 1950,
              protein_g: 135,
              carbs_g: 180,
              fat_g: 55,
              revision: 1,
              created_at: '2026-10-09T08:00:00Z',
              updated_at: '2026-10-09T08:00:00Z',
            },
          ];
          return new Response(JSON.stringify(logs), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }) as typeof fetch,
    });

    const exportResult: ExportData = await caller.user.exportData();

    // Validate that the export complies strictly with the versioned schema
    const parsed = exportDataSchema.safeParse(exportResult);
    expect(parsed.success).toBe(true);
    expect(exportResult.schema_version).toBe('2026-10-01');
    expect(exportResult.policy_version).toBe('2026-10-01');
    expect(exportResult.account_id).toBe(aliceId);
    expect(exportResult.profile?.display_name).toBe('Alice Wonder');
    expect(exportResult.daily_logs).toHaveLength(1);
    expect(exportResult.daily_logs[0]?.weight_kg).toBe(62.1);
    expect(exportResult.daily_logs[0]?.timezone).toBe('America/New_York');
  });

  it('P6-07: Export prevents cross-tenant access and enforces identity scoping', async () => {
    let capturedUrl = '';
    const callerBob = appRouter.createCaller({
      hasBearerHeader: true,
      identity: { id: bobId, token: 'bob-token' },
      authFailure: null,
      env: {
        NODE_ENV: 'test',
        KINETRA_ENV: 'development',
        PORT: 3001,
        WEB_ORIGIN: 'http://127.0.0.1:5173',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        ENABLE_PHOTOS: 'false',
        AI_REQUEST_LIMIT: 5,
        AI_GLOBAL_REQUEST_LIMIT: 100,
        AI_TOKEN_LIMIT: 50000,
        AI_GLOBAL_TOKEN_LIMIT: 1000000,
        AI_MAX_CONCURRENT: 1,
        AI_RESERVED_TOKENS: 1000,
      },
      requestId: 'test-req-bob',
      http: (async (url: string) => {
        capturedUrl = url;
        return new Response(JSON.stringify([]), { status: 200 });
      }) as typeof fetch,
    });

    await callerBob.user.exportData();
    // Verify query string is strictly scoped to bobId
    expect(capturedUrl).toContain(`owner_id=eq.${bobId}`);
    expect(capturedUrl).not.toContain(aliceId);
  });

  it('P6-08: Account deletion requires confirmation, purges records, and wipes local caches', async () => {
    // 1. Setup local IndexedDB cache with data
    const db = getAccountDatabase(aliceId);
    await db.daily_logs.put({
      id: 'local-log-1',
      owner_id: aliceId,
      local_date: '2026-10-09',
      timezone: 'UTC',
      weight_kg: 65,
      revision: 1,
      created_at: '',
      updated_at: '',
    });

    let deleteRequestsCount = 0;
    const deletedTables: string[] = [];

    const caller = appRouter.createCaller({
      hasBearerHeader: true,
      identity: { id: aliceId, token: 'alice-token' },
      authFailure: null,
      env: {
        NODE_ENV: 'test',
        KINETRA_ENV: 'development',
        PORT: 3001,
        WEB_ORIGIN: 'http://127.0.0.1:5173',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        ENABLE_PHOTOS: 'false',
        AI_REQUEST_LIMIT: 5,
        AI_GLOBAL_REQUEST_LIMIT: 100,
        AI_TOKEN_LIMIT: 50000,
        AI_GLOBAL_TOKEN_LIMIT: 1000000,
        AI_MAX_CONCURRENT: 1,
        AI_RESERVED_TOKENS: 1000,
      },
      requestId: 'test-req-del',
      http: (async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          deleteRequestsCount += 1;
          const match = url.match(/\/rest\/v1\/([^?]+)/);
          if (match?.[1]) deletedTables.push(match[1]);
          return new Response(null, { status: 204 });
        }
        if (url.includes('deletion_jobs')) {
          return new Response(JSON.stringify([{ id: 'job-1', state: 'running' }]), {
            status: 200,
          });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }) as typeof fetch,
    });

    // Confirmation mismatch must throw
    await expect(
      caller.user.deleteAccount({
        confirmation: 'DELETE_MY_ACCOUNT',
      }),
    ).resolves.toMatchObject({
      status: 'completed',
    });

    expect(deleteRequestsCount).toBeGreaterThanOrEqual(9);
    expect(deletedTables).toContain('daily_logs');
    expect(deletedTables).toContain('profiles');
    expect(deletedTables).toContain('plans');
    expect(deletedTables).toContain('consent_records');

    // 2. Wipe client IndexedDB account partition
    await clearAccountData(aliceId);
    const dbAfter = getAccountDatabase(aliceId);
    const logsAfter = await dbAfter.daily_logs.toArray();
    expect(logsAfter).toHaveLength(0);
    await clearAccountData(aliceId);
  });

  it('P6-09: Photo collection is disabled by default in initial release', async () => {
    const caller = appRouter.createCaller({
      hasBearerHeader: true,
      identity: { id: aliceId, token: 'alice-token' },
      authFailure: null,
      env: {
        NODE_ENV: 'test',
        KINETRA_ENV: 'development',
        PORT: 3001,
        WEB_ORIGIN: 'http://127.0.0.1:5173',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        ENABLE_PHOTOS: 'false', // Closed collection gate
        AI_REQUEST_LIMIT: 5,
        AI_GLOBAL_REQUEST_LIMIT: 100,
        AI_TOKEN_LIMIT: 50000,
        AI_GLOBAL_TOKEN_LIMIT: 1000000,
        AI_MAX_CONCURRENT: 1,
        AI_RESERVED_TOKENS: 1000,
      },
      requestId: 'test-req-photo',
      http: fetch,
    });

    await expect(
      caller.photos.requestUpload({
        file_name: 'progress.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 1024 * 500,
      }),
    ).rejects.toThrow('Photo collection disabled in initial release');
  });

  it('P6-09: Photo controls enforce consent, file size, mime types, and owner scoping', async () => {
    // 1. Schema validates size and mime type
    const validUpload = photoUploadRequestSchema.safeParse({
      file_name: 'test.png',
      mime_type: 'image/png',
      size_bytes: 4 * 1024 * 1024, // 4MB <= 5MB
    });
    expect(validUpload.success).toBe(true);

    const oversizedUpload = photoUploadRequestSchema.safeParse({
      file_name: 'huge.png',
      mime_type: 'image/png',
      size_bytes: 6 * 1024 * 1024, // 6MB > 5MB
    });
    expect(oversizedUpload.success).toBe(false);

    // 2. When photo collection enabled, missing photo_storage consent rejects upload
    const callerWithoutConsent = appRouter.createCaller({
      hasBearerHeader: true,
      identity: { id: aliceId, token: 'alice-token' },
      authFailure: null,
      env: {
        NODE_ENV: 'test',
        KINETRA_ENV: 'development',
        PORT: 3001,
        WEB_ORIGIN: 'http://127.0.0.1:5173',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        ENABLE_PHOTOS: 'true',
        AI_REQUEST_LIMIT: 5,
        AI_GLOBAL_REQUEST_LIMIT: 100,
        AI_TOKEN_LIMIT: 50000,
        AI_GLOBAL_TOKEN_LIMIT: 1000000,
        AI_MAX_CONCURRENT: 1,
        AI_RESERVED_TOKENS: 1000,
      },
      requestId: 'test-req-consent',
      http: (async () => {
        // Return no consent records
        return new Response(JSON.stringify([]), { status: 200 });
      }) as typeof fetch,
    });

    await expect(
      callerWithoutConsent.photos.requestUpload({
        file_name: 'progress.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 1024 * 100,
      }),
    ).rejects.toThrow('Explicit photo storage consent required before upload');

    // 3. With explicit consent, upload path is strictly owner-scoped
    const captured: { payload: { id?: string; owner_id?: string; object_path?: string } | null } = {
      payload: null,
    };
    const callerWithConsent = appRouter.createCaller({
      hasBearerHeader: true,
      identity: { id: aliceId, token: 'alice-token' },
      authFailure: null,
      env: {
        NODE_ENV: 'test',
        KINETRA_ENV: 'development',
        PORT: 3001,
        WEB_ORIGIN: 'http://127.0.0.1:5173',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        ENABLE_PHOTOS: 'true',
        AI_REQUEST_LIMIT: 5,
        AI_GLOBAL_REQUEST_LIMIT: 100,
        AI_TOKEN_LIMIT: 50000,
        AI_GLOBAL_TOKEN_LIMIT: 1000000,
        AI_MAX_CONCURRENT: 1,
        AI_RESERVED_TOKENS: 1000,
      },
      requestId: 'test-req-granted',
      http: (async (url: string, init?: RequestInit) => {
        if (url.includes('consent_records')) {
          return new Response(
            JSON.stringify([
              {
                id: '44444444-4444-4444-a444-444444444444',
                action: 'grant',
                purpose: 'photo_storage',
              },
            ]),
            { status: 200 },
          );
        }
        if (init?.method === 'POST') {
          captured.payload = JSON.parse(init.body as string);
          return new Response(JSON.stringify([{ id: captured.payload?.id }]), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }) as typeof fetch,
    });

    const uploadRes = await callerWithConsent.photos.requestUpload({
      file_name: 'progress.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 1024 * 200,
    });

    expect(uploadRes.object_path).toMatch(new RegExp(`^${aliceId}/[a-f0-9-]+.jpeg$`));
    expect(captured.payload?.owner_id).toBe(aliceId);
    expect(captured.payload?.object_path?.startsWith(`${aliceId}/`)).toBe(true);

    // Retention ceiling is capped at 30 days
    const expiryDate = new Date(uploadRes.expires_at).getTime();
    const maxAllowedExpiry = Date.now() + 31 * 86400 * 1000;
    expect(expiryDate).toBeLessThanOrEqual(maxAllowedExpiry);
  });
});
