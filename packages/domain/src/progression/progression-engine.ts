import type {
  ExercisePrescriptionSnapshot,
  ExerciseProgressionAdjustment,
  PlanWithVersion,
  ProgressionAction,
  ProgressionProposal,
  TrainingSessionRecord,
  WorkoutExercise,
  WorkoutPlanPayload,
} from '@kinetra/contracts';
import { PROGRESSION_POLICY_VERSION } from '@kinetra/contracts';
import { findExercise } from '../catalog';
import { weightInKg, weightInLb } from '../units';

export interface ProgressionEngineOptions {
  /**
   * Analysis lookback window in days. Default is 28 days.
   */
  readonly lookbackDays?: number;
  /**
   * Minimum required completed sessions for an exercise within the lookback window. Default is 2.
   */
  readonly minSessionsRequired?: number;
  /**
   * Override current timestamp for deterministic evaluation.
   */
  readonly now?: string | Date;
  /**
   * Preferred weight unit ('kg' | 'lb').
   */
  readonly preferredUnit?: 'kg' | 'lb';
}

export interface ProgressionEngineInput {
  readonly plan:
    | PlanWithVersion
    | { plan: { id: string }; current_version: { version: number; payload: WorkoutPlanPayload } };
  readonly history: readonly TrainingSessionRecord[];
  readonly options?: ProgressionEngineOptions;
}

interface ParsedRepTarget {
  readonly minReps: number;
  readonly maxReps: number;
}

export function parseRepRange(targetReps: string): ParsedRepTarget {
  const cleaned = targetReps.trim();
  const rangeMatch = cleaned.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const minReps = parseInt(rangeMatch[1] ?? '8', 10);
    const maxReps = parseInt(rangeMatch[2] ?? '12', 10);
    return { minReps: Math.min(minReps, maxReps), maxReps: Math.max(minReps, maxReps) };
  }

  const singleMatch = cleaned.match(/(\d+)/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1] ?? '10', 10);
    return { minReps: val, maxReps: val };
  }

  return { minReps: 8, maxReps: 12 };
}

function roundToPlateIncrement(value: number, unit: 'kg' | 'lb', isBarbell: boolean): number {
  if (unit === 'kg') {
    const step = isBarbell ? 1.25 : 1.0;
    const rounded = Math.round(value / step) * step;
    return Math.round(rounded * 100) / 100;
  }
  const step = 2.5;
  const rounded = Math.round(value / step) * step;
  return Math.round(rounded * 10) / 10;
}

function isLowerBody(exerciseId: string, name: string): boolean {
  const norm = (exerciseId + ' ' + name).toLowerCase();
  if (
    norm.includes('squat') ||
    norm.includes('deadlift') ||
    norm.includes('lunge') ||
    norm.includes('leg press') ||
    norm.includes('rdl') ||
    norm.includes('calf')
  ) {
    return true;
  }
  const catalogEntry = findExercise(exerciseId) ?? findExercise(name);
  if (catalogEntry) {
    const muscle = catalogEntry.primary_muscle;
    return (
      muscle === 'quadriceps' ||
      muscle === 'hamstrings' ||
      muscle === 'glutes' ||
      muscle === 'calves'
    );
  }
  return false;
}

function isBarbellExercise(exerciseId: string, name: string, equipment: string): boolean {
  const norm = (exerciseId + ' ' + name + ' ' + equipment).toLowerCase();
  return norm.includes('barbell');
}

const PAIN_KEYWORDS =
  /\b(pain|hurts|hurt|injury|strain|sprain|tweak|sharp|ache|aching|tear|discomfort|pinch)\b/i;

interface ExerciseHistoryAggregation {
  sessionsCount: number;
  sessionDates: string[];
  daysSinceLastSession: number;
  totalSets: number;
  completedSets: number;
  avgRpe: number | undefined;
  completionRatePct: number;
  hasPainSignal: boolean;
  painNotes: string[];
  plateauCandidateCount: number;
  latestObservedLoad?: { value: number; unit: 'kg' | 'lb' } | undefined;
}

