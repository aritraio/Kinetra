import { describe, expect, it } from 'vitest';
import type {
  PlanWithVersion,
  TrainingSessionRecord,
  WorkoutPlanPayload,
} from '../packages/contracts/src/index';
import {
  applyProgressionToWorkoutPlan,
  evaluateWorkoutProgression,
  parseRepRange,
} from '../packages/domain/src';

const FIXED_NOW = '2026-10-09T12:00:00Z';

function createMockWorkoutPlan(): PlanWithVersion {
  const payload: WorkoutPlanPayload = {
    kind: 'workout',
    schema_version: '2026-10-01',
    policy_version: '2026-10-01',
    split_name: 'Upper / Lower Split',
    days_per_week: 2,
    days: [
      {
        day_number: 1,
        day_name: 'Day 1',
        focus: 'Lower Body Strength',
        is_rest_day: false,
        exercises: [
          {
            exercise_id: 'barbell_back_squat',
            name: 'Barbell Back Squat',
            target_sets: 3,
            target_reps: '8-10',
            rest_seconds: 120,
            prescribed_load: { value: 60, unit: 'kg' },
            rpe: 8.0,
            equipment: 'barbell',
            instructions: 'Break at knees and hips together.',
          },
          {
            exercise_id: 'romanian_deadlift_dumbbell',
            name: 'Dumbbell Romanian Deadlift (RDL)',
            target_sets: 3,
            target_reps: '10-12',
            rest_seconds: 90,
            prescribed_load: { value: 20, unit: 'kg' },
            rpe: 7.5,
            equipment: 'dumbbells',
            instructions: 'Hinge back at the hips.',
          },
        ],
      },
      {
        day_number: 2,
        day_name: 'Day 2',
        focus: 'Upper Body Strength',
        is_rest_day: false,
        exercises: [
          {
            exercise_id: 'barbell_bench_press',
            name: 'Barbell Bench Press',
            target_sets: 3,
            target_reps: '8-10',
            rest_seconds: 120,
            prescribed_load: { value: 50, unit: 'kg' },
            rpe: 8.0,
            equipment: 'barbell',
            instructions: 'Lower with control to mid-chest.',
          },
          {
            exercise_id: 'push_up',
            name: 'Push-Up',
            target_sets: 3,
            target_reps: '10-15',
            rest_seconds: 60,
            equipment: 'bodyweight',
            instructions: 'Full lock out at top.',
          },
        ],
      },
      {
        day_number: 3,
        day_name: 'Day 3',
        focus: 'Rest',
        is_rest_day: true,
        exercises: [],
      },
      {
        day_number: 4,
        day_name: 'Day 4',
        focus: 'Rest',
        is_rest_day: true,
        exercises: [],
      },
    ],
  };

  return {
    plan: {
      id: '00000000-0000-4000-8000-000000000101',
      owner_id: '00000000-0000-4000-8000-000000000001',
      kind: 'workout',
      current_version: 1,
      created_at: '2026-09-01T00:00:00Z',
    },
    current_version: {
      plan_id: '00000000-0000-4000-8000-000000000101',
      owner_id: '00000000-0000-4000-8000-000000000001',
      version: 1,
      payload,
      schema_version: '2026-10-01',
      policy_version: '2026-10-01',
      prompt_version: 'v1.0-test',
      provenance: 'template',
      created_at: '2026-09-01T00:00:00Z',
    },
  };
}

