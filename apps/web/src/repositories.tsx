import type {
  ExportData,
  FeatureRepositories,
  HistoryRepository,
  LogRecord,
  LogsRepository,
  LogUpdate,
  OutboxMutation,
  PlanGenerationInput,
  PlanGenerationResult,
  PlanWithVersion,
  PlansRepository,
  Profile,
  ProfileRecord,
  ProfileRepository,
  SyncStatus,
  TrainingSessionRecord,
} from '@kinetra/contracts';
import { createDemoRepositories } from '@kinetra/domain';
import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { rpc } from './client';
import {
  getAccountDatabase,
  getConflicts,
  OfflineFirstRepositories,
  type RemoteSyncClient,
} from './offline';

export class ApiRepositories implements FeatureRepositories {
  readonly isDemo = false;

  readonly profile: ProfileRepository = {
    getProfile: async (): Promise<ProfileRecord | null> => {
      const result = await rpc.profile.read.query();
      return result as ProfileRecord | null;
    },
    saveProfile: async (expectedRevision: number, profile: Profile): Promise<ProfileRecord> => {
      const result = await rpc.profile.save.mutate({
        expected_revision: expectedRevision,
        profile,
      });
      return result as ProfileRecord;
    },
  };

  readonly logs: LogsRepository = {
    listLogs: async (limit = 100): Promise<LogRecord[]> => {
      const result = await rpc.logs.list.query();
      return (result as LogRecord[]).slice(0, limit);
    },
    saveLog: async (expectedRevision: number, log: LogUpdate): Promise<LogRecord> => {
      const result = await rpc.logs.save.mutate({
        expected_revision: expectedRevision,
        local_date: log.local_date,
        timezone: log.timezone,
        weight: log.weight,
      });
      return result as LogRecord;
    },
    deleteLog: async (_localDate: string): Promise<void> => {
      return;
    },
  };

  readonly plans: PlansRepository = {
    getPlan: async (): Promise<PlanWithVersion | null> => {
      return null;
    },
    listPlans: async (): Promise<PlanWithVersion[]> => {
      return [];
    },
    generatePlan: async (input: PlanGenerationInput): Promise<PlanGenerationResult> => {
      const result = await rpc.plans.generate.mutate(input);
      return result as PlanGenerationResult;
    },
  };

  readonly history: HistoryRepository = {
    listSessions: async (): Promise<TrainingSessionRecord[]> => {
      return [];
    },
    getSession: async (): Promise<TrainingSessionRecord | null> => {
      return null;
    },
  };
}

export interface RepositoryContextValue {
  repositories: FeatureRepositories;
  activePersonaId: 'maya' | 'marcus';
  setPersona: (id: 'maya' | 'marcus') => void;
  resetDemo: () => Promise<void>;
  isDemoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  syncStatus: SyncStatus;
  triggerSync: () => Promise<void>;
  conflicts: OutboxMutation[];
  resolveConflict: (
    mutationId: string,
    resolution: 'keep_local' | 'keep_remote',
    remoteRevision: number,
    remoteRecord?: unknown,
  ) => Promise<void>;
  exportData: () => Promise<ExportData>;
  deleteAccount: (confirmation: 'DELETE_MY_ACCOUNT') => Promise<{ records_purged: number }>;
}