function analyzeExerciseHistory(
  exercise: WorkoutExercise,
  history: readonly TrainingSessionRecord[],
  lookbackDays: number,
  nowTimestampMs: number,
  targetUnit: 'kg' | 'lb',
): ExerciseHistoryAggregation {
  const cutoffMs = nowTimestampMs - lookbackDays * 86_400_000;
  const repTarget = parseRepRange(exercise.target_reps);

  // Filter sessions within lookback
  const relevantSessions = history
    .filter((s) => {
      const t = new Date(s.started_at).getTime();
      return !Number.isNaN(t) && t >= cutoffMs && t <= nowTimestampMs + 3_600_000;
    })
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  const matchingSessions: Array<{
    session: TrainingSessionRecord;
    performedExercise: NonNullable<TrainingSessionRecord['exercises'][number]>;
    workingSets: Array<{
      reps: number;
      loadKg: number;
      loadUnitVal: number;
      rpe?: number;
      completed: boolean;
    }>;
  }> = [];

  for (const s of relevantSessions) {
    const found = s.exercises.find((e) => {
      if (e.exercise_id === exercise.exercise_id) return true;
      const q = e.name.toLowerCase().trim();
      const exQ = exercise.name.toLowerCase().trim();
      return q === exQ || q.includes(exQ) || exQ.includes(q);
    });

    if (!found) continue;

    const validSets = found.sets
      .filter((set) => set.completed && set.reps > 0)
      .map((set) => {
        const val = set.load.value;
        const loadKg = set.load.unit === 'kg' ? val : weightInKg(val, 'lb');
        const loadInTarget = targetUnit === 'kg' ? loadKg : weightInLb(loadKg);
        return {
          reps: set.reps,
          loadKg,
          loadUnitVal: loadInTarget,
          ...(set.rpe !== undefined ? { rpe: set.rpe } : {}),
          completed: set.completed,
        };
      });

    matchingSessions.push({
      session: s,
      performedExercise: found,
      workingSets: validSets,
    });
  }

  const sessionDates = matchingSessions.map((m) => m.session.started_at.slice(0, 10));
  const mostRecentTimestamp = matchingSessions[0]
    ? new Date(matchingSessions[0].session.started_at).getTime()
    : 0;
  const daysSinceLastSession =
    mostRecentTimestamp > 0
      ? Math.max(0, Math.round((nowTimestampMs - mostRecentTimestamp) / 86_400_000))
      : 999;

  let totalPrescribedSetsCount = 0;
  let completedTargetSetsCount = 0;
  let totalRpeSum = 0;
  let rpeCount = 0;
  let hasPain = false;
  const painNotes: string[] = [];

  for (const m of matchingSessions) {
    if (m.session.notes && PAIN_KEYWORDS.test(m.session.notes)) {
      hasPain = true;
      painNotes.push(m.session.notes);
    }
    if (m.performedExercise.notes && PAIN_KEYWORDS.test(m.performedExercise.notes)) {
      hasPain = true;
      painNotes.push(m.performedExercise.notes);
    }

    totalPrescribedSetsCount += exercise.target_sets;
    for (const ws of m.workingSets) {
      if (ws.reps >= repTarget.minReps) {
        completedTargetSetsCount++;
      }
      if (ws.rpe && ws.rpe >= 1 && ws.rpe <= 10) {
        totalRpeSum += ws.rpe;
        rpeCount++;
      }
    }
  }

  const completionRatePct =
    totalPrescribedSetsCount > 0
      ? Math.min(100, Math.round((completedTargetSetsCount / totalPrescribedSetsCount) * 100))
      : 0;
  const avgRpe = rpeCount > 0 ? Math.round((totalRpeSum / rpeCount) * 10) / 10 : undefined;

  // Check plateau: 3 consecutive matching sessions where load remained static and either avg RPE >= 8.5 or reps < top of range
  let plateauCandidateCount = 0;
  if (matchingSessions.length >= 3) {
    const first3 = matchingSessions.slice(0, 3);
    const loads = first3.map((s) => s.workingSets[0]?.loadUnitVal ?? 0);
    const allSameLoad =
      loads.length === 3 &&
      loads[0] !== 0 &&
      loads.every((l) => Math.abs(l - (loads[0] ?? 0)) < 1.0);

    if (allSameLoad) {
      const allHighRpeOrStalled = first3.every((s) => {
        const sRpes = s.workingSets.map((w) => w.rpe).filter((r): r is number => r !== undefined);
        const sAvg = sRpes.length > 0 ? sRpes.reduce((a, b) => a + b, 0) / sRpes.length : 8.5;
        const hitMax = s.workingSets.every((w) => w.reps >= repTarget.maxReps);
        return sAvg >= 8.5 || !hitMax;
      });
      if (allHighRpeOrStalled) {
        plateauCandidateCount = 3;
      }
    }
  }

  const latestObservedLoad = matchingSessions[0]?.workingSets[0]
    ? { value: matchingSessions[0].workingSets[0].loadUnitVal, unit: targetUnit }
    : undefined;

  return {
    sessionsCount: matchingSessions.length,
    sessionDates,
    daysSinceLastSession,
    totalSets: totalPrescribedSetsCount,
    completedSets: completedTargetSetsCount,
    avgRpe,
    completionRatePct,
    hasPainSignal: hasPain,
    painNotes,
    plateauCandidateCount,
    ...(latestObservedLoad !== undefined ? { latestObservedLoad } : {}),
  };
}