function createSession(
  dateIso: string,
  exercises: Array<{
    exercise_id: string;
    name: string;
    sets: Array<{
      reps: number;
      loadVal: number;
      unit: 'kg' | 'lb';
      rpe?: number;
      completed?: boolean;
    }>;
    notes?: string;
  }>,
  sessionNotes?: string,
): TrainingSessionRecord {
  return {
    id: crypto.randomUUID(),
    owner_id: '00000000-0000-4000-8000-000000000001',
    plan_id: '00000000-0000-4000-8000-000000000101',
    plan_version: 1,
    started_at: `${dateIso}T17:00:00Z`,
    completed_at: `${dateIso}T18:00:00Z`,
    notes: sessionNotes,
    exercises: exercises.map((e) => ({
      exercise_id: e.exercise_id,
      name: e.name,
      notes: e.notes,
      sets: e.sets.map((s, idx) => ({
        set_number: idx + 1,
        reps: s.reps,
        load: { value: s.loadVal, unit: s.unit },
        rpe: s.rpe,
        completed: s.completed ?? true,
      })),
    })),
    created_at: `${dateIso}T18:05:00Z`,
  };
}

describe('Adaptive Progression Engine — Pure Rule Rules & Edge Cases', () => {
  it('parses rep range strings accurately', () => {
    expect(parseRepRange('8-10')).toEqual({ minReps: 8, maxReps: 10 });
    expect(parseRepRange('12–15')).toEqual({ minReps: 12, maxReps: 15 });
    expect(parseRepRange('5')).toEqual({ minReps: 5, maxReps: 5 });
    expect(parseRepRange('10 reps')).toEqual({ minReps: 10, maxReps: 10 });
    expect(parseRepRange('invalid')).toEqual({ minReps: 8, maxReps: 12 });
  });

  it('P8-03 Edge Case: Inadequate data (< 2 sessions) produces no forced adjustment', () => {
    const plan = createMockWorkoutPlan();

    // 0 sessions
    const emptyResult = evaluateWorkoutProgression({
      plan,
      history: [],
      options: { now: FIXED_NOW },
    });
    expect(emptyResult.overall_action).toBe('insufficient_data');
    expect(emptyResult.exercise_adjustments.every((a) => a.action === 'insufficient_data')).toBe(
      true,
    );
    expect(emptyResult.exercise_adjustments.every((a) => a.delta.load_delta === 0)).toBe(true);
    expect(emptyResult.exercise_adjustments.every((a) => a.confidence === 0.0)).toBe(true);

    // 1 session only
    const singleSession = [
      createSession('2026-10-07', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
          ],
        },
      ]),
    ];

    const oneSessionResult = evaluateWorkoutProgression({
      plan,
      history: singleSession,
      options: { now: FIXED_NOW },
    });

    const squatAdj = oneSessionResult.exercise_adjustments.find(
      (a) => a.exercise_id === 'barbell_back_squat',
    );
    expect(squatAdj?.action).toBe('insufficient_data');
    expect(squatAdj?.delta.load_delta).toBe(0);
    expect(squatAdj?.confidence).toBe(0.2);
    expect(squatAdj?.reason).toContain('minimum 2 required');
  });

  it('P8-03 Edge Case: Unit conversion (plan in kg, logs in lb) normalizes accurately', () => {
    const plan = createMockWorkoutPlan();
    // 60 kg = ~132.28 lb. User logs 3 sessions at 135 lb with RPE 7.0 (comfortable overload)
    const history = [
      createSession('2026-09-28', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
          ],
        },
      ]),
      createSession('2026-10-02', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
          ],
        },
      ]),
      createSession('2026-10-06', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
            { reps: 10, loadVal: 135, unit: 'lb', rpe: 7.0 },
          ],
        },
      ]),
    ];

    const result = evaluateWorkoutProgression({
      plan,
      history,
      options: { now: FIXED_NOW, preferredUnit: 'kg' },
    });

    const squatAdj = result.exercise_adjustments.find(
      (a) => a.exercise_id === 'barbell_back_squat',
    );
    expect(squatAdj?.action).toBe('progress');
    expect(squatAdj?.delta.unit).toBe('kg');
    // Bounded to <= 10% and standard barbell micro-plate increment (1.25 kg)
    expect(squatAdj?.delta.load_delta).toBeGreaterThan(0);
    expect(squatAdj?.delta.load_delta).toBeLessThanOrEqual(5.0);
    expect(squatAdj?.proposed_prescription.load?.value).toBe(65); // 60kg + 5kg
  });

  it('P8-03 Edge Case: Changed/Unperformed exercises remain untouched and do not cause failures', () => {
    const plan = createMockWorkoutPlan();
    // User performs squats and a completely unprescribed exercise (e.g. cable curls)
    const history = [
      createSession('2026-10-02', [
        {
          exercise_id: 'cable_bicep_curl',
          name: 'Cable Bicep Curl',
          sets: [{ reps: 12, loadVal: 15, unit: 'kg', rpe: 7.0 }],
        },
      ]),
      createSession('2026-10-05', [
        {
          exercise_id: 'cable_bicep_curl',
          name: 'Cable Bicep Curl',
          sets: [{ reps: 12, loadVal: 15, unit: 'kg', rpe: 7.0 }],
        },
      ]),
    ];

    const result = evaluateWorkoutProgression({
      plan,
      history,
      options: { now: FIXED_NOW },
    });

    // None of the plan exercises were performed
    for (const adj of result.exercise_adjustments) {
      expect(adj.action).toBe('insufficient_data');
      expect(adj.delta.load_delta).toBe(0);
    }
  });

  it('P8-03 Edge Case: Missed sessions / Inactivity triggers conservative response', () => {
    const plan = createMockWorkoutPlan();

    // Case A: 10 days since last session -> Maintain current load
    const historyGap10 = [
      createSession('2026-09-25', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [{ reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 }],
        },
      ]),
      createSession('2026-09-29', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [{ reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 }],
        },
      ]),
    ];
    const resGap10 = evaluateWorkoutProgression({
      plan,
      history: historyGap10,
      options: { now: FIXED_NOW },
    });
    const squatGap10 = resGap10.exercise_adjustments.find(
      (a) => a.exercise_id === 'barbell_back_squat',
    );
    expect(squatGap10?.action).toBe('maintain');
    expect(squatGap10?.delta.load_delta).toBe(0);
    expect(squatGap10?.reason).toContain('Training gap');

    // Case B: 18 days hiatus -> 10% re-acclimatization deload
    const historyGap18 = [
      createSession('2026-09-17', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [{ reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 }],
        },
      ]),
      createSession('2026-09-21', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [{ reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 }],
        },
      ]),
    ];
    const resGap18 = evaluateWorkoutProgression({
      plan,
      history: historyGap18,
      options: { now: FIXED_NOW },
    });
    const squatGap18 = resGap18.exercise_adjustments.find(
      (a) => a.exercise_id === 'barbell_back_squat',
    );
    expect(squatGap18?.action).toBe('deload');
    expect(squatGap18?.delta.load_delta).toBeLessThan(0);
    expect(squatGap18?.reason).toContain('Training hiatus');
    expect(squatGap18?.proposed_prescription.load?.value).toBe(53.75); // 60 - 6.25 = 53.75

    // Case C: 35 days extended layoff -> 15% detraining reset
    const historyGap35 = [
      createSession('2026-08-30', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [{ reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 }],
        },
      ]),
      createSession('2026-09-04', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [{ reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 }],
        },
      ]),
    ];
    const resGap35 = evaluateWorkoutProgression({
      plan,
      history: historyGap35,
      options: { now: FIXED_NOW },
    });
    const squatGap35 = resGap35.exercise_adjustments.find(
      (a) => a.exercise_id === 'barbell_back_squat',
    );
    expect(squatGap35?.action).toBe('deload');
    expect(squatGap35?.reason).toContain('Extended layoff');
  });

  it('P8-03 Edge Case: Upper and lower progression bounds are strictly clamped', () => {
    const plan = createMockWorkoutPlan();

    // Even if user effortlessly logs a giant weight increase, single cycle progress is bounded
    const history = [
      createSession('2026-10-01', [
        {
          exercise_id: 'barbell_bench_press',
          name: 'Barbell Bench Press',
          sets: [
            { reps: 10, loadVal: 50, unit: 'kg', rpe: 6.0 },
            { reps: 10, loadVal: 50, unit: 'kg', rpe: 6.0 },
            { reps: 10, loadVal: 50, unit: 'kg', rpe: 6.0 },
          ],
        },
      ]),
      createSession('2026-10-06', [
        {
          exercise_id: 'barbell_bench_press',
          name: 'Barbell Bench Press',
          sets: [
            { reps: 10, loadVal: 50, unit: 'kg', rpe: 6.0 },
            { reps: 10, loadVal: 50, unit: 'kg', rpe: 6.0 },
            { reps: 10, loadVal: 50, unit: 'kg', rpe: 6.0 },
          ],
        },
      ]),
    ];

    const result = evaluateWorkoutProgression({
      plan,
      history,
      options: { now: FIXED_NOW },
    });

    const benchAdj = result.exercise_adjustments.find(
      (a) => a.exercise_id === 'barbell_bench_press',
    );
    expect(benchAdj?.action).toBe('progress');
    // Upper body compound cap is <= +2.5 kg
    expect(benchAdj?.delta.load_delta).toBe(2.5);
    expect(benchAdj?.proposed_prescription.load?.value).toBe(52.5);
    // Relative cap: 52.5 <= 50 * 1.10 = 55.0
    expect(benchAdj?.proposed_prescription.load?.value).toBeLessThanOrEqual(50 * 1.1);
  });

  it('P8-03 Edge Case: Pain or injury notes trigger an immediate safety halt', () => {
    const plan = createMockWorkoutPlan();

    const historyWithPain = [
      createSession('2026-10-02', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
          ],
        },
      ]),
      createSession(
        '2026-10-06',
        [
          {
            exercise_id: 'barbell_back_squat',
            name: 'Barbell Back Squat',
            sets: [
              { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
              { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
            ],
            notes: 'Felt a sharp pinch and knee pain in bottom position.',
          },
        ],
        'Cut session short due to knee discomfort.',
      ),
    ];

    const result = evaluateWorkoutProgression({
      plan,
      history: historyWithPain,
      options: { now: FIXED_NOW },
    });

    const squatAdj = result.exercise_adjustments.find(
      (a) => a.exercise_id === 'barbell_back_squat',
    );
    expect(squatAdj?.action).toBe('maintain');
    expect(squatAdj?.delta.load_delta).toBe(0);
    expect(squatAdj?.confidence).toBe(1.0);
    expect(squatAdj?.warnings.some((w) => w.includes('Safety alert'))).toBe(true);
    expect(squatAdj?.reason).toContain('Safety halt');
  });

  it('P8-03 Edge Case: Plateau detection triggers a 10% deload', () => {
    const plan = createMockWorkoutPlan();

    // 3 consecutive sessions at same weight with high effort (RPE 9.0) and failing top reps
    const plateauHistory = [
      createSession('2026-09-28', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 8, loadVal: 60, unit: 'kg', rpe: 9.0 },
            { reps: 7, loadVal: 60, unit: 'kg', rpe: 9.5 },
            { reps: 6, loadVal: 60, unit: 'kg', rpe: 10.0 },
          ],
        },
      ]),
      createSession('2026-10-02', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 8, loadVal: 60, unit: 'kg', rpe: 9.0 },
            { reps: 7, loadVal: 60, unit: 'kg', rpe: 9.5 },
            { reps: 6, loadVal: 60, unit: 'kg', rpe: 10.0 },
          ],
        },
      ]),
      createSession('2026-10-06', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 8, loadVal: 60, unit: 'kg', rpe: 9.0 },
            { reps: 7, loadVal: 60, unit: 'kg', rpe: 9.5 },
            { reps: 6, loadVal: 60, unit: 'kg', rpe: 10.0 },
          ],
        },
      ]),
    ];

    const result = evaluateWorkoutProgression({
      plan,
      history: plateauHistory,
      options: { now: FIXED_NOW },
    });

    const squatAdj = result.exercise_adjustments.find(
      (a) => a.exercise_id === 'barbell_back_squat',
    );
    expect(squatAdj?.action).toBe('deload');
    expect(squatAdj?.delta.load_delta).toBe(-6.25); // 10% of 60 rounded to 1.25 plate
    expect(squatAdj?.proposed_prescription.load?.value).toBe(53.75);
    expect(squatAdj?.reason).toContain('Plateau detected');
  });

  it('P8-03 Edge Case: Bodyweight exercise progression advances repetition targets', () => {
    const plan = createMockWorkoutPlan();

    const pushupHistory = [
      createSession('2026-10-01', [
        {
          exercise_id: 'push_up',
          name: 'Push-Up',
          sets: [
            { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
            { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
            { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.5 },
          ],
        },
      ]),
      createSession('2026-10-05', [
        {
          exercise_id: 'push_up',
          name: 'Push-Up',
          sets: [
            { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
            { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
            { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
          ],
        },
      ]),
    ];

    const result = evaluateWorkoutProgression({
      plan,
      history: pushupHistory,
      options: { now: FIXED_NOW },
    });

    const pushupAdj = result.exercise_adjustments.find((a) => a.exercise_id === 'push_up');
    expect(pushupAdj?.action).toBe('progress');
    expect(pushupAdj?.delta.load_delta).toBe(0);
    expect(pushupAdj?.proposed_prescription.target_reps).toBe('11-17'); // 10+1 to 15+2
    expect(pushupAdj?.reason).toContain('Bodyweight repetition target hit comfortably');
  });

  it('P8-04: Applying progression generates a valid, verified workout plan version', () => {
    const plan = createMockWorkoutPlan();

    const history = [
      createSession('2026-10-01', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
          ],
        },
      ]),
      createSession('2026-10-05', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
            { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
          ],
        },
      ]),
    ];

    const proposal = evaluateWorkoutProgression({
      plan,
      history,
      options: { now: FIXED_NOW },
    });

    expect(plan.current_version.payload.kind).toBe('workout');
    if (plan.current_version.payload.kind !== 'workout') return;

    const { updatedPayload, verification, adjustedExercisesCount } = applyProgressionToWorkoutPlan(
      plan.current_version.payload,
      proposal,
    );

    expect(adjustedExercisesCount).toBeGreaterThanOrEqual(1);
    expect(verification.valid).toBe(true);
    expect(verification.hard_violations).toHaveLength(0);

    const updatedSquat = updatedPayload.days[0]?.exercises.find(
      (e) => e.exercise_id === 'barbell_back_squat',
    );
    expect(updatedSquat?.prescribed_load?.value).toBe(65);
    expect(updatedPayload.notes).toContain('Adaptive Progression');
  });

  it('Deterministic reproducibility: identical input produces byte-for-byte identical output', () => {
    const plan = createMockWorkoutPlan();
    const history = [
      createSession('2026-10-02', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [{ reps: 8, loadVal: 60, unit: 'kg', rpe: 8.0 }],
        },
      ]),
      createSession('2026-10-05', [
        {
          exercise_id: 'barbell_back_squat',
          name: 'Barbell Back Squat',
          sets: [{ reps: 8, loadVal: 60, unit: 'kg', rpe: 8.0 }],
        },
      ]),
    ];

    const run1 = evaluateWorkoutProgression({ plan, history, options: { now: FIXED_NOW } });
    const run2 = evaluateWorkoutProgression({ plan, history, options: { now: FIXED_NOW } });

    // Both IDs are UUIDs, but everything else is identical
    expect({ ...run1, id: 'static' }).toEqual({ ...run2, id: 'static' });
  });
});
