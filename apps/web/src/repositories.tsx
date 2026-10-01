import type {
  FeatureRepositories,
  HistoryRepository,
  LogRecord,
  LogsRepository,
  LogUpdate,
  PlansRepository,
  PlanWithVersion,
  Profile,
  ProfileRecord,
  ProfileRepository,
  TrainingSessionRecord,
} from '@kinetra/contracts';
import { createDemoRepositories } from '@kinetra/domain';
import type React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { rpc } from './client';

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
  };

  readonly plans: PlansRepository = {
    getPlan: async (): Promise<PlanWithVersion | null> => {
      // In Phase 3, server generation remains gated. Real accounts have no generated plans yet.
      return null;
    },
    listPlans: async (): Promise<PlanWithVersion[]> => {
      return [];
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
}

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

  // In-memory demo repository instance
  const demoRepos = useMemo(() => createDemoRepositories(activePersonaId), [activePersonaId]);

  const apiRepos = useMemo(() => new ApiRepositories(), []);

  const [_revisionTrigger, setRevisionTrigger] = useState(0);

  const activeRepositories: FeatureRepositories = useMemo(() => {
    if (!isDemoMode) return apiRepos;
    return demoRepos;
  }, [isDemoMode, demoRepos, apiRepos]);

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