export function evaluateExerciseAdjustment(
  exercise: WorkoutExercise,
  history: readonly TrainingSessionRecord[],
  overallDaysSinceAnySession: number,
  options: {
    lookbackDays: number;
    minSessionsRequired: number;
    nowTimestampMs: number;
    preferredUnit: 'kg' | 'lb';
  },
): ExerciseProgressionAdjustment {
  const currentUnit = exercise.prescribed_load?.unit ?? options.preferredUnit;
  const currentLoadVal = exercise.prescribed_load?.value ?? 0;
  const isBarbell = isBarbellExercise(exercise.exercise_id, exercise.name, exercise.equipment);
  const isLower = isLowerBody(exercise.exercise_id, exercise.name);

  const currentSnapshot: ExercisePrescriptionSnapshot = {
    target_sets: exercise.target_sets,
    target_reps: exercise.target_reps,
    load: exercise.prescribed_load ? { value: currentLoadVal, unit: currentUnit } : undefined,
    rpe: exercise.rpe,
  };

  const agg = analyzeExerciseHistory(
    exercise,
    history,
    options.lookbackDays,
    options.nowTimestampMs,
    currentUnit,
  );

  const warnings: string[] = [];

  // 1. Safety Halt on pain or injury
  if (agg.hasPainSignal) {
    warnings.push(
      'Safety alert: discomfort or pain flagged in training notes. Automated load advancement stopped.',
    );
    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'maintain',
      current_prescription: currentSnapshot,
      proposed_prescription: currentSnapshot,
      delta: { load_delta: 0, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason:
        'Safety halt: session notes indicate joint discomfort or pain. Prescribed load maintained constant to prioritize musculoskeletal recovery.',
      evidence: {
        sessions_analyzed: agg.sessionsCount,
        session_dates: agg.sessionDates,
        avg_rpe: agg.avgRpe,
        completion_rate_pct: agg.completionRatePct,
        plateau_sessions_count: agg.plateauCandidateCount,
        days_since_last_session: agg.daysSinceLastSession,
        sets_evaluated: agg.completedSets,
      },
      confidence: 1.0,
      warnings,
    };
  }

  // 2. Inadequate History Threshold (no sessions ever recorded in history)
  if (history.length === 0 || overallDaysSinceAnySession < 0) {
    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'insufficient_data',
      current_prescription: currentSnapshot,
      proposed_prescription: currentSnapshot,
      delta: { load_delta: 0, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason:
        'No completed sessions logged within the 28-day observation window. Preserving baseline prescription.',
      evidence: {
        sessions_analyzed: 0,
        session_dates: [],
        avg_rpe: agg.avgRpe,
        completion_rate_pct: 0,
        plateau_sessions_count: 0,
        days_since_last_session: agg.daysSinceLastSession,
      },
      confidence: 0.0,
      warnings,
    };
  }

  // 3. Extended Layoff (> 28 days without training across history)
  if (overallDaysSinceAnySession > 28 && currentLoadVal > 0) {
    const rawDeload = currentLoadVal * 0.15;
    const roundedDeload = roundToPlateIncrement(rawDeload, currentUnit, isBarbell);
    const newLoad = Math.max(0, currentLoadVal - roundedDeload);
    const actualDelta = Math.round((newLoad - currentLoadVal) * 100) / 100;

    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'deload',
      current_prescription: currentSnapshot,
      proposed_prescription: {
        ...currentSnapshot,
        load: { value: newLoad, unit: currentUnit },
      },
      delta: { load_delta: actualDelta, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason: `Extended layoff (${overallDaysSinceAnySession} days without training). Conservative 15% load reduction (${actualDelta} ${currentUnit}) to re-acclimate connective tissue safely.`,
      evidence: {
        sessions_analyzed: agg.sessionsCount,
        session_dates: agg.sessionDates,
        avg_rpe: agg.avgRpe,
        completion_rate_pct: agg.completionRatePct,
        plateau_sessions_count: 0,
        days_since_last_session: overallDaysSinceAnySession,
      },
      confidence: 0.95,
      warnings,
    };
  }

  // 4. Inadequate data for this specific exercise (0 sessions within lookback)
  if (agg.sessionsCount === 0) {
    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'insufficient_data',
      current_prescription: currentSnapshot,
      proposed_prescription: currentSnapshot,
      delta: { load_delta: 0, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason:
        'No completed sessions logged within the 28-day observation window. Preserving baseline prescription.',
      evidence: {
        sessions_analyzed: 0,
        session_dates: [],
        avg_rpe: agg.avgRpe,
        completion_rate_pct: 0,
        plateau_sessions_count: 0,
        days_since_last_session: agg.daysSinceLastSession,
      },
      confidence: 0.0,
      warnings,
    };
  }

  // 5. Inactivity Deload / Layoff handling (only when user has active history, but has paused)
  const effectiveInactivityDays = Math.min(agg.daysSinceLastSession, overallDaysSinceAnySession);

  if (effectiveInactivityDays > 14 && currentLoadVal > 0) {
    const rawDeload = currentLoadVal * 0.1;
    const roundedDeload = roundToPlateIncrement(rawDeload, currentUnit, isBarbell);
    const newLoad = Math.max(0, currentLoadVal - roundedDeload);
    const actualDelta = Math.round((newLoad - currentLoadVal) * 100) / 100;

    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'deload',
      current_prescription: currentSnapshot,
      proposed_prescription: {
        ...currentSnapshot,
        load: { value: newLoad, unit: currentUnit },
      },
      delta: { load_delta: actualDelta, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason: `Training hiatus (${effectiveInactivityDays} days). Recommended 10% re-acclimatization deload (${actualDelta} ${currentUnit}) to rebuild work capacity without excessive soreness.`,
      evidence: {
        sessions_analyzed: agg.sessionsCount,
        session_dates: agg.sessionDates,
        avg_rpe: agg.avgRpe,
        completion_rate_pct: agg.completionRatePct,
        plateau_sessions_count: 0,
        days_since_last_session: effectiveInactivityDays,
      },
      confidence: 0.9,
      warnings,
    };
  }

  if (effectiveInactivityDays > 7 && currentLoadVal > 0) {
    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'maintain',
      current_prescription: currentSnapshot,
      proposed_prescription: currentSnapshot,
      delta: { load_delta: 0, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason: `Training gap (${effectiveInactivityDays} days). Holding current load constant to re-establish training rhythm before advancing.`,
      evidence: {
        sessions_analyzed: agg.sessionsCount,
        session_dates: agg.sessionDates,
        avg_rpe: agg.avgRpe,
        completion_rate_pct: agg.completionRatePct,
        plateau_sessions_count: 0,
        days_since_last_session: effectiveInactivityDays,
      },
      confidence: 0.85,
      warnings,
    };
  }

  // 4. Inadequate History Threshold (< minSessionsRequired, e.g. exactly 1 session)
  if (agg.sessionsCount < options.minSessionsRequired) {
    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'insufficient_data',
      current_prescription: currentSnapshot,
      proposed_prescription: currentSnapshot,
      delta: { load_delta: 0, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason: `Only 1 session logged within the 28-day window (minimum ${options.minSessionsRequired} required for progression). Preserving baseline prescription.`,
      evidence: {
        sessions_analyzed: agg.sessionsCount,
        session_dates: agg.sessionDates,
        avg_rpe: agg.avgRpe,
        completion_rate_pct: agg.completionRatePct,
        plateau_sessions_count: 0,
        days_since_last_session: agg.daysSinceLastSession,
      },
      confidence: 0.2,
      warnings,
    };
  }

  // 4. Plateau Detection (3+ consecutive stagnant sessions at high effort)
  if (agg.plateauCandidateCount >= 3 && currentLoadVal > 0) {
    const rawDeload = currentLoadVal * 0.1;
    const roundedDeload = roundToPlateIncrement(rawDeload, currentUnit, isBarbell);
    const newLoad = Math.max(0, currentLoadVal - roundedDeload);
    const actualDelta = Math.round((newLoad - currentLoadVal) * 100) / 100;

    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'deload',
      current_prescription: currentSnapshot,
      proposed_prescription: {
        ...currentSnapshot,
        load: { value: newLoad, unit: currentUnit },
      },
      delta: { load_delta: actualDelta, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason: `Plateau detected across 3 sessions at elevated exertion (RPE ≥ 8.5). A 10% deload (${actualDelta} ${currentUnit}) allows neuromuscular recovery and supercompensation.`,
      evidence: {
        sessions_analyzed: agg.sessionsCount,
        session_dates: agg.sessionDates,
        avg_rpe: agg.avgRpe,
        completion_rate_pct: agg.completionRatePct,
        plateau_sessions_count: agg.plateauCandidateCount,
        days_since_last_session: agg.daysSinceLastSession,
      },
      confidence: 0.9,
      warnings,
    };
  }

  // 5. Over-exertion / High Strain (avg RPE >= 9.5 or completion rate < 70%)
  if ((agg.avgRpe !== undefined && agg.avgRpe >= 9.5) || agg.completionRatePct < 70) {
    if (currentLoadVal > 0) {
      const rawDeload = currentLoadVal * 0.05;
      const roundedDeload = roundToPlateIncrement(rawDeload, currentUnit, isBarbell);
      const newLoad = Math.max(0, currentLoadVal - roundedDeload);
      const actualDelta = Math.round((newLoad - currentLoadVal) * 100) / 100;

      const explanation =
        agg.avgRpe !== undefined && agg.avgRpe >= 9.5
          ? `Excessive exertion detected (avg RPE ${agg.avgRpe} ≥ 9.5). Reducing load by 5% (${actualDelta} ${currentUnit}) to prevent overreaching.`
          : `Volume completion below threshold (${agg.completionRatePct}% < 70%). Reducing load by 5% (${actualDelta} ${currentUnit}) to consolidate technical execution.`;

      return {
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.name,
        action: 'deload',
        current_prescription: currentSnapshot,
        proposed_prescription: {
          ...currentSnapshot,
          load: { value: newLoad, unit: currentUnit },
        },
        delta: { load_delta: actualDelta, reps_delta: 0, sets_delta: 0, unit: currentUnit },
        reason: explanation,
        evidence: {
          sessions_analyzed: agg.sessionsCount,
          session_dates: agg.sessionDates,
          avg_rpe: agg.avgRpe,
          completion_rate_pct: agg.completionRatePct,
          plateau_sessions_count: 0,
          days_since_last_session: agg.daysSinceLastSession,
        },
        confidence: 0.85,
        warnings,
      };
    }
  }

  // 6. Stimulus Sweet Spot (Maintenance: avg RPE 7.6 - 9.0)
  if (agg.avgRpe !== undefined && agg.avgRpe > 7.5 && agg.avgRpe <= 9.0) {
    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'maintain',
      current_prescription: currentSnapshot,
      proposed_prescription: currentSnapshot,
      delta: { load_delta: 0, reps_delta: 0, sets_delta: 0, unit: currentUnit },
      reason: `Target training stimulus achieved within optimal RPE band (7.6–9.0, avg ${agg.avgRpe}). Preserving current load to solidify neuromuscular adaptations.`,
      evidence: {
        sessions_analyzed: agg.sessionsCount,
        session_dates: agg.sessionDates,
        avg_rpe: agg.avgRpe,
        completion_rate_pct: agg.completionRatePct,
        plateau_sessions_count: 0,
        days_since_last_session: agg.daysSinceLastSession,
      },
      confidence: 0.9,
      warnings,
    };
  }

  // 7. Progressive Overload (Ready to progress: avg RPE <= 7.5 and completion rate >= 90%)
  if (agg.completionRatePct >= 90 && (agg.avgRpe === undefined || agg.avgRpe <= 7.5)) {
    if (currentLoadVal > 0) {
      // Determine max load step based on movement archetype and equipment
      let maxStep = isLower
        ? currentUnit === 'kg'
          ? 5.0
          : 10.0
        : currentUnit === 'kg'
          ? 2.5
          : 5.0;

      // Relative 10% ceiling check: step cannot exceed 10% of current load
      const tenPercentCap = currentLoadVal * 0.1;
      if (maxStep > tenPercentCap) {
        maxStep = tenPercentCap;
      }

      let roundedStep = roundToPlateIncrement(maxStep, currentUnit, isBarbell);
      // Ensure positive step if rounding clamped it to 0
      if (roundedStep <= 0) {
        roundedStep = currentUnit === 'kg' ? (isBarbell ? 1.25 : 1.0) : 2.5;
      }

      // Hard clamp so that newLoad <= currentLoadVal * 1.10
      const newLoad = Math.min(
        Math.round(currentLoadVal * 1.1 * 100) / 100,
        Math.round((currentLoadVal + roundedStep) * 100) / 100,
      );
      const actualDelta = Math.round((newLoad - currentLoadVal) * 100) / 100;

      const rpeNote =
        agg.avgRpe !== undefined ? ` at manageable effort (avg RPE ${agg.avgRpe} ≤ 7.5)` : '';
      return {
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.name,
        action: 'progress',
        current_prescription: currentSnapshot,
        proposed_prescription: {
          ...currentSnapshot,
          load: { value: newLoad, unit: currentUnit },
        },
        delta: { load_delta: actualDelta, reps_delta: 0, sets_delta: 0, unit: currentUnit },
        reason: `Consistent performance across ${agg.sessionsCount} sessions${rpeNote}. Advancing prescribed load by +${actualDelta} ${currentUnit}.`,
        evidence: {
          sessions_analyzed: agg.sessionsCount,
          session_dates: agg.sessionDates,
          avg_rpe: agg.avgRpe,
          completion_rate_pct: agg.completionRatePct,
          plateau_sessions_count: 0,
          days_since_last_session: agg.daysSinceLastSession,
        },
        confidence: 0.95,
        warnings,
      };
    }

    // Bodyweight / zero load progression: progress target reps
    const repRange = parseRepRange(exercise.target_reps);
    const newMin = repRange.minReps + 1;
    const newMax = repRange.maxReps + 2;
    const newRepsStr = `${newMin}-${newMax}`;

    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      action: 'progress',
      current_prescription: currentSnapshot,
      proposed_prescription: {
        ...currentSnapshot,
        target_reps: newRepsStr,
      },
      delta: { load_delta: 0, reps_delta: 2, sets_delta: 0, unit: currentUnit },
      reason: `Bodyweight repetition target hit comfortably (avg RPE ${agg.avgRpe ?? '≤ 7.5'}). Progressing volume target to ${newRepsStr} reps.`,
      evidence: {
        sessions_analyzed: agg.sessionsCount,
        session_dates: agg.sessionDates,
        avg_rpe: agg.avgRpe,
        completion_rate_pct: agg.completionRatePct,
        plateau_sessions_count: 0,
        days_since_last_session: agg.daysSinceLastSession,
      },
      confidence: 0.9,
      warnings,
    };
  }

  // Fallback: Maintain baseline
  return {
    exercise_id: exercise.exercise_id,
    exercise_name: exercise.name,
    action: 'maintain',
    current_prescription: currentSnapshot,
    proposed_prescription: currentSnapshot,
    delta: { load_delta: 0, reps_delta: 0, sets_delta: 0, unit: currentUnit },
    reason: 'Performance metrics stable within prescribed limits. Maintaining current load.',
    evidence: {
      sessions_analyzed: agg.sessionsCount,
      session_dates: agg.sessionDates,
      avg_rpe: agg.avgRpe,
      completion_rate_pct: agg.completionRatePct,
      plateau_sessions_count: 0,
      days_since_last_session: agg.daysSinceLastSession,
    },
    confidence: 0.85,
    warnings,
  };
}

