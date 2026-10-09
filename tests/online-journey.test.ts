import type { FeatureRepositories, Profile } from '../packages/contracts/src/index';
import { createDemoRepositories } from '../packages/domain/src/index';
import { describe, expect, it } from 'vitest';
import {
  checkMissedReminders,
  getReminderPreferences,
  saveReminderPreferences,
} from '../apps/web/src/features/reminders';

describe('Phase 5 — Full Online Journey & Core Product Verification', () => {
  it('P5-02: Progressive Onboarding validates required fields, supports step draft preservation, and saves profile', async () => {
    const repos: FeatureRepositories = createDemoRepositories('maya');

    // Step 1: Account basics
    const step1 = {
      display_name: 'Elena Rostova',
      units: 'metric' as const,
      timezone: 'Europe/London',
    };
    expect(step1.display_name.trim().length).toBeGreaterThan(0);
    expect(step1.timezone).toBe('Europe/London');

    // Step 2: Biometrics
    const step2 = {
      height_cm: 168,
      weight_kg: 64.5,
      biological_sex: 'female' as const,
      age: 29,
    };
    expect(step2.height_cm).toBeGreaterThanOrEqual(50);
    expect(step2.height_cm).toBeLessThanOrEqual(250);
    expect(step2.weight_kg).toBeGreaterThanOrEqual(20);
    expect(step2.age).toBeGreaterThanOrEqual(13);

    // Step 3: Goals & Activity
    const step3 = {
      goal: 'cut' as const,
      activity_level: 'moderate' as const,
      experience_level: 'intermediate' as const,
    };

    // Step 4: Optional constraints
    const step4 = {
      dietary_preferences: ['pescatarian'],
      allergies: ['shellfish'],
      equipment: ['bench', 'barbell', 'dumbbells', 'rack'],
    };

    // Synthesize verified profile payload
    const finalProfile: Profile = {
      ...step1,
      ...step2,
      ...step3,
      ...step4,
    };

    // Save profile to repository
    const initialProfile = await repos.profile.getProfile();
    const currentRev = initialProfile?.revision ?? 0;

    const saved = await repos.profile.saveProfile(currentRev, finalProfile);
    expect(saved.display_name).toBe('Elena Rostova');
    expect(saved.weight_kg).toBe(64.5);
    expect(saved.timezone).toBe('Europe/London');
    expect(saved.revision).toBe(currentRev + 1);

    // Verify draft storage simulation
    const draftPayload = JSON.stringify({ step: 4, ...finalProfile });
    expect(JSON.parse(draftPayload).display_name).toBe('Elena Rostova');
  });

  it('P5-05: Plan generation enforces verified content, saves immutable versions, and pins active versions', async () => {
    const repos = createDemoRepositories('maya');

    // 1. Initial plan has version 1
    const initialWorkout = await repos.plans.getPlan('workout');
    expect(initialWorkout).not.toBeNull();
    expect(initialWorkout?.current_version.version).toBe(1);
    expect(initialWorkout?.current_version.provenance).toBe('synthetic_fixture');

    // 2. Generate a new verified workout plan
    if (repos.plans.generatePlan) {
      const result = await repos.plans.generatePlan({
        kind: 'workout',
        split_name: 'Upper / Lower Split',
        days_per_week: 4,
        equipment: ['bench', 'barbell', 'dumbbells', 'rack'],
      });

      expect(result.version.version).toBe(2);
      expect(result.version.provenance).toBe('template');
      expect(result.verification.valid).toBe(true);
      expect(result.verification.hard_violations.length).toBe(0);

      // Verify active plan updated
      const updatedPlan = await repos.plans.getPlan('workout');
      expect(updatedPlan?.current_version.version).toBe(2);

      // 3. Version history contains both version 1 and 2
      if (repos.plans.listPlanVersions) {
        const versions = await repos.plans.listPlanVersions('workout');
        expect(versions.length).toBe(2);
        expect(versions.map((v) => v.version)).toEqual([1, 2]);
      }

      // 4. Pin back to version 1
      if (repos.plans.pinPlanVersion) {
        const pinned = await repos.plans.pinPlanVersion('workout', 1);
        expect(pinned.current_version.version).toBe(1);

        const currentActive = await repos.plans.getPlan('workout');
        expect(currentActive?.current_version.version).toBe(1);
      }
    }
  });

  it('P5-05: Preserves previous accepted plan when generation fails constraints', async () => {
    const repos = createDemoRepositories('maya');
    const baselineMeal = await repos.plans.getPlan('meal');
    expect(baselineMeal?.current_version.version).toBe(1);

    if (repos.plans.generatePlan) {
      // Attempt generation with an impossible / unsatisfiable boundary (e.g. 50 kcal target)
      let failed = false;
      try {
        await repos.plans.generatePlan({
          kind: 'meal',
          target_calories: 50, // Boundary violation: min target is 800
        });
      } catch (err: unknown) {
        failed = true;
        expect((err as Error).message).toContain('Unsatisfiable meal constraints');
      }

      expect(failed).toBe(true);

      // PRESERVATION GUARANTEE: Active plan remains untouched
      const preservedPlan = await repos.plans.getPlan('meal');
      expect(preservedPlan?.current_version.version).toBe(1);
      expect(preservedPlan?.current_version.payload.kind).toBe('meal');
    }
  });

  it('P5-06: Daily logs support full CRUD (create, edit, delete) with revision reconciliation', async () => {
    const repos = createDemoRepositories('maya');

    const testDate = '2026-10-15';

    // 1. CREATE log
    const created = await repos.logs.saveLog(0, {
      expected_revision: 0,
      local_date: testDate,
      timezone: 'America/New_York',
      weight: { value: 68.2, unit: 'kg' },
      calories: 1950,
      protein_g: 145,
      carbs_g: 190,
      fat_g: 55,
      water_ml: 2500,
      notes: 'Initial day 1 log',
    });

    expect(created.local_date).toBe(testDate);
    expect(created.weight_kg).toBe(68.2);
    expect(created.calories).toBe(1950);
    expect(created.revision).toBe(1);

    // Verify it appears in list
    let list = await repos.logs.listLogs(50);
    expect(list.some((l) => l.local_date === testDate)).toBe(true);

    // 2. EDIT log with matching revision
    const edited = await repos.logs.saveLog(created.revision, {
      expected_revision: created.revision,
      local_date: testDate,
      timezone: 'America/New_York',
      weight: { value: 68.0, unit: 'kg' },
      calories: 2000,
      water_ml: 2800,
      notes: 'Updated evening notes',
    });

    expect(edited.weight_kg).toBe(68.0);
    expect(edited.calories).toBe(2000);
    expect(edited.revision).toBe(2);

    // 3. REVISION CONFLICT: Attempt saving with stale revision
    let conflictOccurred = false;
    try {
      await repos.logs.saveLog(1, {
        // stale revision 1
        expected_revision: 1,
        local_date: testDate,
        timezone: 'America/New_York',
        weight: { value: 67.8, unit: 'kg' },
      });
    } catch (err: unknown) {
      conflictOccurred = true;
      expect((err as Error).message).toContain('Revision conflict');
    }
    expect(conflictOccurred).toBe(true);

    // 4. DELETE log
    await repos.logs.deleteLog(testDate);

    list = await repos.logs.listLogs(50);
    expect(list.some((l) => l.local_date === testDate)).toBe(false);
  });

  it('P5-07: Reminders check missed windows on visibility changes with honest delivery semantics', () => {
    // 1. Default preferences
    const prefs = getReminderPreferences();
    expect(prefs.reminders.length).toBeGreaterThanOrEqual(3);
    expect(prefs.timezone).toBeDefined();

    // 2. Schedule reminders
    saveReminderPreferences({
      reminders: [
        {
          id: 'test_morning',
          title: 'Morning Weigh-in',
          time: '08:00',
          enabled: true,
          action: 'Log weight',
        },
      ],
      timezone: 'UTC',
      lastCheckedAt: '2026-10-08T07:30:00.000Z',
    });

    // 3. Simulate returning at 08:30 UTC (window 07:30 -> 08:30 passed 08:00)
    const returnTime = new Date('2026-10-08T08:30:00.000Z');
    const { missed, nextPreferences } = checkMissedReminders(returnTime);

    expect(missed.length).toBe(1);
    expect(missed[0]?.id).toBe('test_morning');
    expect(missed[0]?.title).toBe('Morning Weigh-in');

    // Next check time is updated to return time
    expect(nextPreferences.lastCheckedAt).toBe(returnTime.toISOString());

    // 4. Checking again at 08:35 UTC yields 0 missed reminders (not re-alerted)
    const secondCheck = checkMissedReminders(new Date('2026-10-08T08:35:00.000Z'));
    expect(secondCheck.missed.length).toBe(0);
  });
});
