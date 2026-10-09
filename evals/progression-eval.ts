import { evaluateWorkoutProgression } from '../packages/domain/src';
import {
  type LabeledProgressionScenario,
  PROGRESSION_SCENARIOS,
} from './fixtures/progression-fixtures';

export interface ScenarioEvaluationResult {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly category: string;
  readonly expectedAction: string;
  readonly detectedAction: string;
  readonly expectedLoadDelta: number;
  readonly detectedLoadDelta: number;
  readonly expectedNewLoad?: number | undefined;
  readonly detectedNewLoad?: number | undefined;
  readonly expectedRepsDelta?: number | undefined;
  readonly detectedRepsDelta?: number | undefined;
  readonly actionMatches: boolean;
  readonly deltaMatches: boolean;
  readonly boundaryCompliant: boolean;
  readonly explainable: boolean;
  readonly reproducible: boolean;
  readonly confidence: number;
  readonly reasonSnippet: string;
  readonly passed: boolean;
  readonly failureReason?: string | undefined;
}

export interface ProgressionEvaluationReport {
  readonly timestamp: string;
  readonly totalScenarios: number;
  readonly passedScenarios: number;
  readonly passRatePct: number;
  readonly boundaryViolationsCount: number;
  readonly explainabilityCoveragePct: number;
  readonly determinismPassRatePct: number;
  readonly results: readonly ScenarioEvaluationResult[];
}

export function evaluateScenario(scenario: LabeledProgressionScenario): ScenarioEvaluationResult {
  const proposal1 = evaluateWorkoutProgression({
    plan: scenario.plan,
    history: scenario.history,
    options: { now: scenario.evaluationTimestamp },
  });

  const proposal2 = evaluateWorkoutProgression({
    plan: scenario.plan,
    history: scenario.history,
    options: { now: scenario.evaluationTimestamp },
  });

  // Check deterministic reproducibility
  const reproducible =
    proposal1.overall_action === proposal2.overall_action &&
    JSON.stringify(proposal1.exercise_adjustments) ===
      JSON.stringify(proposal2.exercise_adjustments);

  const adj = proposal1.exercise_adjustments.find(
    (a) => a.exercise_id === scenario.targetExerciseId,
  );

  if (!adj) {
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      category: scenario.category,
      expectedAction: scenario.expectedAction,
      detectedAction: 'missing_adjustment',
      expectedLoadDelta: scenario.expectedLoadDelta,
      detectedLoadDelta: 0,
      actionMatches: false,
      deltaMatches: false,
      boundaryCompliant: false,
      explainable: false,
      reproducible,
      confidence: 0,
      reasonSnippet: '',
      passed: false,
      failureReason: `Target exercise ${scenario.targetExerciseId} not found in proposal`,
    };
  }

  const actionMatches = adj.action === scenario.expectedAction;

  // Delta comparison
  let deltaMatches = true;
  if (scenario.expectedLoadDelta !== 0) {
    deltaMatches = Math.abs(adj.delta.load_delta - scenario.expectedLoadDelta) <= 1.5;
  }
  if (scenario.expectedNewLoad !== undefined && adj.proposed_prescription.load) {
    deltaMatches =
      deltaMatches &&
      Math.abs(adj.proposed_prescription.load.value - scenario.expectedNewLoad) <= 1.5;
  }
  if (scenario.expectedRepsDelta !== undefined) {
    deltaMatches = deltaMatches && adj.delta.reps_delta === scenario.expectedRepsDelta;
  }

  // Safety boundary compliance
  const currentLoad = adj.current_prescription.load?.value ?? 0;
  const proposedLoad = adj.proposed_prescription.load?.value ?? 0;
  const relativeIncrease = currentLoad > 0 ? (proposedLoad - currentLoad) / currentLoad : 0;

  const boundaryCompliant =
    relativeIncrease <= 0.1001 && // <= 10% relative cap
    adj.delta.load_delta <= 5.0 && // <= +5.0 kg compound upper cap
    proposedLoad >= 0; // cannot be negative

  // Explainability criteria
  const explainable =
    adj.reason.trim().length >= 15 &&
    adj.evidence.sessions_analyzed >= 0 &&
    adj.evidence.completion_rate_pct >= 0 &&
    adj.confidence >= scenario.expectedConfidenceMin;

  // Warning check if expected
  let warningMatches = true;
  if (scenario.expectedWarningSubstring) {
    warningMatches = adj.warnings.some((w) =>
      w.toLowerCase().includes(scenario.expectedWarningSubstring?.toLowerCase() ?? ''),
    );
  }

  const passed =
    actionMatches &&
    deltaMatches &&
    boundaryCompliant &&
    explainable &&
    warningMatches &&
    reproducible;

  const failureReasons: string[] = [];
  if (!actionMatches)
    failureReasons.push(`Action mismatch: expected ${scenario.expectedAction}, got ${adj.action}`);
  if (!deltaMatches)
    failureReasons.push(
      `Delta mismatch: expected ${scenario.expectedLoadDelta}, got ${adj.delta.load_delta}`,
    );
  if (!boundaryCompliant) failureReasons.push('Violated safety boundary cap');
  if (!explainable) failureReasons.push('Failed explainability / evidence threshold');
  if (!warningMatches) failureReasons.push('Missing expected safety warning');
  if (!reproducible) failureReasons.push('Non-deterministic execution detected');

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    category: scenario.category,
    expectedAction: scenario.expectedAction,
    detectedAction: adj.action,
    expectedLoadDelta: scenario.expectedLoadDelta,
    detectedLoadDelta: adj.delta.load_delta,
    expectedNewLoad: scenario.expectedNewLoad,
    detectedNewLoad: adj.proposed_prescription.load?.value,
    expectedRepsDelta: scenario.expectedRepsDelta,
    detectedRepsDelta: adj.delta.reps_delta,
    actionMatches,
    deltaMatches,
    boundaryCompliant,
    explainable,
    reproducible,
    confidence: adj.confidence,
    reasonSnippet: adj.reason.slice(0, 80),
    passed,
    ...(failureReasons.length > 0 ? { failureReason: failureReasons.join('; ') } : {}),
  };
}

export function runProgressionEvaluationSuite(): ProgressionEvaluationReport {
  const results = PROGRESSION_SCENARIOS.map(evaluateScenario);
  const totalScenarios = results.length;
  const passedScenarios = results.filter((r) => r.passed).length;
  const boundaryViolationsCount = results.filter((r) => !r.boundaryCompliant).length;
  const explainabilityCoverageCount = results.filter((r) => r.explainable).length;
  const reproducibleCount = results.filter((r) => r.reproducible).length;

  return {
    timestamp: new Date().toISOString(),
    totalScenarios,
    passedScenarios,
    passRatePct: Math.round((passedScenarios / totalScenarios) * 100),
    boundaryViolationsCount,
    explainabilityCoveragePct: Math.round((explainabilityCoverageCount / totalScenarios) * 100),
    determinismPassRatePct: Math.round((reproducibleCount / totalScenarios) * 100),
    results,
  };
}
