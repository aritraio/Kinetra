import type {
  CreateShareGrantInput,
  FeatureRepositories,
  HistoryRepository,
  LogRecord,
  LogsRepository,
  LogUpdate,
  PhotosRepository,
  PlanGenerationInput,
  PlanGenerationResult,
  PlanKind,
  PlansRepository,
  PlanShareGrant,
  PlanVersionRecord,
  PlanWithVersion,
  Profile,
  ProfileRecord,
  ProfileRepository,
  ProgressionProposal,
  SharedPlanView,
  TrainingSessionRecord,
} from '@kinetra/contracts';
import { getFallbackMealPlan, getFallbackWorkoutPlan } from './fallback-templates';
import { type MealVerificationProfile, verifyMealPlan } from './meal-verifier';
import { SYNTHETIC_PERSONAS, type SyntheticPersona } from './personas';
import { applyProgressionToWorkoutPlan, evaluateWorkoutProgression } from './progression';
import { createPlanShareGrant, sanitizePlanForSharing, validateShareGrant } from './sharing';
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
  private shareGrants: Map<string, PlanShareGrant> = new Map();
  private photosConsent = false;
  private photosList: Array<{
    id: string;
    url: string;
    captured_at: string;
    expires_at: string;
    notes?: string;
  }> = [];

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
    this.shareGrants.clear();
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
    getProgressionProposal: async (_planId?: string): Promise<ProgressionProposal> => {
      const activeWorkout = this.currentPlans.get('workout');
      if (!activeWorkout || activeWorkout.current_version.payload.kind !== 'workout') {
        throw new Error('No active workout plan found for adaptive progression evaluation');
      }
      return evaluateWorkoutProgression({
        plan: activeWorkout,
        history: this.currentHistory,
        options: {
          preferredUnit: this.currentProfile.units === 'imperial' ? 'lb' : 'kg',
        },
      });
    },
    applyProgressionProposal: async (
      proposal: ProgressionProposal,
      acceptedExerciseIds?: string[],
    ): Promise<PlanWithVersion> => {
      const existingPlan = this.currentPlans.get('workout');
      if (!existingPlan || existingPlan.current_version.payload.kind !== 'workout') {
        throw new Error('No active workout plan found to apply progression adjustments');
      }
      const workoutPayload = existingPlan.current_version.payload;
      const versions = this.planVersions.get('workout') ?? [];
      const nextVersionNumber = (existingPlan.current_version.version ?? 0) + 1;
      const planId = existingPlan.plan.id;

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

      const newVersionRecord: PlanVersionRecord = {
        plan_id: planId,
        owner_id: this.currentProfile.owner_id,
        version: nextVersionNumber,
        payload: updatedPayload,
        schema_version: '2026-10-01',
        policy_version: '2026-10-01',
        prompt_version: 'v1.0-adaptive-progression',
        provenance: 'progression',
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
          created_at: existingPlan.plan.created_at ?? new Date().toISOString(),
        },
        current_version: newVersionRecord,
      };
      this.currentPlans.set('workout', updatedPlan);

      return JSON.parse(JSON.stringify(updatedPlan));
    },
    createShareGrant: async (input: CreateShareGrantInput): Promise<PlanShareGrant> => {
      const grant = createPlanShareGrant(
        this.currentProfile.owner_id,
        input.plan_id,
        input.version,
        input.duration_days,
      );
      this.shareGrants.set(grant.token, grant);
      return { ...grant };
    },
    revokeShareGrant: async (grantId: string): Promise<void> => {
      for (const [token, grant] of this.shareGrants.entries()) {
        if (grant.id === grantId) {
          this.shareGrants.set(token, { ...grant, revoked_at: new Date().toISOString() });
          return;
        }
      }
    },
    listShareGrants: async (planId?: string): Promise<PlanShareGrant[]> => {
      const all = Array.from(this.shareGrants.values());
      return planId ? all.filter((g) => g.plan_id === planId) : all;
    },
    getSharedPlan: async (token: string): Promise<SharedPlanView> => {
      const grant = this.shareGrants.get(token);
      if (!grant) {
        throw new Error('Share link not found or invalid token');
      }
      const validation = validateShareGrant(grant);
      if (!validation.valid) {
        throw new Error(`Share link is ${validation.reason}`);
      }
      const plan = Array.from(this.currentPlans.values()).find((p) => p.plan.id === grant.plan_id);
      if (!plan) {
        throw new Error('Referenced plan no longer exists');
      }
      return sanitizePlanForSharing(grant, plan.current_version, plan.plan.kind);
    },
  };

  addSession(session: TrainingSessionRecord): void {
    this.currentHistory.unshift({ ...session });
  }

  readonly history: HistoryRepository = {
    listSessions: async (limit = 50): Promise<TrainingSessionRecord[]> => {
      return this.currentHistory.slice(0, limit).map((s) => ({ ...s }));
    },
    getSession: async (id: string): Promise<TrainingSessionRecord | null> => {
      const session = this.currentHistory.find((s) => s.id === id);
      return session ? { ...session } : null;
    },
  };

  readonly photos: PhotosRepository = {
    listPhotos: async () => {
      return [...this.photosList];
    },
    savePhoto: async (photo) => {
      if (!this.photosConsent) {
        throw new Error('Photo consent required before saving photos');
      }
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
      this.photosList.unshift({
        id: photo.id,
        url: photo.url,
        captured_at: photo.captured_at,
        expires_at: expiresAt,
        ...(photo.notes ? { notes: photo.notes } : {}),
      });
    },
    deletePhoto: async (id: string) => {
      this.photosList = this.photosList.filter((p) => p.id !== id);
    },
    getConsent: async () => {
      return this.photosConsent;
    },
    setConsent: async (granted: boolean) => {
      this.photosConsent = granted;
      if (!granted) {
        this.photosList = [];
      }
    },
  };
}

export function createDemoRepositories(
  persona: 'maya' | 'marcus' = 'maya',
): InMemoryDemoRepositories {
  return new InMemoryDemoRepositories(persona);
}
