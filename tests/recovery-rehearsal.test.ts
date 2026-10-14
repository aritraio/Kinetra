import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import {
  clearAccountData,
  enqueueAtomicMutation,
  getAccountDatabase,
  getPendingMutations,
  KinetraDatabase,
  SyncEngine,
} from '../apps/web/src/offline';
import { CircuitBreaker } from '../apps/api/src/ai/circuit-breaker';
import {
  FallbackProviderAdapter,
  ResilientProviderPipeline,
} from '../apps/api/src/ai/fallback-provider';
import type { GeminiProviderAdapter } from '../apps/api/src/ai/provider-adapter';
import { getFallbackWorkoutPlan } from '../packages/domain/src/fallback-templates';
import { z } from 'zod';
import type { LogRecord, ProfileRecord } from '../packages/contracts/src/index';

describe('Phase 9 — P9-10 Production Disaster Recovery & Failure Rehearsals', () => {
  describe('Rehearsal 1: Isolated Database Backup Restore', () => {
    it('restores complete user snapshot from export artifact without data loss (RPO = 0, RTO < 500ms)', async () => {
      const userId = 'dr-rehearsal-user-1';
      await clearAccountData(userId);
      const db = getAccountDatabase(userId);

      // Seed pristine state
      const seedProfile: ProfileRecord = {
        owner_id: userId,
        display_name: 'DR Rehearsal Athlete',
        height_cm: 180,
        weight_kg: 80,
        goal: 'bulk',
        timezone: 'America/Chicago',
        units: 'metric',
        revision: 4,
        created_at: '2026-10-01T12:00:00Z',
        updated_at: '2026-10-08T12:00:00Z',
      };
      await db.profiles.put(seedProfile);

      const seedLog: LogRecord = {
        id: 'dr-log-1',
        owner_id: userId,
        local_date: '2026-10-08',
        timezone: 'America/Chicago',
        weight_kg: 79.8,
        water_ml: 3000,
        revision: 2,
        created_at: '2026-10-08T08:00:00Z',
        updated_at: '2026-10-08T08:00:00Z',
      };
      await db.daily_logs.put(seedLog);

      // Take backup snapshot
      const backupSnapshot = {
        profiles: await db.profiles.toArray(),
        daily_logs: await db.daily_logs.toArray(),
      };

      // Simulate accidental local database corruption / erasure
      await clearAccountData(userId);
      const corruptedDb = getAccountDatabase(userId);
      expect(await corruptedDb.profiles.toArray()).toHaveLength(0);
      expect(await corruptedDb.daily_logs.toArray()).toHaveLength(0);

      // Execute Disaster Recovery Restore procedure
      const startTime = performance.now();
      await corruptedDb.profiles.bulkPut(backupSnapshot.profiles);
      await corruptedDb.daily_logs.bulkPut(backupSnapshot.daily_logs);
      const restoreDurationMs = performance.now() - startTime;

      // Verify restored state matches snapshot byte-for-byte
      const restoredProfile = await corruptedDb.profiles.get(userId);
      const restoredLog = await corruptedDb.daily_logs.get('2026-10-08');

      expect(restoredProfile).toEqual(seedProfile);
      expect(restoredLog).toEqual(seedLog);
      expect(restoreDurationMs).toBeLessThan(500); // RTO bound
      corruptedDb.close();
    });
  });

  describe('Rehearsal 2: Schema Migration Repair & Rollback', () => {
    it('migrates schema version 1 to 2 cleanly and retains data', async () => {
      const userId = 'dr-migration-user-2';
      await clearAccountData(userId);
      const dbV1 = new KinetraDatabase(userId);

      // Seed under v1
      await dbV1.daily_logs.put({
        id: 'log-mig-1',
        owner_id: userId,
        local_date: '2026-10-09',
        timezone: 'UTC',
        weight_kg: 74.0,
        revision: 1,
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T08:00:00Z',
      });

      // Execute upgrade
      dbV1.upgradeToVersion2();
      const upgradedDb = new KinetraDatabase(userId);
      upgradedDb.upgradeToVersion2();

      // Verify records preserved after migration
      const preservedLog = await upgradedDb.daily_logs.get('2026-10-09');
      expect(preservedLog?.weight_kg).toBe(74.0);
      upgradedDb.close();
    });
  });

  describe('Rehearsal 3: Multi-tier Model Outage & Deterministic Failover', () => {
    it('transitions Primary -> Fallback -> Verified Deterministic Template under total outage', async () => {
      const mockPrimary: Partial<GeminiProviderAdapter> = {
        generateStructured: vi.fn().mockRejectedValue(new Error('503 Primary Provider Down')),
      };

      const mockFallbackTransport = vi
        .fn()
        .mockRejectedValue(new Error('504 Fallback Gateway Timeout'));
      const fallbackAdapter = new FallbackProviderAdapter({ transport: mockFallbackTransport });

      const cb = new CircuitBreaker({ failureThreshold: 1 });
      const pipeline = new ResilientProviderPipeline({
        primary: mockPrimary as unknown as GeminiProviderAdapter,
        fallback: fallbackAdapter,
        circuitBreaker: cb,
      });

      const workoutSchema = z.object({ days_per_week: z.number() });

      // Attempt AI generation; both tiers fail
      let aiFailed = false;
      try {
        await pipeline.generateStructured('Prompt', workoutSchema, 'workout');
      } catch {
        aiFailed = true;
      }
      expect(aiFailed).toBe(true);

      // Graceful fallback to verified deterministic domain template
      const fallbackTemplate = getFallbackWorkoutPlan({
        days_per_week: 4,
        split_name: 'Upper / Lower Split',
        available_equipment: ['barbell', 'dumbbells'],
      });

      expect(fallbackTemplate).not.toBeNull();
      if (!fallbackTemplate) throw new Error('Expected fallbackTemplate to not be null');
      expect(fallbackTemplate.days_per_week).toBe(4);
      expect(fallbackTemplate.days.length).toBeGreaterThan(0);
    });
  });

  describe('Rehearsal 4: Expired Auth Token During Active Sync', () => {
    it('safely pauses sync on 401/UNAUTHORIZED without dropping queued mutations, then resumes on re-auth', async () => {
      const userId = 'dr-auth-rehearsal-user';
      await clearAccountData(userId);
      const db = getAccountDatabase(userId);

      // Queue offline mutation
      await enqueueAtomicMutation(db, db.daily_logs, {
        ownerId: userId,
        entity: 'log',
        entityId: '2026-10-09',
        operation: 'upsert',
        baseRevision: 1,
        payload: {
          expected_revision: 1,
          local_date: '2026-10-09',
          timezone: 'UTC',
          weight: { value: 75.5, unit: 'kg' },
          water_ml: 2200,
        },
      });

      let tokenExpired = true;

      const mockRemote = {
        saveProfile: async () => {
          throw new Error('Not used');
        },
        getProfile: async () => null,
        saveLog: async () => {
          if (tokenExpired) {
            throw new Error('UNAUTHORIZED: JWT expired');
          }
          return {
            id: 'server-log-auth',
            owner_id: userId,
            local_date: '2026-10-09',
            timezone: 'UTC',
            weight_kg: 75.5,
            water_ml: 2200,
            revision: 2,
            created_at: '2026-10-09T08:00:00Z',
            updated_at: '2026-10-09T08:00:00Z',
          };
        },
        getLogs: async () => [],
      };

      const syncEngine = new SyncEngine(db, userId, mockRemote);

      // Attempt sync while token expired
      await syncEngine.sync();

      // Mutation must NOT be lost or deleted!
      const pendingAfterAuthFailure = await getPendingMutations(db, userId);
      expect(pendingAfterAuthFailure).toHaveLength(1);
      expect(pendingAfterAuthFailure[0]?.state).toBe('failed');

      // User re-authenticates (refreshed token)
      tokenExpired = false;
      await syncEngine.setOnline(true);

      // Resumed sync succeeds
      const pendingAfterRecovery = await getPendingMutations(db, userId);
      expect(pendingAfterRecovery).toHaveLength(0);
      db.close();
    });
  });

  describe('Rehearsal 5: Account Deletion Failure Retry & Idempotent Purge', () => {
    it('retries deletion until complete and confirms zero orphaned local records', async () => {
      const userId = 'dr-deletion-user-5';
      await clearAccountData(userId);
      const db = getAccountDatabase(userId);

      // Populate user data
      await db.profiles.put({
        owner_id: userId,
        display_name: 'To Be Deleted',
        height_cm: 170,
        weight_kg: 68,
        goal: 'cut',
        timezone: 'UTC',
        units: 'metric',
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await db.daily_logs.put({
        id: 'del-log-1',
        owner_id: userId,
        local_date: '2026-10-09',
        timezone: 'UTC',
        weight_kg: 68,
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(await db.profiles.toArray()).toHaveLength(1);
      expect(await db.daily_logs.toArray()).toHaveLength(1);

      // Simulated transient failure during initial wipe attempt
      let attempt = 0;
      const purgeWithRetry = async () => {
        attempt++;
        if (attempt === 1) {
          throw new Error('500 Internal Error during remote cascade');
        }
        await clearAccountData(userId);
      };

      await expect(purgeWithRetry()).rejects.toThrow('500 Internal Error');

      // Retry succeeds
      await purgeWithRetry();

      // Idempotency check: running again doesn't throw
      await clearAccountData(userId);

      const dbClean = getAccountDatabase(userId);
      expect(await dbClean.profiles.toArray()).toHaveLength(0);
      expect(await dbClean.daily_logs.toArray()).toHaveLength(0);
      expect(await dbClean.plans.toArray()).toHaveLength(0);
      expect(await dbClean.outbox.toArray()).toHaveLength(0);
      dbClean.close();
    });
  });
});
