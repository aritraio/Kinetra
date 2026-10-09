import {
  computeSquatAngles,
  LandmarkSmoothingFilter,
  SquatRepStateMachine,
  summarizeSquatSession,
} from '../packages/domain/src';
import { type LabeledSquatFixture, POSTURE_FIXTURES } from './fixtures/posture-fixtures';

export interface FixtureEvaluationResult {
  fixtureId: string;
  fixtureName: string;
  category: string;
  supported: boolean;
  frameCount: number;
  expectedValidReps: number;
  detectedValidReps: number;
  expectedPartialReps: number;
  detectedPartialReps: number;
  repCountError: number;
  expectedEccentricSec: number;
  detectedAvgEccentricSec: number;
  eccentricErrorSec: number;
  expectedConcentricSec: number;
  detectedAvgConcentricSec: number;
  concentricErrorSec: number;
  formScore: number;
  passed: boolean;
  notes: string;
}

export interface PostureEvaluationSummary {
  timestamp: string;
  totalFixtures: number;
  passedFixtures: number;
  repCountAccuracyPct: number;
  partialRepAccuracyPct: number;
  meanAbsoluteTempoErrorSec: number;
  results: FixtureEvaluationResult[];
}

export function evaluateFixture(fixture: LabeledSquatFixture): FixtureEvaluationResult {
  const filter = new LandmarkSmoothingFilter();
  const stateMachine = new SquatRepStateMachine();

  for (const frame of fixture.frames) {
    const smoothed = filter.filter(frame.landmarks);
    const angles = computeSquatAngles(smoothed);
    stateMachine.processFrame(angles, frame.timestampMs);
  }

  const completedReps = stateMachine.getCompletedReps();
  const detectedValidReps = completedReps.filter((r) => r.valid).length;
  const detectedPartialReps = completedReps.filter((r) => !r.valid).length;

  const repCountError =
    Math.abs(detectedValidReps - fixture.expectedValidReps) +
    Math.abs(detectedPartialReps - fixture.expectedPartialReps);

  const avgEccentric =
    completedReps.length > 0
      ? completedReps.reduce((sum, r) => sum + r.eccentricDurationSec, 0) / completedReps.length
      : 0;

  const avgConcentric =
    completedReps.length > 0
      ? completedReps.reduce((sum, r) => sum + r.concentricDurationSec, 0) / completedReps.length
      : 0;

  const eccentricErrorSec =
    completedReps.length > 0
      ? Math.abs(Number(avgEccentric.toFixed(2)) - fixture.expectedEccentricSec)
      : 0;

  const concentricErrorSec =
    completedReps.length > 0
      ? Math.abs(Number(avgConcentric.toFixed(2)) - fixture.expectedConcentricSec)
      : 0;

  const summary = summarizeSquatSession(completedReps);

  // Acceptance threshold:
  // 1. Rep counting error is 0 (exact match on valid and partial counts)
  // 2. Tempo error <= 0.50s (accounting for joint velocity easing at lockout)
  const passed = repCountError === 0 && eccentricErrorSec <= 0.5 && concentricErrorSec <= 0.5;

  let notes = 'Meets accuracy thresholds';
  if (!passed) {
    notes = `Deviations: repError=${repCountError}, eccError=${eccentricErrorSec.toFixed(2)}s, concError=${concentricErrorSec.toFixed(2)}s`;
  }

  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    category: fixture.category,
    supported: fixture.supported,
    frameCount: fixture.frames.length,
    expectedValidReps: fixture.expectedValidReps,
    detectedValidReps,
    expectedPartialReps: fixture.expectedPartialReps,
    detectedPartialReps,
    repCountError,
    expectedEccentricSec: fixture.expectedEccentricSec,
    detectedAvgEccentricSec: Number(avgEccentric.toFixed(2)),
    eccentricErrorSec: Number(eccentricErrorSec.toFixed(2)),
    expectedConcentricSec: fixture.expectedConcentricSec,
    detectedAvgConcentricSec: Number(avgConcentric.toFixed(2)),
    concentricErrorSec: Number(concentricErrorSec.toFixed(2)),
    formScore: summary.formScore,
    passed,
    notes,
  };
}

export function runPostureEvaluation(): PostureEvaluationSummary {
  const results = POSTURE_FIXTURES.map(evaluateFixture);

  const passedFixtures = results.filter((r) => r.passed).length;
  const totalFixtures = results.length;

  const perfectReps = results.filter((r) => r.repCountError === 0).length;
  const repCountAccuracyPct = Number(((perfectReps / totalFixtures) * 100).toFixed(1));

  const partialTested = results.filter((r) => r.expectedPartialReps > 0);
  const partialPassed = partialTested.filter(
    (r) => r.detectedPartialReps === r.expectedPartialReps,
  ).length;
  const partialRepAccuracyPct =
    partialTested.length > 0
      ? Number(((partialPassed / partialTested.length) * 100).toFixed(1))
      : 100;

  const totalTempoError = results.reduce(
    (sum, r) => sum + (r.eccentricErrorSec + r.concentricErrorSec) / 2,
    0,
  );
  const meanAbsoluteTempoErrorSec = Number((totalTempoError / totalFixtures).toFixed(2));

  return {
    timestamp: new Date().toISOString(),
    totalFixtures,
    passedFixtures,
    repCountAccuracyPct,
    partialRepAccuracyPct,
    meanAbsoluteTempoErrorSec,
    results,
  };
}

// Standalone execution if invoked directly
if (process.argv[1]?.includes('posture-eval')) {
  const evalResult = runPostureEvaluation();
  console.log('--- POSTURE & FORM LAB EVALUATION REPORT ---');
  console.log(`Evaluated ${evalResult.totalFixtures} labeled fixtures.`);
  console.log(`Rep Counting Accuracy: ${evalResult.repCountAccuracyPct}%`);
  console.log(`Partial Rep Detection: ${evalResult.partialRepAccuracyPct}%`);
  console.log(`Mean Absolute Tempo Error: ${evalResult.meanAbsoluteTempoErrorSec}s`);
  console.log(`Overall Pass Rate: ${evalResult.passedFixtures} / ${evalResult.totalFixtures}`);
  console.table(
    evalResult.results.map((r) => ({
      Fixture: r.fixtureId,
      ExpReps: `${r.expectedValidReps}v / ${r.expectedPartialReps}p`,
      DetReps: `${r.detectedValidReps}v / ${r.detectedPartialReps}p`,
      EccErr: `${r.eccentricErrorSec}s`,
      ConcErr: `${r.concentricErrorSec}s`,
      Score: r.formScore,
      Passed: r.passed ? '✓' : '✗',
    })),
  );
}
