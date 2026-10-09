import type {
  FeatureRepositories,
  HistoryRepository,
  LogRecord,
  LogsRepository,
  LogUpdate,
  PlanGenerationInput,
  PlanGenerationResult,
  PlanKind,
  PlansRepository,
  PlanVersionRecord,
  PlanWithVersion,
  Profile,
  ProfileRecord,
  ProfileRepository,
  TrainingSessionRecord,
} from '@kinetra/contracts';
import { getFallbackMealPlan, getFallbackWorkoutPlan } from './fallback-templates';
import { type MealVerificationProfile, verifyMealPlan } from './meal-verifier';
import { SYNTHETIC_PERSONAS, type SyntheticPersona } from './personas';
import { weightInKg } from './units';
import { type WorkoutVerificationProfile, verifyWorkoutPlan } from './workout-verifier';

export class InMemoryDemoRepositories implements FeatureRepositories {
  readonly isDemo = true;
  private currentPersonaId: 'maya' | 'marcus';
  private currentProfile: ProfileRecord;
  private currentLogs: LogRecord[];
  private currentPlans: Map<PlanKind, PlanWithVersion>;
  private planVersions: Map<PlanKind, PlanVersionRecord[]>;
  private currentHistory: TrainingSessionRecord[];

  constructor(initialPersona: 'maya' | 'marcus' = 'maya') {
    this.currentPersonaId = initialPersona;
    const persona = SYNTHETIC_PERSONAS[initialPersona];
    this.currentProfile = { ...persona.profile };
    this.currentLogs = persona.logs.map((log) => ({ ...log }));
    this.currentPlans = new Map([
      ['meal', JSON.parse(JSON.stringify(persona.mealPlan))],
      ['workout', JSON.parse(JSON.stringify(persona.workoutPlan))],
    ]);
    this.planVersions = new Map([
      ['meal', [JSON.parse(JSON.stringify(persona.mealPlan.current_version))]],
      ['workout', [JSON.parse(JSON.stringify(persona.workoutPlan.current_version))]],
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
      ['meal', JSON.parse(JSON.stringify(persona.mealPlan))],
      ['workout', JSON.parse(JSON.stringify(persona.workoutPlan))],
    ]);
    this.planVersions = new Map([
      ['meal', [JSON.parse(JSON.stringify(persona.mealPlan.current_version))]],
      ['workout', [JSON.parse(JSON.stringify(persona.workoutPlan.current_version))]],
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
    deleteLog: async (localDate: string): Promise<void> => {
      const existingIndex = this.currentLogs.findIndex((l) => l.local_date === localDate);
      if (existingIndex >= 0) {
        this.currentLogs.splice(existingIndex, 1);
      }
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
    listPlanVersions: async (kind: PlanKind): Promise<PlanVersionRecord[]> => {
      const versions = this.planVersions.get(kind) ?? [];
      return versions.map((v) => JSON.parse(JSON.stringify(v)));
    },
    pinPlanVersion: async (kind: PlanKind, version: number): Promise<PlanWithVersion> => {
      const versions = this.planVersions.get(kind) ?? [];
      const targetVersion = versions.find((v) => v.version === version);
      if (!targetVersion) {
        throw new Error(`Plan version ${version} not found for kind ${kind}`);
      }
      const existing = this.currentPlans.get(kind);
      if (!existing) {
        throw new Error(`Plan not found for kind ${kind}`);
      }
      const updated: PlanWithVersion = {
        plan: {
          ...existing.plan,
          current_version: version,
        },
        current_version: JSON.parse(JSON.stringify(targetVersion)),
      };
      this.currentPlans.set(kind, updated);
      return JSON.parse(JSON.stringify(updated));
    },
    generatePlan: async (input: PlanGenerationInput): Promise<PlanGenerationResult> => {
      const existingPlan = this.currentPlans.get(input.kind);
      const versions = this.planVersions.get(input.kind) ?? [];
      const nextVersionNumber = (existingPlan?.current_version.version ?? 0) + 1;
      const planId = existingPlan?.plan.id ?? crypto.randomUUID();

      if (input.kind === 'meal') {
        const targetCalories =
          input.target_calories ?? (this.currentProfile.goal === 'cut' ? 1900 : 2500);
        const targetProtein =
          input.target_protein_g ?? Math.round(this.currentProfile.weight_kg * 2.0);
        const targetCarbs = input.target_carbs_g ?? 200;
        const targetFat = input.target_fat_g ?? 60;

        const profile: MealVerificationProfile = {
          target_calories: targetCalories,
          target_protein_g: targetProtein,
          target_carbs_g: targetCarbs,
          target_fat_g: targetFat,
          allergies: input.allergies ?? this.currentProfile.allergies ?? [],
          dietary_preferences:
            input.dietary_preferences ?? this.currentProfile.dietary_preferences ?? [],
          pantry_only: input.pantry_only,
          pantry_ingredients: input.pantry_ingredients,
        };

        const payload = getFallbackMealPlan(profile);
        if (!payload) {
          throw new Error('Unsatisfiable meal constraints: no verified plan could be generated.');
        }

        const verification = verifyMealPlan(payload, profile);
        if (!verification.valid) {
          throw new Error(
            `Generated meal plan failed domain verification: ${verification.hard_violations.map((v) => v.message).join('; ')}`,
          );
        }

        const newVersionRecord: PlanVersionRecord = {
          plan_id: planId,
          owner_id: this.currentProfile.owner_id,
          version: nextVersionNumber,
          payload,
          schema_version: '2026-10-01',
          policy_version: '2026-10-01',
          prompt_version: 'v1.0-verified-template',
          provenance: 'template',
          created_at: new Date().toISOString(),
        };

        versions.push(newVersionRecord);
        this.planVersions.set('meal', versions);

        const updatedPlan: PlanWithVersion = {
          plan: {
            id: planId,
            owner_id: this.currentProfile.owner_id,
            kind: 'meal',
            current_version: nextVersionNumber,
            created_at: existingPlan?.plan.created_at ?? new Date().toISOString(),
          },
          current_version: newVersionRecord,
        };
        this.currentPlans.set('meal', updatedPlan);

        return {
          plan: updatedPlan.plan,
          version: newVersionRecord,
          provenance: 'template',
          verification,
        };
      }

      const daysPerWeek = input.days_per_week ?? 4;
      const splitName = input.split_name ?? 'Upper / Lower Split';
      const equipment = input.equipment ??
        this.currentProfile.equipment ?? ['bench', 'barbell', 'dumbbells', 'rack'];

      const profile: WorkoutVerificationProfile = {
        days_per_week: daysPerWeek,
        split_name: splitName,
        available_equipment: equipment,
      };

      const payload = getFallbackWorkoutPlan(profile);
      if (!payload) {
        throw new Error('Unsatisfiable workout constraints: no verified plan could be generated.');
      }

      const verification = verifyWorkoutPlan(payload, profile);
      if (!verification.valid) {
        throw new Error(
          `Generated workout plan failed domain verification: ${verification.hard_violations.map((v) => v.message).join('; ')}`,
        );
      }

      const newVersionRecord: PlanVersionRecord = {
        plan_id: planId,
        owner_id: this.currentProfile.owner_id,
        version: nextVersionNumber,
        payload,
        schema_version: '2026-10-01',
        policy_version: '2026-10-01',
        prompt_version: 'v1.0-verified-template',
        provenance: 'template',
        created_at: new Date().toISOString(),
      };

      versions.push(newVersionRecord);
      this.planVersions.set('workout', versions);

      const updatedPlan: PlanWithVersion = {
        plan: {
          id: planId,
          owner_id: this.currentProfile.owner_id,
          kind: 'workout',
          current_version: nextVersionNumber,
          created_at: existingPlan?.plan.created_at ?? new Date().toISOString(),
        },
        current_version: newVersionRecord,
      };
      this.currentPlans.set('workout', updatedPlan);

      return {
        plan: updatedPlan.plan,
        version: newVersionRecord,
        provenance: 'template',
        verification,
      };
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
