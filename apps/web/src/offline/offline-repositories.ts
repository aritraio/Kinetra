import type {
  FeatureRepositories,
  HistoryRepository,
  LogRecord,
  LogsRepository,
  LogUpdate,
  PlanGenerationInput,
  PlanGenerationResult,
  PlanKind,
  PlanVersionRecord,
  PlanWithVersion,
  PlansRepository,
  Profile,
  ProfileRecord,
  ProfileRepository,
  ProgressionProposal,
  TrainingSessionRecord,
} from '@kinetra/contracts';
import {
  applyProgressionToWorkoutPlan,
  evaluateWorkoutProgression,
  weightInKg,
} from '@kinetra/domain';
import type { KinetraDatabase } from './db';
import { enqueueAtomicMutation } from './outbox';
import { type RemoteSyncClient, SyncEngine } from './sync';

export interface OfflineRepositoriesOptions {
  db: KinetraDatabase;
  ownerId: string;
  remote: RemoteSyncClient;
  plansRemote?: {
    getPlan(kind: PlanKind): Promise<PlanWithVersion | null>;
    listPlans(): Promise<PlanWithVersion[]>;
    generatePlan(input: PlanGenerationInput): Promise<PlanGenerationResult>;
  };
  historyRemote?: {
    listSessions(limit?: number): Promise<TrainingSessionRecord[]>;
    getSession(id: string): Promise<TrainingSessionRecord | null>;
  };
}

export class OfflineFirstRepositories implements FeatureRepositories {
  readonly isDemo = false;
  readonly syncEngine: SyncEngine;
  private db: KinetraDatabase;
  private ownerId: string;
  private remote: RemoteSyncClient;
  private plansRemote?: OfflineRepositoriesOptions['plansRemote'];
  private historyRemote?: OfflineRepositoriesOptions['historyRemote'];

  constructor(options: OfflineRepositoriesOptions) {
    this.db = options.db;
    this.ownerId = options.ownerId;
    this.remote = options.remote;
    this.plansRemote = options.plansRemote;
    this.historyRemote = options.historyRemote;

    this.syncEngine = new SyncEngine(this.db, this.ownerId, this.remote);
  }

  readonly profile: ProfileRepository = {
    getProfile: async (): Promise<ProfileRecord | null> => {
      // 1. Try local cache
      const cached = await this.db.profiles.where('owner_id').equals(this.ownerId).first();
      if (cached) return cached;

      // 2. Fetch from remote if available
      try {
        const remoteRecord = await this.remote.getProfile();
        if (remoteRecord) {
          await this.db.profiles.put(remoteRecord);
          return remoteRecord;
        }
      } catch {
        // Offline or remote unavailable
      }
      return null;
    },

    saveProfile: async (expectedRevision: number, profile: Profile): Promise<ProfileRecord> => {
      const now = new Date().toISOString();
      const localOptimistic: ProfileRecord = {
        ...profile,
        owner_id: this.ownerId,
        revision: expectedRevision + 1,
        created_at: now,
        updated_at: now,
      };

      // Atomic outbox + local cache write
      await enqueueAtomicMutation(
        this.db,
        this.db.profiles,
        {
          ownerId: this.ownerId,
          entity: 'profile',
          entityId: this.ownerId,
          operation: 'upsert',
          payload: profile,
          baseRevision: expectedRevision,
        },
        localOptimistic,
      );

      // Trigger background sync if online
      void this.syncEngine.sync();

      return localOptimistic;
    },
  };

  readonly logs: LogsRepository = {
    listLogs: async (limit = 100): Promise<LogRecord[]> => {
      // 1. Try local cache
      const cached = await this.db.daily_logs.toArray();
      if (cached.length > 0) {
        return cached.sort((a, b) => b.local_date.localeCompare(a.local_date)).slice(0, limit);
      }

      // 2. Try remote if cache is empty
      try {
        const remoteLogs = await this.remote.getLogs();
        if (remoteLogs.length > 0) {
          await this.db.daily_logs.bulkPut(remoteLogs);
          return remoteLogs.slice(0, limit);
        }
      } catch {
        // Offline or remote unavailable
      }

      return [];
    },

    saveLog: async (expectedRevision: number, log: LogUpdate): Promise<LogRecord> => {
      const now = new Date().toISOString();
      const localOptimistic: LogRecord = {
        id: crypto.randomUUID(),
        owner_id: this.ownerId,
        local_date: log.local_date,
        timezone: log.timezone,
        weight_kg: weightInKg(log.weight.value, log.weight.unit),
        calories: log.calories,
        protein_g: log.protein_g,
        carbs_g: log.carbs_g,
        fat_g: log.fat_g,
        water_ml: log.water_ml,
        notes: log.notes,
        revision: expectedRevision + 1,
        created_at: now,
        updated_at: now,
      };

      // Atomic outbox + local cache write
      await enqueueAtomicMutation(
        this.db,
        this.db.daily_logs,
        {
          ownerId: this.ownerId,
          entity: 'log',
          entityId: log.local_date,
          operation: 'upsert',
          payload: log,
          baseRevision: expectedRevision,
        },
        localOptimistic,
      );

      // Trigger background sync if online
      void this.syncEngine.sync();

      return localOptimistic;
    },

    deleteLog: async (localDate: string): Promise<void> => {
      await enqueueAtomicMutation(this.db, this.db.daily_logs, {
        ownerId: this.ownerId,
        entity: 'log',
        entityId: localDate,
        operation: 'delete',
        payload: { local_date: localDate },
        baseRevision: 0,
      });
      void this.syncEngine.sync();
    },
  };

