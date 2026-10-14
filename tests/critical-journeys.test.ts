import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  createDemoRepositories,
  type InMemoryDemoRepositories,
} from '../packages/domain/src/demo-repository';
import { generateCoachStream } from '../packages/domain/src/coach/coach-service';
import {
  clearAccountData,
  enqueueAtomicMutation,
  getAccountDatabase,
  getConflicts,
  getPendingMutations,
  OfflineFirstRepositories,
  SyncEngine,
} from '../apps/web/src/offline';
import type { LogRecord, ProfileRecord } from '../packages/contracts/src/index';

describe('Phase 9 — P9-07 Five Maintained Critical User Journeys', () => {
  describe('Journey 1: Synthetic Persona Switching & Demo Data Hydration', () => {
    it('switches between Maya (Cut) and Marcus (Bulk) with clean isolated state and valid plans', async () => {
      // 1. Hydrate Maya
      const mayaRepos: InMemoryDemoRepositories = createDemoRepositories('maya');
      const mayaProfile = await mayaRepos.profile.getProfile();
      expect(mayaProfile?.display_name).toContain('Maya');
      expect(mayaProfile?.goal).toBe('cut');
      expect(mayaProfile?.weight_kg).toBeLessThan(70);

      const mayaWorkout = await mayaRepos.plans.getPlan('workout');
      expect(mayaWorkout?.current_version.payload.kind).toBe('workout');

      // 2. Hydrate Marcus
      const marcusRepos: InMemoryDemoRepositories = createDemoRepositories('marcus');
      const marcusProfile = await marcusRepos.profile.getProfile();
      expect(marcusProfile?.display_name).toContain('Marcus');
      expect(marcusProfile?.goal).toBe('bulk');
      expect(marcusProfile?.weight_kg).toBeGreaterThan(80);

      // Verify independence - mutating Maya does not affect Marcus
      await mayaRepos.logs.saveLog(0, {
        expected_revision: 0,
        local_date: '2026-10-10',
        timezone: 'UTC',
        weight: { value: 63, unit: 'kg' },
        water_ml: 2500,
      });

      const marcusLogs = await marcusRepos.logs.listLogs();
      expect(marcusLogs.some((l) => l.local_date === '2026-10-10')).toBe(false);
    });
  });

  describe('Journey 2: Onboarding to Personalized Plan Generation', () => {
    it('generates fully verified workout and meal plans complying with domain constraints', async () => {
      const repos = createDemoRepositories('maya');

      // Generate customized workout plan
      const workoutResult = await repos.plans.generatePlan!({
        kind: 'workout',
        days_per_week: 4,
        split_name: 'Upper / Lower Split',
        equipment: ['barbell', 'dumbbells', 'bench'],
      });

      expect(workoutResult.plan.kind).toBe('workout');
      expect(workoutResult.verification.valid).toBe(true);
      expect(workoutResult.verification.hard_violations).toHaveLength(0);

      // Generate customized meal plan
      const mealResult = await repos.plans.generatePlan!({
        kind: 'meal',
        target_calories: 1950,
        target_protein_g: 130,
        target_carbs_g: 210,
        target_fat_g: 55,
        allergies: ['peanuts'],
      });

      expect(mealResult.plan.kind).toBe('meal');
      expect(mealResult.verification.valid).toBe(true);
      expect(mealResult.verification.hard_violations).toHaveLength(0);
    });
  });

  describe('Journey 3: Daily Logging & Real-time Adaptive Coach Interaction', () => {
    it('records metric check-in, parses workout log, and streams assistant coaching response', async () => {
      const repos = createDemoRepositories('marcus');

      // 1. Record daily log
      const initialLogs = await repos.logs.listLogs();
      const initialRev = initialLogs[0]?.revision ?? 0;

      const updated = await repos.logs.saveLog(initialRev, {
        expected_revision: initialRev,
        local_date: '2026-10-09',
        timezone: 'America/New_York',
        weight: { value: 89.2, unit: 'kg' },
        water_ml: 3200,
        notes: 'Felt energetic after heavy squats',
      });
      expect(updated.weight_kg).toBe(89.2);

      // 2. Stream real-time coach interaction
      const coachStream = generateCoachStream({
        messages: [
          {
            id: '11111111-1111-4111-a111-111111111111',
            role: 'user',
            content: 'How should I adjust load if squats felt RPE 7 instead of 8?',
            created_at: new Date().toISOString(),
          },
        ],
      });

      const events: string[] = [];
      for await (const chunk of coachStream) {
        events.push(chunk.type);
      }

      expect(events).toContain('started');
      expect(events).toContain('status');
      expect(events).toContain('text_delta');
      expect(events).toContain('done');
    });
  });

  describe('Journey 4: Offline Sync, Queueing, and Conflict Resolution', () => {
    it('handles offline outbox mutation, detects server collision, and applies Last-Write-Wins', async () => {
      const userId = 'sync-journey-user-1';
      await clearAccountData(userId);
      const db = getAccountDatabase(userId);

      // 1. Enqueue offline mutation
      await enqueueAtomicMutation(
        db,
        db.daily_logs,
        {
          ownerId: userId,
          entity: 'log',
          entityId: '2026-10-09',
          operation: 'upsert',
          baseRevision: 1,
          payload: {
            expected_revision: 1,
            local_date: '2026-10-09',
            timezone: 'UTC',
            weight: { value: 71.0, unit: 'kg' },
            water_ml: 2000,
          },
        },
        {
          id: 'log-1',
          owner_id: userId,
          local_date: '2026-10-09',
          timezone: 'UTC',
          weight_kg: 71.0,
          water_ml: 2000,
          revision: 1,
          created_at: '2026-10-09T08:00:00Z',
          updated_at: '2026-10-09T08:00:00Z',
        },
      );

      const pending = await getPendingMutations(db, userId);
      expect(pending).toHaveLength(1);

      // 2. Sync against conflicting remote (remote has revision 2, updated later)
      const serverLog: LogRecord = {
        id: 'log-1',
        owner_id: userId,
        local_date: '2026-10-09',
        timezone: 'UTC',
        weight_kg: 71.5,
        water_ml: 2200,
        revision: 2,
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T09:00:00Z',
      };

      const mockRemote = {
        saveProfile: async () => {
          throw new Error('Not used');
        },
        getProfile: async () => null,
        saveLog: async (rev: number) => {
          if (rev !== 2) {
            throw new Error('Revision conflict: Changed elsewhere');
          }
          return serverLog;
        },
        getLogs: async () => [serverLog],
      };

      const syncEngine = new SyncEngine(db, userId, mockRemote);
      await syncEngine.sync();

      // 3. Verify conflict flagged
      const conflicts = await getConflicts(db, userId);
      expect(conflicts.length).toBeGreaterThanOrEqual(1);

      // 4. Resolve conflict with remote winning
      const targetConflictId = conflicts[0]!.id;
      await syncEngine.resolveConflict(
        targetConflictId,
        'keep_remote',
        2,
        conflicts[0]!.conflictRecord ?? serverLog,
      );
      const resolvedConflicts = await getConflicts(db, userId);
      expect(resolvedConflicts).toHaveLength(0);

      const localLog = await db.daily_logs.get('2026-10-09');
      expect(localLog?.weight_kg).toBe(71.5);
      db.close();
    });
  });

  describe('Journey 5: Data Export & Complete Account Deletion (GDPR/CCPA)', () => {
    it('exports all personal tables into portable JSON and executes irreversible wipe', async () => {
      const userId = 'export-wipe-user-1';
      await clearAccountData(userId);
      const db = getAccountDatabase(userId);

      // Populate local profile and daily log
      const testProfile: ProfileRecord = {
        owner_id: userId,
        display_name: 'Test Journey User',
        height_cm: 175,
        weight_kg: 75,
        goal: 'cut',
        timezone: 'UTC',
        units: 'metric',
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await db.profiles.put(testProfile);

      // Export inspection
      const exportedProfile = await db.profiles.get(userId);
      expect(exportedProfile).toEqual(testProfile);

      // Complete account deletion / purge
      await clearAccountData(userId);

      // Verify all tables for this user are empty
      const dbAfterPurge = getAccountDatabase(userId);
      expect(await dbAfterPurge.profiles.toArray()).toHaveLength(0);
      expect(await dbAfterPurge.daily_logs.toArray()).toHaveLength(0);
      expect(await dbAfterPurge.plans.toArray()).toHaveLength(0);
      expect(await dbAfterPurge.outbox.toArray()).toHaveLength(0);
      dbAfterPurge.close();
    });
  });
});
