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
  getProgressionProposal?(planId?: string): Promise<import('./progression').ProgressionProposal>;
  applyProgressionProposal?(
    proposal: import('./progression').ProgressionProposal,
    acceptedExerciseIds?: string[],
  ): Promise<PlanWithVersion>;
  createShareGrant(
    input: import('./plans').CreateShareGrantInput,
  ): Promise<import('./plans').PlanShareGrant>;
  revokeShareGrant(grantId: string): Promise<void>;
  listShareGrants(planId?: string): Promise<import('./plans').PlanShareGrant[]>;
  getSharedPlan(token: string): Promise<import('./plans').SharedPlanView>;
}

export interface PhotosRepository {
  listPhotos(): Promise<
    Array<{
      id: string;
      url: string;
      captured_at: string;
      expires_at: string;
      notes?: string | undefined;
    }>
  >;
  savePhoto(photo: {
    id: string;
    url: string;
    captured_at: string;
    notes?: string | undefined;
  }): Promise<void>;
  deletePhoto(id: string): Promise<void>;
  getConsent(): Promise<boolean>;
  setConsent(granted: boolean): Promise<void>;
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
  readonly photos?: PhotosRepository;
  readonly isDemo: boolean;
  resetDemo?(): Promise<void>;
}
