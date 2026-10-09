import 'fake-indexeddb/auto';
import type { LogRecord, LogUpdate, ProfileRecord } from '../packages/contracts/src/index';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAccountData,
  enqueueAtomicMutation,
  getAccountDatabase,
  getConflicts,
  getPendingMutations,
  KinetraDatabase,
  OfflineFirstRepositories,
  type RemoteSyncClient,
  SyncEngine,
} from '../apps/web/src/offline';

describe('Phase 6 — Offline Lifecycle & Resilient Data Sync', () => {
  const aliceId = '11111111-1111-1111-1111-111111111111';
  const bobId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    await clearAccountData(aliceId);
    await clearAccountData(bobId);
  });

  it('P6-01: Account-scoped IndexedDB caches isolate data and wipe cleanly on logout', async () => {
    const dbAlice = getAccountDatabase(aliceId);
    const dbBob = getAccountDatabase(bobId);

    // Alice stores a profile
    const aliceProfile: ProfileRecord = {
      owner_id: aliceId,
      display_name: 'Alice Wonder',
      height_cm: 170,
      weight_kg: 65,
      goal: 'cut',
      timezone: 'Europe/London',
      units: 'metric',
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await dbAlice.profiles.put(aliceProfile);

    // Verify Bob cannot read Alice's cached profile
    const bobProfiles = await dbBob.profiles.toArray();
    expect(bobProfiles).toHaveLength(0);

    const aliceProfiles = await dbAlice.profiles.toArray();
    expect(aliceProfiles).toHaveLength(1);
    expect(aliceProfiles[0]?.display_name).toBe('Alice Wonder');

    // Wipe Alice's data on logout
    await clearAccountData(aliceId);
    const dbAliceAfterLogout = new KinetraDatabase(aliceId);
    const afterLogout = await dbAliceAfterLogout.profiles.toArray();
    expect(afterLogout).toHaveLength(0);
    dbAliceAfterLogout.close();
  });

  it('P6-01: Schema versioning and migration', async () => {
    const testDb = new KinetraDatabase('migration-test-user');
    await testDb.daily_logs.put({
      id: 'log-1',
      owner_id: 'migration-test-user',
      local_date: '2026-10-01',
      timezone: 'UTC',
      weight_kg: 70,
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Test upgrading schema to version 2
    testDb.upgradeToVersion2();
    await testDb.open();
    const records = await testDb.daily_logs.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]?.weight_kg).toBe(70);
    testDb.close();
    await clearAccountData('migration-test-user');
  });

  it('P6-02: Atomic outbox saves local cache and queued mutation in one transaction', async () => {
    const db = getAccountDatabase(aliceId);

    const logUpdate: LogUpdate = {
      expected_revision: 1,
      local_date: '2026-10-09',
      timezone: 'America/New_York',
      weight: { value: 68.5, unit: 'kg' },
      calories: 2200,
      protein_g: 150,
      carbs_g: 220,
      fat_g: 65,
    };

    const optimisticRecord: LogRecord = {
      id: 'opt-log-1',
      owner_id: aliceId,
      local_date: logUpdate.local_date,
      timezone: logUpdate.timezone,
      weight_kg: 68.5,
      calories: 2200,
      protein_g: 150,
      carbs_g: 220,
      fat_g: 65,
      revision: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mutation = await enqueueAtomicMutation(
      db,
      db.daily_logs,
      {
        ownerId: aliceId,
        entity: 'log',
        entityId: '2026-10-09',
        operation: 'upsert',
        payload: logUpdate,
        baseRevision: 1,
      },
      optimisticRecord,
    );

    // Verify both local record and outbox item are present
    const cachedLog = await db.daily_logs.get('2026-10-09');
    expect(cachedLog).toBeDefined();
    expect(cachedLog?.weight_kg).toBe(68.5);

    const pending = await getPendingMutations(db, aliceId);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(mutation.id);
    expect(pending[0]?.baseRevision).toBe(1);
    expect(pending[0]?.state).toBe('queued');
  });

  it('P6-03: Safe synchronization replays mutations in order and handles transient network errors', async () => {
    const db = getAccountDatabase(aliceId);

    const savedRemoteLogs: LogRecord[] = [];
    let shouldFail = true;

    const mockRemote: RemoteSyncClient = {
      saveProfile: async () => {
        throw new Error('Not used');
      },
      getProfile: async () => null,
      saveLog: async (rev, log) => {
        if (shouldFail) {
          throw new Error('Network error: connection lost');
        }
        const record: LogRecord = {
          id: `remote-${log.local_date}`,
          owner_id: aliceId,
          local_date: log.local_date,
          timezone: log.timezone,
          weight_kg: log.weight.value,
          revision: rev + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        savedRemoteLogs.push(record);
        return record;
      },
      getLogs: async () => savedRemoteLogs,
    };

    const syncEngine = new SyncEngine(db, aliceId, mockRemote);

    // Enqueue two daily log mutations
    await enqueueAtomicMutation(
      db,
      db.daily_logs,
      {
        ownerId: aliceId,
        entity: 'log',
        entityId: '2026-10-08',
        operation: 'upsert',
        payload: {
          expected_revision: 0,
          local_date: '2026-10-08',
          timezone: 'UTC',
          weight: { value: 70, unit: 'kg' },
        },
        baseRevision: 0,
      },
      {
        id: '1',
        owner_id: aliceId,
        local_date: '2026-10-08',
        timezone: 'UTC',
        weight_kg: 70,
        revision: 1,
        created_at: '',
        updated_at: '',
      },
    );

    await enqueueAtomicMutation(
      db,
      db.daily_logs,
      {
        ownerId: aliceId,
        entity: 'log',
        entityId: '2026-10-09',
        operation: 'upsert',
        payload: {
          expected_revision: 0,
          local_date: '2026-10-09',
          timezone: 'UTC',
          weight: { value: 69.8, unit: 'kg' },
        },
        baseRevision: 0,
      },
      {
        id: '2',
        owner_id: aliceId,
        local_date: '2026-10-09',
        timezone: 'UTC',
        weight_kg: 69.8,
        revision: 1,
        created_at: '',
        updated_at: '',
      },
    );

    // Attempt 1: Fails with transient network error
    await syncEngine.sync();
    let pending = await getPendingMutations(db, aliceId);
    expect(pending.length).toBe(2);
    const failedItem = pending.find((p) => p.attempts === 1);
    expect(failedItem).toBeDefined();
    expect(failedItem?.state).toBe('failed');

    // Attempt 2: Network recovers
    shouldFail = false;
    await syncEngine.setOnline(true);

    pending = await getPendingMutations(db, aliceId);
    expect(pending.length).toBe(0);
    expect(savedRemoteLogs.length).toBe(2);

    const status = await syncEngine.getStatus();
    expect(status.pendingCount).toBe(0);
    expect(status.lastSyncedAt).not.toBeNull();
  });

  it('P6-04: Resolves cross-device conflicts without silent data loss', async () => {
    const db = getAccountDatabase(aliceId);

    // Server currently has revision 2 for 2026-10-09 (edited by another device)
    const serverLog: LogRecord = {
      id: 'server-log-1',
      owner_id: aliceId,
      local_date: '2026-10-09',
      timezone: 'UTC',
      weight_kg: 68.0,
      revision: 2,
      created_at: '2026-10-09T08:00:00Z',
      updated_at: '2026-10-09T09:00:00Z',
    };

    let serverCurrentRevision = 2;
    let finalSavedWeight: number | null = null;

    const mockRemote: RemoteSyncClient = {
      saveProfile: async () => {
        throw new Error('Not used');
      },
      getProfile: async () => null,
      saveLog: async (rev, log) => {
        if (rev !== serverCurrentRevision) {
          // Reject with revision conflict 409
          throw new Error('Revision conflict: Changed elsewhere');
        }
        serverCurrentRevision += 1;
        finalSavedWeight = log.weight.value;
        return {
          id: 'server-log-1',
          owner_id: aliceId,
          local_date: log.local_date,
          timezone: log.timezone,
          weight_kg: log.weight.value,
          revision: serverCurrentRevision,
          created_at: serverLog.created_at,
          updated_at: new Date().toISOString(),
        };
      },
      getLogs: async () => [serverLog],
    };

    const syncEngine = new SyncEngine(db, aliceId, mockRemote);

    // This device edited 2026-10-09 offline based on revision 1 (weight: 69.5 kg)
    const localEdit: LogUpdate = {
      expected_revision: 1,
      local_date: '2026-10-09',
      timezone: 'UTC',
      weight: { value: 69.5, unit: 'kg' },
    };

    await enqueueAtomicMutation(
      db,
      db.daily_logs,
      {
        ownerId: aliceId,
        entity: 'log',
        entityId: '2026-10-09',
        operation: 'upsert',
        payload: localEdit,
        baseRevision: 1,
      },
      {
        id: 'local-1',
        owner_id: aliceId,
        local_date: '2026-10-09',
        timezone: 'UTC',
        weight_kg: 69.5,
        revision: 2,
        created_at: '',
        updated_at: '',
      },
    );

    // Sync triggers conflict
    await syncEngine.sync();

    const conflicts = await getConflicts(db, aliceId);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.state).toBe('conflict');

    // Local edit was NOT silently lost!
    const localCached = await db.daily_logs.get('2026-10-09');
    expect(localCached?.weight_kg).toBe(69.5);

    // Remote record was captured for review
    const capturedRemote = conflicts[0]?.conflictRecord as LogRecord;
    expect(capturedRemote?.weight_kg).toBe(68.0);
    expect(capturedRemote?.revision).toBe(2);

    // User chooses: "Keep My Local Version"
    const targetConflictId = conflicts[0]?.id;
    expect(targetConflictId).toBeDefined();
    await syncEngine.resolveConflict(targetConflictId as string, 'keep_local', 2);

    // Replay with new base revision succeeds on the server!
    const conflictsAfterResolve = await getConflicts(db, aliceId);
    expect(conflictsAfterResolve).toHaveLength(0);
    expect(finalSavedWeight).toBe(69.5);
  });

  it('P6-05: OfflineFirstRepositories exposes responsive local reads and background synchronization', async () => {
    const db = getAccountDatabase(aliceId);

    const savedLogs: LogRecord[] = [];
    const mockRemote: RemoteSyncClient = {
      saveProfile: async () => {
        throw new Error('Not used');
      },
      getProfile: async () => null,
      saveLog: async (rev, log) => {
        const rec: LogRecord = {
          id: `log-${log.local_date}`,
          owner_id: aliceId,
          local_date: log.local_date,
          timezone: log.timezone,
          weight_kg: log.weight.value,
          revision: rev + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        savedLogs.push(rec);
        return rec;
      },
      getLogs: async () => savedLogs,
    };

    const repos = new OfflineFirstRepositories({
      db,
      ownerId: aliceId,
      remote: mockRemote,
    });

    // Save a log via repository interface
    const logResult = await repos.logs.saveLog(0, {
      expected_revision: 0,
      local_date: '2026-10-09',
      timezone: 'UTC',
      weight: { value: 72.4, unit: 'kg' },
    });

    expect(logResult.weight_kg).toBe(72.4);

    // Immediately readable from local cache
    const listed = await repos.logs.listLogs();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.weight_kg).toBe(72.4);
  });
});
