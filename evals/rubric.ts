import type { PlanVerificationResult } from '@kinetra/contracts';

export interface RubricEvaluationResult {
  readonly plan_id: string;
  readonly kind: 'meal' | 'workout';
  readonly schema_score: number; // 0 - 20
  readonly hard_constraint_score: number; // 0 or 30 (0 if any hard violation)
  readonly target_accuracy_score: number; // 0 - 20
  readonly macro_quality_score: number; // 0 - 15
  readonly balance_score: number; // 0 - 15
  readonly total_score: number; // 0 - 100
  readonly passed_threshold: boolean; // true if total_score >= 80 and hard_violations === 0
  readonly hard_violation_count: number;
  readonly soft_warning_count: number;
  readonly notes: string;
}

export function scoreMealPlanRubric(
  planId: string,
  verification: PlanVerificationResult,
): RubricEvaluationResult {
  const schemaScore = 20; // Reached verifier, so schema passed

  const hardCount = verification.hard_violations.length;
  const hardScore = hardCount === 0 ? 30 : 0;

  const maxCalDelta = verification.metrics?.max_calorie_delta ?? 0;
  let targetAccuracyScore = 20;
  if (maxCalDelta > 50) {
    targetAccuracyScore = Math.max(0, 20 - (maxCalDelta - 50) * 0.4);
  }

  const maxPDelta = verification.metrics?.max_protein_delta ?? 0;
  let macroQualityScore = 15;
  if (maxPDelta > 10) {
    macroQualityScore = Math.max(0, 15 - (maxPDelta - 10) * 0.8);
  }

  const softCount = verification.soft_warnings.length;
  const balanceScore = Math.max(0, 15 - softCount * 3);

  const total = Math.round(
    schemaScore + hardScore + targetAccuracyScore + macroQualityScore + balanceScore,
  );
  const passed = hardCount === 0 && total >= 80;

  return {
    plan_id: planId,
    kind: 'meal',
    schema_score: schemaScore,
    hard_constraint_score: hardScore,
    target_accuracy_score: Math.round(targetAccuracyScore * 10) / 10,
    macro_quality_score: Math.round(macroQualityScore * 10) / 10,
    balance_score: balanceScore,
    total_score: total,
    passed_threshold: passed,
    hard_violation_count: hardCount,
    soft_warning_count: softCount,
    notes: passed
      ? 'Meets nutritional accuracy and constraint criteria.'
      : `Failed rubric: ${hardCount} hard violations.`,
  };
}

export function scoreWorkoutPlanRubric(
  planId: string,
  verification: PlanVerificationResult,
): RubricEvaluationResult {
  const schemaScore = 20;

  const hardCount = verification.hard_violations.length;
  const hardScore = hardCount === 0 ? 30 : 0;

  const targetAccuracyScore = hardCount === 0 ? 20 : 10;
  const macroQualityScore = 15; // Set volume bounds

  const softCount = verification.soft_warnings.length;
  const balanceScore = Math.max(0, 15 - softCount * 3);

  const total = Math.round(
    schemaScore + hardScore + targetAccuracyScore + macroQualityScore + balanceScore,
  );
  const passed = hardCount === 0 && total >= 80;

  return {
    plan_id: planId,
    kind: 'workout',
    schema_score: schemaScore,
    hard_constraint_score: hardScore,
    target_accuracy_score: targetAccuracyScore,
    macro_quality_score: macroQualityScore,
    balance_score: balanceScore,
    total_score: total,
    passed_threshold: passed,
    hard_violation_count: hardCount,
    soft_warning_count: softCount,
    notes: passed
      ? 'Meets biomechanical volume and equipment constraints.'
      : `Failed rubric: ${hardCount} hard violations.`,
  };
}