const defaultSyncStatus: SyncStatus = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: new Date().toISOString(),
  error: null,
};

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function RepositoryProvider({
  children,
  initialPersona = 'maya',
}: {
  children: React.ReactNode;
  initialPersona?: 'maya' | 'marcus';
}) {
  const [isDemoMode, setDemoMode] = useState<boolean>(true);
  const [activePersonaId, setActivePersonaId] = useState<'maya' | 'marcus'>(initialPersona);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(defaultSyncStatus);
  const [conflicts, setConflicts] = useState<OutboxMutation[]>([]);

  // In-memory demo repository instance
  const demoRepos = useMemo(() => createDemoRepositories(activePersonaId), [activePersonaId]);

  // Offline-first repository instance for authenticated / real use
  const offlineRepos = useMemo(() => {
    const ownerId = `user-${activePersonaId}`;
    const db = getAccountDatabase(ownerId);
    const remoteClient: RemoteSyncClient = {
      getProfile: async () => (await rpc.profile.read.query()) as ProfileRecord | null,
      saveProfile: async (rev, prof) =>
        (await rpc.profile.save.mutate({
          expected_revision: rev,
          profile: prof,
        })) as ProfileRecord,
      getLogs: async () => (await rpc.logs.list.query()) as LogRecord[],
      saveLog: async (rev, log) =>
        (await rpc.logs.save.mutate({
          expected_revision: rev,
          local_date: log.local_date,
          timezone: log.timezone,
          weight: log.weight,
        })) as LogRecord,
    };

    return new OfflineFirstRepositories({
      db,
      ownerId,
      remote: remoteClient,
      plansRemote: {
        getPlan: async () => null,
        listPlans: async () => [],
        generatePlan: async (input) =>
          (await rpc.plans.generate.mutate(input)) as PlanGenerationResult,
      },
    });
  }, [activePersonaId]);

  // Subscribe to offline sync engine status
  useEffect(() => {
    if (isDemoMode) {
      setSyncStatus({
        isOnline: true,
        isSyncing: false,
        pendingCount: 0,
        conflictCount: 0,
        lastSyncedAt: 'Synthetic demo',
        error: null,
      });
      setConflicts([]);
      return;
    }

    const unsubscribe = offlineRepos.syncEngine.subscribe((status) => {
      setSyncStatus(status);
      const db = getAccountDatabase(`user-${activePersonaId}`);
      void getConflicts(db, `user-${activePersonaId}`).then(setConflicts);
    });

    return unsubscribe;
  }, [isDemoMode, offlineRepos, activePersonaId]);

  const [_revisionTrigger, setRevisionTrigger] = useState(0);

  const activeRepositories: FeatureRepositories = useMemo(() => {
    if (!isDemoMode) return offlineRepos;
    return demoRepos;
  }, [isDemoMode, demoRepos, offlineRepos]);

  const value: RepositoryContextValue = {
    repositories: activeRepositories,
    activePersonaId,
    setPersona: (id: 'maya' | 'marcus') => {
      setActivePersonaId(id);
      demoRepos.setPersona(id);
      setRevisionTrigger((prev) => prev + 1);
    },
    resetDemo: async () => {
      await demoRepos.resetDemo();
      setRevisionTrigger((prev) => prev + 1);
    },
    isDemoMode,
    setDemoMode,
    syncStatus,
    triggerSync: async () => {
      if (!isDemoMode) {
        await offlineRepos.syncEngine.sync();
      }
    },
    conflicts,
    resolveConflict: async (mutationId, resolution, remoteRevision, remoteRecord) => {
      if (!isDemoMode) {
        await offlineRepos.syncEngine.resolveConflict(
          mutationId,
          resolution,
          remoteRevision,
          remoteRecord,
        );
        const db = getAccountDatabase(`user-${activePersonaId}`);
        setConflicts(await getConflicts(db, `user-${activePersonaId}`));
      }
    },
    exportData: async (): Promise<ExportData> => {
      if (!isDemoMode) {
        const result = await rpc.user.exportData.query();
        return result as ExportData;
      }
      // Synthetic demo export matching export schema
      const prof = await demoRepos.profile.getProfile();
      const logs = await demoRepos.logs.listLogs();
      const plan = await demoRepos.plans.getPlan('workout');
      return {
        schema_version: '2026-10-01',
        exported_at: new Date().toISOString(),
        account_id: '00000000-0000-0000-0000-000000000001',
        policy_version: '2026-10-01',
        profile: prof,
        daily_logs: logs,
        training_sessions: [],
        plans: plan ? [{ ...plan.plan, pinned_version: 1, updated_at: plan.plan.created_at }] : [],
        plan_versions: plan ? [plan.current_version] : [],
        consent_records: [],
        photo_metadata: [],
      };
    },
    deleteAccount: async (confirmation) => {
      if (!isDemoMode) {
        const res = await rpc.user.deleteAccount.mutate({ confirmation });
        return res as { records_purged: number };
      }
      await demoRepos.resetDemo();
      return { records_purged: 4 };
    },
  };

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepositories(): FeatureRepositories {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepositories must be used within a RepositoryProvider');
  return ctx.repositories;
}

export function useRepositoryControls(): RepositoryContextValue {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepositoryControls must be used within a RepositoryProvider');
  return ctx;
}
