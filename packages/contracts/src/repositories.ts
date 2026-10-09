import type { LogRecord, LogUpdate, Profile, ProfileRecord } from './account';
import type {
  PlanGenerationInput,
  PlanGenerationResult,
  PlanKind,
  PlanVersionRecord,
  PlanWithVersion,
} from './plans';
import type { TrainingSessionRecord } from './sessions';

export interface ProfileRepository {
  getProfile(): Promise<ProfileRecord | null>;
  saveProfile(expectedRevision: number, profile: Profile): Promise<ProfileRecord>;
}

export interface LogsRepository {
  listLogs(limit?: number): Promise<LogRecord[]>;
  saveLog(expectedRevision: number, log: LogUpdate): Promise<LogRecord>;
  deleteLog(localDate: string): Promise<void>;
}

export interface PlansRepository {
  getPlan(kind: PlanKind): Promise<PlanWithVersion | null>;
  listPlans(): Promise<PlanWithVersion[]>;
  listPlanVersions?(kind: PlanKind): Promise<PlanVersionRecord[]>;
  pinPlanVersion?(kind: PlanKind, version: number): Promise<PlanWithVersion>;
  generatePlan?(input: PlanGenerationInput): Promise<PlanGenerationResult>;
}

export interface HistoryRepository {
  listSessions(limit?: number): Promise<TrainingSessionRecord[]>;
  getSession(id: string): Promise<TrainingSessionRecord | null>;
}

export interface FeatureRepositories {
  readonly profile: ProfileRepository;
  readonly logs: LogsRepository;
  readonly plans: PlansRepository;
  readonly history: HistoryRepository;
  readonly isDemo: boolean;
  resetDemo?(): Promise<void>;
}