  readonly plans: PlansRepository = {
    getPlan: async (kind: PlanKind): Promise<PlanWithVersion | null> => {
      const cached = await this.db.plans.get(kind);
      if (cached) return cached.data;
      if (this.plansRemote) {
        try {
          const remotePlan = await this.plansRemote.getPlan(kind);
          if (remotePlan) {
            await this.db.plans.put({
              kind,
              data: remotePlan,
              updated_at: new Date().toISOString(),
            });
            return remotePlan;
          }
        } catch {
          // Offline
        }
      }
      return null;
    },

    listPlans: async (): Promise<PlanWithVersion[]> => {
      const cached = await this.db.plans.toArray();
      if (cached.length > 0) return cached.map((c) => c.data);
      if (this.plansRemote) {
        try {
          const remotePlans = await this.plansRemote.listPlans();
          if (remotePlans.length > 0) {
            await this.db.plans.bulkPut(
              remotePlans.map((p) => ({
                kind: p.plan.kind,
                data: p,
                updated_at: new Date().toISOString(),
              })),
            );
            return remotePlans;
          }
        } catch {
          // Offline
        }
      }
      return [];
    },

    generatePlan: async (input: PlanGenerationInput): Promise<PlanGenerationResult> => {
      if (!this.plansRemote) {
        throw new Error('Plan generation unavailable offline');
      }
      return await this.plansRemote.generatePlan(input);
    },

    getProgressionProposal: async (): Promise<ProgressionProposal> => {
      const activeWorkout = await this.plans.getPlan('workout');
      if (activeWorkout?.current_version.payload.kind !== 'workout') {
        throw new Error('No active workout plan found for progression evaluation');
      }
      const history = await this.history.listSessions(100);
      const profile = await this.profile.getProfile();
      return evaluateWorkoutProgression({
        plan: activeWorkout,
        history,
        options: {
          preferredUnit: profile?.units === 'imperial' ? 'lb' : 'kg',
        },
      });
    },

    applyProgressionProposal: async (
      proposal: ProgressionProposal,
      acceptedExerciseIds?: string[],
    ): Promise<PlanWithVersion> => {
      const activeWorkout = await this.plans.getPlan('workout');
      if (activeWorkout?.current_version.payload.kind !== 'workout') {
        throw new Error('No active workout plan found to apply progression adjustments');
      }
      const workoutPayload = activeWorkout.current_version.payload;
      const { updatedPayload, verification } = applyProgressionToWorkoutPlan(
        workoutPayload,
        proposal,
        {
          acceptedExerciseIds: acceptedExerciseIds ? [...acceptedExerciseIds] : undefined,
          verificationProfile: {
            days_per_week: workoutPayload.days_per_week,
            split_name: workoutPayload.split_name,
          },
        },
      );
      if (!verification.valid) {
        throw new Error(
          `Progressed plan failed domain verification: ${verification.hard_violations.map((v) => v.message).join('; ')}`,
        );
      }
      const nextVersionNumber = activeWorkout.current_version.version + 1;
      const newVersionRecord: PlanVersionRecord = {
        plan_id: activeWorkout.plan.id,
        owner_id: activeWorkout.plan.owner_id,
        version: nextVersionNumber,
        payload: updatedPayload,
        schema_version: '2026-10-01',
        policy_version: '2026-10-01',
        prompt_version: 'v1.0-adaptive-progression',
        provenance: 'progression',
        created_at: new Date().toISOString(),
      };
      const updatedPlan: PlanWithVersion = {
        plan: {
          ...activeWorkout.plan,
          current_version: nextVersionNumber,
        },
        current_version: newVersionRecord,
      };
      await this.db.plans.put({
        kind: 'workout',
        data: updatedPlan,
        updated_at: new Date().toISOString(),
      });
      return updatedPlan;
    },
  };

  readonly history: HistoryRepository = {
    listSessions: async (limit = 100): Promise<TrainingSessionRecord[]> => {
      const cached = await this.db.sessions.toArray();
      if (cached.length > 0) {
        return cached.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit);
      }
      if (this.historyRemote) {
        try {
          const remoteSessions = await this.historyRemote.listSessions(limit);
          if (remoteSessions.length > 0) {
            await this.db.sessions.bulkPut(remoteSessions);
            return remoteSessions;
          }
        } catch {
          // Offline
        }
      }
      return [];
    },

    getSession: async (id: string): Promise<TrainingSessionRecord | null> => {
      const cached = await this.db.sessions.get(id);
      if (cached) return cached;
      if (this.historyRemote) {
        return await this.historyRemote.getSession(id);
      }
      return null;
    },
  };
}
