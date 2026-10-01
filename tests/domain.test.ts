import { describe, expect, it } from 'vitest';
import {
  coachStreamEventSchema,
  mealPlanPayloadSchema,
  profileSchema,
  trainingSessionRecordSchema,
  voiceExtractionInputSchema,
  voiceExtractionResultSchema,
  workoutPlanPayloadSchema,
} from '../packages/contracts/src/index';
import {
  calculateBmr,
  calculateCalorieTarget,
  calculateMacroDistribution,
  calculateNavyBodyFat,
  calculateTdee,
  checkExerciseEquipment,
  checkIngredientExclusions,
  createDemoRepositories,
  energyInKcal,
  energyInKj,
  findExercise,
  findIngredient,
  heightInCm,
  heightInInches,
  resolveExercise,
  resolveIngredient,
  SYNTHETIC_DATA_DISCLAIMER,
  SYNTHETIC_PERSONAS,
  weightInLb,
} from '../packages/domain/src/index';

describe('P3-01: Canonical domain contracts', () => {
  it('validates comprehensive profile with optional demographic and fitness fields', () => {
    const validProfile = {
      display_name: 'Alex Rivera',
      height_cm: 175,
      weight_kg: 72.5,
      goal: 'cut' as const,
      timezone: 'America/New_York',
      units: 'metric' as const,
      biological_sex: 'male' as const,
      age: 29,
      activity_level: 'moderate' as const,
      dietary_preferences: ['pescatarian'],
      allergies: ['peanuts'],
      experience_level: 'intermediate' as const,
      target_weight_kg: 68.0,
      equipment: ['dumbbells', 'pull_up_bar'],
    };
    expect(profileSchema.safeParse(validProfile).success).toBe(true);

    // Rejects invalid biological sex or negative age
    expect(profileSchema.safeParse({ ...validProfile, biological_sex: 'other' }).success).toBe(
      false,
    );
    expect(profileSchema.safeParse({ ...validProfile, age: 10 }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, target_weight_kg: -5 }).success).toBe(false);
  });

  it('validates meal and workout plan schemas and rejects malformed payloads', () => {
    const validMealPayload = SYNTHETIC_PERSONAS.maya.mealPlan.current_version.payload;
    expect(mealPlanPayloadSchema.safeParse(validMealPayload).success).toBe(true);

    const validWorkoutPayload = SYNTHETIC_PERSONAS.marcus.workoutPlan.current_version.payload;
    expect(workoutPlanPayloadSchema.safeParse(validWorkoutPayload).success).toBe(true);

    // Rejects impossible calories or negative sets
    expect(
      mealPlanPayloadSchema.safeParse({ ...validMealPayload, target_calories: -100 }).success,
    ).toBe(false);
  });

  it('validates training session records with detailed set tracking', () => {
    const session = SYNTHETIC_PERSONAS.maya.trainingHistory[0];
    expect(trainingSessionRecordSchema.safeParse(session).success).toBe(true);

    // Rejects negative reps or impossible RPE
    expect(
      trainingSessionRecordSchema.safeParse({
        ...session,
        exercises: [
          {
            exercise_id: 'squat',
            name: 'Squat',
            sets: [{ set_number: 1, reps: -5, load: { value: 60, unit: 'kg' }, completed: true }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('validates coach streaming events across all protocol states', () => {
    const events = [
      { type: 'started', protocolVersion: 1 },
      { type: 'status', phase: 'analyzing', message: 'Analyzing macro balance' },
      { type: 'text_delta', text: 'You achieved your daily protein goal.' },
      { type: 'citation', source: 'Morton et al. 2018 (Br J Sports Med)' },
      { type: 'action_suggestion', action: 'log_meal', label: 'Log dinner' },
      { type: 'error', code: 'RATE_LIMIT', message: 'Too many requests', retryable: true },
      { type: 'done' },
    ];
    for (const ev of events) {
      expect(coachStreamEventSchema.safeParse(ev).success).toBe(true);
    }
    // Rejects unversioned start or invalid status phase
    expect(coachStreamEventSchema.safeParse({ type: 'started' }).success).toBe(false);
    expect(
      coachStreamEventSchema.safeParse({ type: 'status', phase: 'unknown', message: 'test' })
        .success,
    ).toBe(false);
  });

  it('validates voice transcription input and structured extraction outputs', () => {
    expect(
      voiceExtractionInputSchema.safeParse({
        transcript: 'I had 3 eggs and a bowl of oatmeal for breakfast',
        timezone: 'America/New_York',
        local_date: '2026-10-01',
      }).success,
    ).toBe(true);

    const extractionResult = {
      extraction: {
        kind: 'meal_log' as const,
        meal_name: 'Breakfast',
        items: [
          {
            name: 'Eggs',
            amount: 150,
            unit: 'g',
            estimated_calories: 215,
            estimated_protein_g: 18.9,
            estimated_carbs_g: 1.1,
            estimated_fat_g: 14.3,
          },
        ],
        total_estimated_calories: 215,
      },
      confidence: 0.95,
      ambiguities: [],
      raw_transcript: 'I had 3 eggs for breakfast',
    };
    expect(voiceExtractionResultSchema.safeParse(extractionResult).success).toBe(true);
  });
});

describe('P3-02: Pure calculation functions', () => {
  it('calculates Mifflin-St Jeor BMR with stated assumptions and confidence intervals', () => {
    // Male: 10 * 80 + 6.25 * 180 - 5 * 30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const maleBmr = calculateBmr({
      weight_kg: 80,
      height_cm: 180,
      age: 30,
      biological_sex: 'male',
    });
    expect(maleBmr.bmr_kcal).toBe(1780);
    expect(maleBmr.is_estimate).toBe(true);
    expect(maleBmr.formula).toBe('mifflin_st_jeor');
    expect(maleBmr.confidence_interval_kcal).toEqual({ min: 1602, max: 1958 });
    expect(maleBmr.citation).toContain('Mifflin MD');

    // Female: 10 * 65 + 6.25 * 165 - 5 * 28 - 161 = 650 + 1031.25 - 140 - 161 = 1380.25 -> 1380
    const femaleBmr = calculateBmr({
      weight_kg: 65,
      height_cm: 165,
      age: 28,
      biological_sex: 'female',
    });
    expect(femaleBmr.bmr_kcal).toBe(1380);
    expect(femaleBmr.is_estimate).toBe(true);
  });

  it('rejects invalid inputs at domain boundaries for BMR', () => {
    expect(() =>
      calculateBmr({ weight_kg: 10, height_cm: 170, age: 25, biological_sex: 'male' }),
    ).toThrow('valid range');
    expect(() =>
      calculateBmr({ weight_kg: 70, height_cm: 40, age: 25, biological_sex: 'male' }),
    ).toThrow('valid range');
    expect(() =>
      calculateBmr({ weight_kg: 70, height_cm: 170, age: 10, biological_sex: 'male' }),
    ).toThrow('valid range');
  });

  it('calculates TDEE using standard PAL multipliers', () => {
    const tdee = calculateTdee({ bmr_kcal: 1780, activity_level: 'moderate' });
    // 1780 * 1.55 = 2759
    expect(tdee.tdee_kcal).toBe(2759);
    expect(tdee.pal_multiplier).toBe(1.55);
    expect(tdee.is_estimate).toBe(true);
  });

  it('calculates calorie target and enforces safe clinical intake floors', () => {
    // Normal cut: 2759 * 0.80 = 2207
    const cut = calculateCalorieTarget({ tdee_kcal: 2759, goal: 'cut', biological_sex: 'male' });
    expect(cut.target_calories_kcal).toBe(2207);
    expect(cut.safety_floor_applied).toBe(false);

    // Floor clamped case: low TDEE cut
    const clampedCut = calculateCalorieTarget({
      tdee_kcal: 1400,
      goal: 'cut',
      biological_sex: 'female',
    });
    // 1400 * 0.8 = 1120, below female floor 1200
    expect(clampedCut.target_calories_kcal).toBe(1200);
    expect(clampedCut.safety_floor_applied).toBe(true);

    // Bulk: 2759 * 1.10 = 3035
    const bulk = calculateCalorieTarget({ tdee_kcal: 2759, goal: 'bulk', biological_sex: 'male' });
    expect(bulk.target_calories_kcal).toBe(3035);
  });

  it('calculates evidence-based macronutrient distribution', () => {
    const macros = calculateMacroDistribution({
      target_calories: 2200,
      weight_kg: 75,
      goal: 'cut',
    });
    // Cut: 2.0g protein / kg = 150g (600 kcal)
    expect(macros.protein_g).toBe(150);
    expect(macros.protein_calories).toBe(600);
    // Fat: 25% of 2200 = 550 kcal / 9 = 61g
    expect(macros.fat_g).toBe(61);
    // Carbs: (2200 - 600 - 549) / 4 = 1051 / 4 = 263g
    expect(macros.carbs_g).toBe(263);
    expect(macros.is_estimate).toBe(true);
  });

  it('calculates US Navy body fat percentage with valid measurements', () => {
    const maleBf = calculateNavyBodyFat({
      height_cm: 180,
      waist_cm: 84,
      neck_cm: 38,
      biological_sex: 'male',
    });
    expect(maleBf.body_fat_percentage).toBeGreaterThan(10);
    expect(maleBf.body_fat_percentage).toBeLessThan(25);
    expect(maleBf.formula).toBe('us_navy_anthropometric');

    const femaleBf = calculateNavyBodyFat({
      height_cm: 165,
      waist_cm: 70,
      hip_cm: 95,
      neck_cm: 33,
      biological_sex: 'female',
    });
    expect(femaleBf.body_fat_percentage).toBeGreaterThan(15);
    expect(femaleBf.body_fat_percentage).toBeLessThan(35);
  });

  it('performs accurate unit conversions and rejects invalid measurements', () => {
    expect(heightInCm(70, 'in')).toBe(177.8);
    expect(heightInInches(177.8)).toBe(70);
    expect(weightInLb(75)).toBe(165.3);
    expect(energyInKcal(4184, 'kj')).toBe(1000);
    expect(energyInKj(1000)).toBe(4184);

    expect(() => heightInCm(10, 'cm')).toThrow('outside supported range');
    expect(() => energyInKcal(-5, 'kcal')).toThrow('non-negative');
  });
});

describe('P3-03: Normalized ingredient and exercise catalog', () => {
  it('resolves known ingredients with nutrition provenance and alias support', () => {
    const chicken = findIngredient('grilled chicken breast');
    expect(chicken).not.toBeNull();
    expect(chicken?.id).toBe('chicken_breast');
    expect(chicken?.provenance).toContain('USDA');

    const oats = findIngredient('oatmeal');
    expect(oats?.id).toBe('rolled_oats');

    const resolved = resolveIngredient('Atlantic Salmon Fillet', 200);
    expect(resolved.calories).toBe(416); // 208 * 2
    expect(resolved.is_unknown).toBe(false);
  });

  it('provides safe heuristic fallback for unknown foods', () => {
    const unknown = resolveIngredient('Space Berry Bar', 100);
    expect(unknown.is_unknown).toBe(true);
    expect(unknown.is_estimated).toBe(true);
    expect(unknown.calories).toBe(150);
  });

  it('detects allergen and ingredient exclusions', () => {
    const salmon = findIngredient('salmon');
    expect(salmon).not.toBeNull();
    if (salmon) {
      expect(checkIngredientExclusions(salmon, ['fish'])).toBe(true);
      expect(checkIngredientExclusions(salmon, ['peanuts'])).toBe(false);
    }

    const greekYogurt = findIngredient('greek yogurt');
    expect(greekYogurt).not.toBeNull();
    if (greekYogurt) {
      expect(checkIngredientExclusions(greekYogurt, ['dairy'])).toBe(true);
    }
  });

  it('resolves exercises with movement patterns and equipment requirements', () => {
    const squat = findExercise('back squat');
    expect(squat).not.toBeNull();
    expect(squat?.primary_muscle).toBe('quadriceps');
    expect(squat?.movement_pattern).toBe('squat');

    if (squat) {
      expect(checkExerciseEquipment(squat, ['barbell', 'squat_rack'])).toBe(true);
      expect(checkExerciseEquipment(squat, ['dumbbells'])).toBe(false);
    }

    const unknown = resolveExercise('Kettlebell Windmill');
    expect(unknown.is_unknown).toBe(true);
  });
});

describe('P3-05: Synthetic personas', () => {
  it('provides two contrasting personas with 14 days of realistic logs and plan fixtures', () => {
    const { maya, marcus } = SYNTHETIC_PERSONAS;
    expect(SYNTHETIC_DATA_DISCLAIMER).toContain('SYNTHETIC DATA');

    // Maya Lin (Cut)
    expect(maya.profile.goal).toBe('cut');
    expect(maya.profile.dietary_preferences).toContain('pescatarian');
    expect(maya.logs).toHaveLength(14);
    expect(maya.logs[0]?.weight_kg).toBe(68.8);
    expect(maya.logs[13]?.weight_kg).toBe(68.0);
    expect(maya.mealPlan.current_version.provenance).toBe('synthetic_fixture');
    expect(maya.workoutPlan.current_version.provenance).toBe('synthetic_fixture');
    expect(maya.trainingHistory.length).toBeGreaterThanOrEqual(2);

    // Marcus Vance (Bulk)
    expect(marcus.profile.goal).toBe('bulk');
    expect(marcus.profile.units).toBe('imperial');
    expect(marcus.logs).toHaveLength(14);
    expect(marcus.logs[0]?.weight_kg).toBe(81.8);
    expect(marcus.logs[13]?.weight_kg).toBe(82.5);
    expect(marcus.mealPlan.current_version.payload.kind).toBe('meal');
    expect(marcus.workoutPlan.current_version.payload.kind).toBe('workout');
  });
});

describe('P3-04 & P3-06: Feature repositories and demo isolation', () => {
  it('manages profile, logs, plans, and history in-memory with revision checks', async () => {
    const repos = createDemoRepositories('maya');
    expect(repos.isDemo).toBe(true);

    // Profile read & update
    const profile = await repos.profile.getProfile();
    expect(profile).not.toBeNull();
    expect(profile?.display_name).toContain('Maya Lin');
    expect(profile?.revision).toBe(1);

    if (!profile) throw new Error('Expected profile');

    const updated = await repos.profile.saveProfile(1, {
      ...profile,
      display_name: 'Maya Lin Updated',
    });
    expect(updated.display_name).toBe('Maya Lin Updated');
    expect(updated.revision).toBe(2);

    // Stale revision conflict check
    await expect(repos.profile.saveProfile(1, { ...profile })).rejects.toThrow('Revision conflict');

    // Logs list & upsert
    const logs = await repos.logs.listLogs();
    expect(logs).toHaveLength(14);
    expect(logs[0]?.local_date).toBe('2026-10-01'); // sorted descending

    const newLog = await repos.logs.saveLog(0, {
      expected_revision: 0,
      local_date: '2026-10-02',
      timezone: 'America/New_York',
      weight: { value: 67.9, unit: 'kg' },
      calories: 1750,
      notes: 'New day logged',
    });
    expect(newLog.weight_kg).toBe(67.9);
    const updatedLogs = await repos.logs.listLogs();
    expect(updatedLogs).toHaveLength(15);
    expect(updatedLogs[0]?.local_date).toBe('2026-10-02');

    // Plans retrieval
    const mealPlan = await repos.plans.getPlan('meal');
    expect(mealPlan?.plan.kind).toBe('meal');
    const workoutPlan = await repos.plans.getPlan('workout');
    expect(workoutPlan?.plan.kind).toBe('workout');

    // History retrieval
    const history = await repos.history.listSessions();
    expect(history.length).toBeGreaterThan(0);
    const firstSession = history[0];
    if (!firstSession) throw new Error('Expected session');
    const session = await repos.history.getSession(firstSession.id);
    expect(session).toEqual(firstSession);

    // Reset restores pristine fixtures
    await repos.resetDemo();
    const resetLogs = await repos.logs.listLogs();
    expect(resetLogs).toHaveLength(14);
    const resetProfile = await repos.profile.getProfile();
    expect(resetProfile?.display_name).toBe('Maya Lin (Synthetic Demo)');

    // Switching persona
    repos.setPersona('marcus');
    const marcusProfile = await repos.profile.getProfile();
    expect(marcusProfile?.display_name).toContain('Marcus Vance');
    expect(marcusProfile?.goal).toBe('bulk');
  });
});
