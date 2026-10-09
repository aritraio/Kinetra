import type {
  PlanWithVersion,
  ProgressionAction,
  TrainingSessionRecord,
  WorkoutPlanPayload,
} from '../../packages/contracts/src';

export interface LabeledProgressionScenario {
  readonly id: string;
  readonly name: string;
  readonly category:
    | 'progressive_overload'
    | 'plateau_recovery'
    | 'inactivity_layoff'
    | 'safety_halt'
    | 'data_sufficiency'
    | 'boundary_capping'
    | 'bodyweight_volume';
  readonly description: string;
  readonly plan: PlanWithVersion;
  readonly history: readonly TrainingSessionRecord[];
  readonly targetExerciseId: string;
  readonly expectedAction: ProgressionAction;
  readonly expectedLoadDelta: number;
  readonly expectedNewLoad?: number;
  readonly expectedRepsDelta?: number;
  readonly expectedConfidenceMin: number;
  readonly expectedWarningSubstring?: string;
  readonly evaluationTimestamp: string;
}

const EVAL_NOW = '2026-10-09T12:00:00Z';

function makePlan(
  exerciseId: string,
  exerciseName: string,
  targetSets: number,
  targetReps: string,
  loadVal: number,
  unit: 'kg' | 'lb',
  equipment: string,
): PlanWithVersion {
  const payload: WorkoutPlanPayload = {
    kind: 'workout',
    schema_version: '2026-10-01',
    policy_version: '2026-10-01',
    split_name: 'Progression Eval Split',
    days_per_week: 1,
    days: [
      {
        day_number: 1,
        day_name: 'Test Day',
        focus: 'Eval Movement',
        is_rest_day: false,
        exercises: [
          {
            exercise_id: exerciseId,
            name: exerciseName,
            target_sets: targetSets,
            target_reps: targetReps,
            rest_seconds: 120,
            prescribed_load: loadVal > 0 ? { value: loadVal, unit } : undefined,
            rpe: 8.0,
            equipment,
          },
        ],
      },
    ],
  };

  return {
    plan: {
      id: crypto.randomUUID(),
      owner_id: '00000000-0000-4000-8000-000000000001',
      kind: 'workout',
      current_version: 1,
      created_at: '2026-09-01T00:00:00Z',
    },
    current_version: {
      plan_id: crypto.randomUUID(),
      owner_id: '00000000-0000-4000-8000-000000000001',
      version: 1,
      payload,
      schema_version: '2026-10-01',
      policy_version: '2026-10-01',
      prompt_version: 'v1.0-eval',
      provenance: 'template',
      created_at: '2026-09-01T00:00:00Z',
    },
  };
}

function makeSession(
  dateIso: string,
  exerciseId: string,
  exerciseName: string,
  sets: Array<{
    reps: number;
    loadVal: number;
    unit: 'kg' | 'lb';
    rpe?: number;
    completed?: boolean;
  }>,
  sessionNotes?: string,
): TrainingSessionRecord {
  return {
    id: crypto.randomUUID(),
    owner_id: '00000000-0000-4000-8000-000000000001',
    plan_id: crypto.randomUUID(),
    plan_version: 1,
    started_at: `${dateIso}T17:00:00Z`,
    completed_at: `${dateIso}T18:00:00Z`,
    notes: sessionNotes,
    exercises: [
      {
        exercise_id: exerciseId,
        name: exerciseName,
        sets: sets.map((s, idx) => ({
          set_number: idx + 1,
          reps: s.reps,
          load: { value: s.loadVal, unit: s.unit },
          rpe: s.rpe,
          completed: s.completed ?? true,
        })),
      },
    ],
    created_at: `${dateIso}T18:05:00Z`,
  };
}