export function evaluateWorkoutProgression(input: ProgressionEngineInput): ProgressionProposal {
  const rawPayload = input.plan.current_version.payload;
  if (rawPayload.kind !== 'workout') {
    throw new Error('Adaptive progression evaluation requires a workout plan');
  }
  const planPayload: WorkoutPlanPayload = rawPayload;
  const planId = input.plan.plan.id;
  const baseVersion = input.plan.current_version.version;

  const lookbackDays = input.options?.lookbackDays ?? 28;
  const minSessionsRequired = input.options?.minSessionsRequired ?? 2;
  const preferredUnit = input.options?.preferredUnit ?? 'kg';

  const nowTimestamp = input.options?.now ? new Date(input.options.now).getTime() : Date.now();
  const evaluatedAtIso = new Date(nowTimestamp).toISOString();

  // Determine overall days since user's most recent training session across entire history
  const sortedSessions = input.history
    .map((s) => new Date(s.started_at).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a);

  const overallDaysSinceAnySession = sortedSessions[0]
    ? Math.max(0, Math.round((nowTimestamp - sortedSessions[0]) / 86_400_000))
    : -1;

  // Flatten distinct exercises across all days in workout payload
  const exerciseMap = new Map<string, WorkoutExercise>();
  for (const day of planPayload.days) {
    for (const ex of day.exercises) {
      if (!exerciseMap.has(ex.exercise_id)) {
        exerciseMap.set(ex.exercise_id, ex);
      }
    }
  }

  const adjustments: ExerciseProgressionAdjustment[] = [];
  for (const exercise of exerciseMap.values()) {
    const adj = evaluateExerciseAdjustment(exercise, input.history, overallDaysSinceAnySession, {
      lookbackDays,
      minSessionsRequired,
      nowTimestampMs: nowTimestamp,
      preferredUnit,
    });
    adjustments.push(adj);
  }

  // Synthesize overall action and global summary
  let progressCount = 0;
  let deloadCount = 0;
  let maintainCount = 0;
  let insufficientCount = 0;

  for (const adj of adjustments) {
    if (adj.action === 'progress') progressCount++;
    else if (adj.action === 'deload') deloadCount++;
    else if (adj.action === 'insufficient_data') insufficientCount++;
    else maintainCount++;
  }

  let overallAction: ProgressionAction = 'maintain';
  if (insufficientCount === adjustments.length) {
    overallAction = 'insufficient_data';
  } else if (deloadCount > 0) {
    overallAction = 'deload';
  } else if (progressCount > 0) {
    overallAction = 'progress';
  }

  const globalSummaryParts: string[] = [];
  if (overallAction === 'deload') {
    globalSummaryParts.push(
      `Reactive deload recommended for ${deloadCount} exercise(s) due to fatigue, elevated RPE, or training hiatus.`,
    );
  }
  if (progressCount > 0) {
    globalSummaryParts.push(
      `Progressive overload earned for ${progressCount} exercise(s) with solid completion rates and manageable RPE (≤ 7.5).`,
    );
  }
  if (maintainCount > 0) {
    globalSummaryParts.push(
      `Preserved current prescriptions for ${maintainCount} exercise(s) operating within the optimal stimulus band.`,
    );
  }
  if (insufficientCount > 0) {
    globalSummaryParts.push(
      `${insufficientCount} exercise(s) lacked sufficient observation data (minimum ${minSessionsRequired} sessions in 28 days) and were held at baseline.`,
    );
  }

  const proposalId = crypto.randomUUID();

  return {
    id: proposalId,
    plan_id: planId,
    base_version: baseVersion,
    policy_version: PROGRESSION_POLICY_VERSION,
    evaluated_at: evaluatedAtIso,
    overall_action: overallAction,
    exercise_adjustments: adjustments,
    global_summary:
      globalSummaryParts.join(' ') || 'Training plan evaluated. No adjustments required.',
    requires_user_review: true,
  };
}
