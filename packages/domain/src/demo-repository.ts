import type {
  FeatureRepositories,
  HistoryRepository,
  LogRecord,
  LogsRepository,
  LogUpdate,
  PlanKind,
  PlansRepository,
  PlanWithVersion,
  Profile,
  ProfileRecord,
  ProfileRepository,
  TrainingSessionRecord,
} from '@kinetra/contracts';
import { SYNTHETIC_PERSONAS, type SyntheticPersona } from './personas';
import { weightInKg } from './units';

export class InMemoryDemoRepositories implements FeatureRepositories {
  readonly isDemo = true;
  private currentPersonaId: 'maya' | 'marcus';
  private currentProfile: ProfileRecord;
  private currentLogs: LogRecord[];
  private currentPlans: Map<PlanKind, PlanWithVersion>;
  private currentHistory: TrainingSessionRecord[];

  constructor(initialPersona: 'maya' | 'marcus' = 'maya') {
    this.currentPersonaId = initialPersona;
    const persona = SYNTHETIC_PERSONAS[initialPersona];
    this.currentProfile = { ...persona.profile };
    this.currentLogs = persona.logs.map((log) => ({ ...log }));
    this.currentPlans = new Map([
      ['meal', persona.mealPlan],
      ['workout', persona.workoutPlan],
    ]);
    this.currentHistory = persona.trainingHistory.map((s) => ({ ...s }));
  }

  get activePersona(): SyntheticPersona {
    return SYNTHETIC_PERSONAS[this.currentPersonaId];
  }

  setPersona(personaId: 'maya' | 'marcus'): void {
    this.currentPersonaId = personaId;
    this.resetDemoSync();
  }

  async resetDemo(): Promise<void> {
    this.resetDemoSync();
  }

  private resetDemoSync(): void {
    const persona = SYNTHETIC_PERSONAS[this.currentPersonaId];
    this.currentProfile = { ...persona.profile };
    this.currentLogs = persona.logs.map((log) => ({ ...log }));
    this.currentPlans = new Map([
      ['meal', persona.mealPlan],
      ['workout', persona.workoutPlan],
    ]);
    this.currentHistory = persona.trainingHistory.map((s) => ({ ...s }));
  }

  readonly profile: ProfileRepository = {
    getProfile: async (): Promise<ProfileRecord | null> => {
      return { ...this.currentProfile };
    },
    saveProfile: async (expectedRevision: number, profile: Profile): Promise<ProfileRecord> => {
      if (this.currentProfile.revision !== expectedRevision) {
        throw new Error(
          `Revision conflict: expected ${expectedRevision}, found ${this.currentProfile.revision}`,
        );
      }
      this.currentProfile = {
        ...this.currentProfile,
        ...profile,
        revision: this.currentProfile.revision + 1,
        updated_at: new Date().toISOString(),
      };
      return { ...this.currentProfile };
    },
  };

  readonly logs: LogsRepository = {
    listLogs: async (limit = 100): Promise<LogRecord[]> => {
      return this.currentLogs
        .slice()
        .sort((a, b) => b.local_date.localeCompare(a.local_date))
        .slice(0, limit)
        .map((l) => ({ ...l }));
    },
    saveLog: async (expectedRevision: number, log: LogUpdate): Promise<LogRecord> => {
      const existingIndex = this.currentLogs.findIndex((l) => l.local_date === log.local_date);
      const existing = existingIndex >= 0 ? this.currentLogs[existingIndex] : null;

      if (existing && existing.revision !== expectedRevision) {
        throw new Error(
          `Revision conflict on date ${log.local_date}: expected ${expectedRevision}, found ${existing.revision}`,
        );
      }

      const weight_kg = weightInKg(log.weight.value, log.weight.unit);
      const revision = (existing?.revision ?? 0) + 1;
      const now = new Date().toISOString();

      const saved: LogRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        owner_id: this.currentProfile.owner_id,
        local_date: log.local_date,
        timezone: log.timezone,
        weight_kg,
        calories: log.calories,
        protein_g: log.protein_g,
        carbs_g: log.carbs_g,
        fat_g: log.fat_g,
        water_ml: log.water_ml,
        notes: log.notes,
        revision,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };

      if (existingIndex >= 0) {
        this.currentLogs[existingIndex] = saved;
      } else {
        this.currentLogs.push(saved);
      }

      return { ...saved };
    },
  };

  readonly plans: PlansRepository = {
    getPlan: async (kind: PlanKind): Promise<PlanWithVersion | null> => {
      const plan = this.currentPlans.get(kind);
      return plan ? JSON.parse(JSON.stringify(plan)) : null;
    },
    listPlans: async (): Promise<PlanWithVersion[]> => {
      return Array.from(this.currentPlans.values()).map((p) => JSON.parse(JSON.stringify(p)));
    },
  };

  readonly history: HistoryRepository = {
    listSessions: async (limit = 50): Promise<TrainingSessionRecord[]> => {
      return this.currentHistory.slice(0, limit).map((s) => ({ ...s }));
    },
    getSession: async (id: string): Promise<TrainingSessionRecord | null> => {
      const session = this.currentHistory.find((s) => s.id === id);
      return session ? { ...session } : null;
    },
  };
}

export function createDemoRepositories(
  persona: 'maya' | 'marcus' = 'maya',
): InMemoryDemoRepositories {
  return new InMemoryDemoRepositories(persona);
}