export const PROGRESSION_SCENARIOS: readonly LabeledProgressionScenario[] = [
  // 1. Steady Lower Body Compound Progression
  {
    id: 'SCENARIO-01-SQUAT-PROGRESSION',
    name: 'Lower Body Compound Progressive Overload',
    category: 'progressive_overload',
    description:
      'Squat 3x8-10 at 60kg logged across 3 sessions at RPE 7.0-7.5. Expect +5.0 kg increase.',
    plan: makePlan('barbell_back_squat', 'Barbell Back Squat', 3, '8-10', 60, 'kg', 'barbell'),
    history: [
      makeSession('2026-09-28', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.5 },
      ]),
      makeSession('2026-10-02', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.5 },
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.5 },
      ]),
      makeSession('2026-10-06', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
      ]),
    ],
    targetExerciseId: 'barbell_back_squat',
    expectedAction: 'progress',
    expectedLoadDelta: 5.0,
    expectedNewLoad: 65.0,
    expectedConfidenceMin: 0.9,
    evaluationTimestamp: EVAL_NOW,
  },

  // 2. Steady Upper Body Compound Progression
  {
    id: 'SCENARIO-02-BENCH-PROGRESSION',
    name: 'Upper Body Compound Progressive Overload',
    category: 'progressive_overload',
    description:
      'Bench press 3x8-10 at 50kg logged across 3 sessions at RPE 7.0-7.5. Expect +2.5 kg increase.',
    plan: makePlan('barbell_bench_press', 'Barbell Bench Press', 3, '8-10', 50, 'kg', 'barbell'),
    history: [
      makeSession('2026-09-29', 'barbell_bench_press', 'Barbell Bench Press', [
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.5 },
      ]),
      makeSession('2026-10-03', 'barbell_bench_press', 'Barbell Bench Press', [
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.5 },
      ]),
      makeSession('2026-10-07', 'barbell_bench_press', 'Barbell Bench Press', [
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.0 },
        { reps: 10, loadVal: 50, unit: 'kg', rpe: 7.0 },
      ]),
    ],
    targetExerciseId: 'barbell_bench_press',
    expectedAction: 'progress',
    expectedLoadDelta: 2.5,
    expectedNewLoad: 52.5,
    expectedConfidenceMin: 0.9,
    evaluationTimestamp: EVAL_NOW,
  },

  // 3. Plateau Detection & Deload
  {
    id: 'SCENARIO-03-DEADLIFT-PLATEAU',
    name: 'Neuromuscular Plateau Reactive Deload',
    category: 'plateau_recovery',
    description:
      'Deadlift stalled across 3 sessions with high exertion (RPE 9.5-10.0). Expect 10% deload.',
    plan: makePlan(
      'barbell_deadlift',
      'Barbell Conventional Deadlift',
      3,
      '5',
      100,
      'kg',
      'barbell',
    ),
    history: [
      makeSession('2026-09-27', 'barbell_deadlift', 'Barbell Conventional Deadlift', [
        { reps: 5, loadVal: 100, unit: 'kg', rpe: 9.5 },
        { reps: 4, loadVal: 100, unit: 'kg', rpe: 10.0 },
        { reps: 3, loadVal: 100, unit: 'kg', rpe: 10.0 },
      ]),
      makeSession('2026-10-01', 'barbell_deadlift', 'Barbell Conventional Deadlift', [
        { reps: 5, loadVal: 100, unit: 'kg', rpe: 9.5 },
        { reps: 4, loadVal: 100, unit: 'kg', rpe: 10.0 },
        { reps: 3, loadVal: 100, unit: 'kg', rpe: 10.0 },
      ]),
      makeSession('2026-10-05', 'barbell_deadlift', 'Barbell Conventional Deadlift', [
        { reps: 4, loadVal: 100, unit: 'kg', rpe: 10.0 },
        { reps: 4, loadVal: 100, unit: 'kg', rpe: 10.0 },
        { reps: 3, loadVal: 100, unit: 'kg', rpe: 10.0 },
      ]),
    ],
    targetExerciseId: 'barbell_deadlift',
    expectedAction: 'deload',
    expectedLoadDelta: -10.0,
    expectedNewLoad: 90.0,
    expectedConfidenceMin: 0.85,
    evaluationTimestamp: EVAL_NOW,
  },

  // 4. Inactivity Re-acclimatization (15-28 days hiatus)
  {
    id: 'SCENARIO-04-HIATUS-REACCLIMATIZATION',
    name: 'Training Hiatus Re-acclimatization Deload',
    category: 'inactivity_layoff',
    description: 'Last workout was 19 days ago. Expect 10% conservative load reduction.',
    plan: makePlan('barbell_back_squat', 'Barbell Back Squat', 3, '8-10', 80, 'kg', 'barbell'),
    history: [
      makeSession('2026-09-16', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 8, loadVal: 80, unit: 'kg', rpe: 7.5 },
      ]),
      makeSession('2026-09-20', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 8, loadVal: 80, unit: 'kg', rpe: 7.5 },
      ]),
    ],
    targetExerciseId: 'barbell_back_squat',
    expectedAction: 'deload',
    expectedLoadDelta: -8.75, // 10% of 80 is 8.0, rounded to 1.25 plate is 8.75 (or 7.5)
    expectedNewLoad: 71.25,
    expectedConfidenceMin: 0.85,
    evaluationTimestamp: EVAL_NOW,
  },

  // 5. Extended Layoff (> 28 days detraining)
  {
    id: 'SCENARIO-05-EXTENDED-LAYOFF',
    name: 'Extended Detraining Layoff Reset',
    category: 'inactivity_layoff',
    description: 'Last workout was 35 days ago. Expect 15% load reduction.',
    plan: makePlan('barbell_bench_press', 'Barbell Bench Press', 3, '8-10', 70, 'kg', 'barbell'),
    history: [
      makeSession('2026-08-30', 'barbell_bench_press', 'Barbell Bench Press', [
        { reps: 8, loadVal: 70, unit: 'kg', rpe: 7.5 },
      ]),
      makeSession('2026-09-04', 'barbell_bench_press', 'Barbell Bench Press', [
        { reps: 8, loadVal: 70, unit: 'kg', rpe: 7.5 },
      ]),
    ],
    targetExerciseId: 'barbell_bench_press',
    expectedAction: 'deload',
    expectedLoadDelta: -10.0, // 15% of 70 = 10.5, rounded to 1.25 is 10.0
    expectedNewLoad: 60.0,
    expectedConfidenceMin: 0.9,
    evaluationTimestamp: EVAL_NOW,
  },

  // 6. Insufficient History
  {
    id: 'SCENARIO-06-INSUFFICIENT-HISTORY',
    name: 'Insufficient Observation Data Protection',
    category: 'data_sufficiency',
    description:
      'Only 1 session logged. Policy refuses automated progression and preserves baseline.',
    plan: makePlan('barbell_back_squat', 'Barbell Back Squat', 3, '8-10', 60, 'kg', 'barbell'),
    history: [
      makeSession('2026-10-06', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 10, loadVal: 60, unit: 'kg', rpe: 7.0 },
      ]),
    ],
    targetExerciseId: 'barbell_back_squat',
    expectedAction: 'insufficient_data',
    expectedLoadDelta: 0.0,
    expectedConfidenceMin: 0.0,
    evaluationTimestamp: EVAL_NOW,
  },

  // 7. Conflicting / High Strain Over-exertion
  {
    id: 'SCENARIO-07-EXCESSIVE-EXERTION',
    name: 'Over-reaching Strain Protection',
    category: 'plateau_recovery',
    description:
      'User completed sets but logged maximum exhaustion (avg RPE 9.8). Expect 5% reactive deload.',
    plan: makePlan('barbell_bench_press', 'Barbell Bench Press', 3, '8-10', 60, 'kg', 'barbell'),
    history: [
      makeSession('2026-10-02', 'barbell_bench_press', 'Barbell Bench Press', [
        { reps: 8, loadVal: 60, unit: 'kg', rpe: 9.5 },
        { reps: 8, loadVal: 60, unit: 'kg', rpe: 10.0 },
        { reps: 7, loadVal: 60, unit: 'kg', rpe: 10.0 },
      ]),
      makeSession('2026-10-06', 'barbell_bench_press', 'Barbell Bench Press', [
        { reps: 8, loadVal: 60, unit: 'kg', rpe: 9.5 },
        { reps: 8, loadVal: 60, unit: 'kg', rpe: 10.0 },
        { reps: 7, loadVal: 60, unit: 'kg', rpe: 10.0 },
      ]),
    ],
    targetExerciseId: 'barbell_bench_press',
    expectedAction: 'deload',
    expectedLoadDelta: -3.75, // 5% of 60 = 3.0, rounded to 1.25 is 3.75
    expectedNewLoad: 56.25,
    expectedConfidenceMin: 0.8,
    evaluationTimestamp: EVAL_NOW,
  },

  // 8. Pain & Injury Safety Halt
  {
    id: 'SCENARIO-08-SAFETY-HALT',
    name: 'Musculoskeletal Pain Safety Halt',
    category: 'safety_halt',
    description:
      'Training notes note joint pain. Progression immediately halted, safety alert emitted.',
    plan: makePlan('barbell_back_squat', 'Barbell Back Squat', 3, '8-10', 70, 'kg', 'barbell'),
    history: [
      makeSession('2026-10-02', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 10, loadVal: 70, unit: 'kg', rpe: 7.0 },
      ]),
      makeSession(
        '2026-10-06',
        'barbell_back_squat',
        'Barbell Back Squat',
        [{ reps: 10, loadVal: 70, unit: 'kg', rpe: 7.0 }],
        'Sharp knee ache and discomfort at parallel.',
      ),
    ],
    targetExerciseId: 'barbell_back_squat',
    expectedAction: 'maintain',
    expectedLoadDelta: 0.0,
    expectedConfidenceMin: 1.0,
    expectedWarningSubstring: 'Safety alert',
    evaluationTimestamp: EVAL_NOW,
  },

  // 9. Boundary Capping Protection
  {
    id: 'SCENARIO-09-BOUNDARY-CAPPING',
    name: 'Upper Bound Clamping Protection',
    category: 'boundary_capping',
    description: 'Massive jump attempted. Capped strictly to <= 10% and +5.0 kg compound ceiling.',
    plan: makePlan('barbell_back_squat', 'Barbell Back Squat', 3, '8-10', 100, 'kg', 'barbell'),
    history: [
      makeSession('2026-10-01', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 10, loadVal: 100, unit: 'kg', rpe: 6.0 },
        { reps: 10, loadVal: 100, unit: 'kg', rpe: 6.0 },
        { reps: 10, loadVal: 100, unit: 'kg', rpe: 6.0 },
      ]),
      makeSession('2026-10-05', 'barbell_back_squat', 'Barbell Back Squat', [
        { reps: 10, loadVal: 100, unit: 'kg', rpe: 6.0 },
        { reps: 10, loadVal: 100, unit: 'kg', rpe: 6.0 },
        { reps: 10, loadVal: 100, unit: 'kg', rpe: 6.0 },
      ]),
    ],
    targetExerciseId: 'barbell_back_squat',
    expectedAction: 'progress',
    expectedLoadDelta: 5.0, // Capped to 5.0 kg
    expectedNewLoad: 105.0,
    expectedConfidenceMin: 0.9,
    evaluationTimestamp: EVAL_NOW,
  },

  // 10. Bodyweight Volume Progression
  {
    id: 'SCENARIO-10-BODYWEIGHT-VOLUME',
    name: 'Bodyweight Repetition Volume Progression',
    category: 'bodyweight_volume',
    description: 'Push-ups 3x10-15 completed easily at RPE 7.0. Expect rep increase to 11-17.',
    plan: makePlan('push_up', 'Push-Up', 3, '10-15', 0, 'kg', 'bodyweight'),
    history: [
      makeSession('2026-10-01', 'push_up', 'Push-Up', [
        { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
        { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
        { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
      ]),
      makeSession('2026-10-05', 'push_up', 'Push-Up', [
        { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
        { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
        { reps: 15, loadVal: 0, unit: 'kg', rpe: 7.0 },
      ]),
    ],
    targetExerciseId: 'push_up',
    expectedAction: 'progress',
    expectedLoadDelta: 0.0,
    expectedRepsDelta: 2,
    expectedConfidenceMin: 0.9,
    evaluationTimestamp: EVAL_NOW,
  },
];
