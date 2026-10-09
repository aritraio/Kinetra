export interface ReleaseThresholds {
  readonly max_accepted_hard_violations: number; // Strictly 0
  readonly min_final_acceptance_rate: number; // At least 0.95 (95%)
  readonly min_rubric_pass_rate: number; // At least 0.90 (90%)
  readonly max_latency_p95_ms: number; // Under 8000ms
  readonly max_average_cost_usd: number; // Under $0.01 per generation
}

export const APPROVED_RELEASE_THRESHOLDS: ReleaseThresholds = {
  max_accepted_hard_violations: 0,
  min_final_acceptance_rate: 0.95,
  min_rubric_pass_rate: 0.9,
  max_latency_p95_ms: 8000,
  max_average_cost_usd: 0.01,
};

export interface EvaluationSummary {
  readonly total_samples: number;
  readonly accepted_samples: number;
  readonly final_acceptance_rate: number;
  readonly first_pass_rate: number;
  readonly repair_rate: number;
  readonly fallback_rate: number;
  readonly accepted_hard_violations: number;
  readonly rubric_pass_rate: number;
  readonly average_rubric_score: number;
  readonly latency_p50_ms: number;
  readonly latency_p95_ms: number;
  readonly average_cost_usd: number;
}

export function validateReleaseThresholds(
  summary: EvaluationSummary,
  thresholds: ReleaseThresholds = APPROVED_RELEASE_THRESHOLDS,
): { approved: boolean; gate_failures: string[] } {
  const gateFailures: string[] = [];

  // Gate 1: Zero accepted hard-constraint violations (Non-negotiable)
  if (summary.accepted_hard_violations > thresholds.max_accepted_hard_violations) {
    gateFailures.push(
      `GATE_FAILURE_HARD_VIOLATIONS: Found ${summary.accepted_hard_violations} accepted hard violations (Threshold: ${thresholds.max_accepted_hard_violations})`,
    );
  }

  // Gate 2: Final acceptance rate
  if (summary.final_acceptance_rate < thresholds.min_final_acceptance_rate) {
    gateFailures.push(
      `GATE_FAILURE_ACCEPTANCE_RATE: Final acceptance rate ${(summary.final_acceptance_rate * 100).toFixed(1)}% is below threshold ${(thresholds.min_final_acceptance_rate * 100).toFixed(1)}%`,
    );
  }

  // Gate 3: Rubric pass rate
  if (summary.rubric_pass_rate < thresholds.min_rubric_pass_rate) {
    gateFailures.push(
      `GATE_FAILURE_RUBRIC_PASS: Rubric pass rate ${(summary.rubric_pass_rate * 100).toFixed(1)}% is below threshold ${(thresholds.min_rubric_pass_rate * 100).toFixed(1)}%`,
    );
  }

  // Gate 4: Latency p95
  if (summary.latency_p95_ms > thresholds.max_latency_p95_ms) {
    gateFailures.push(
      `GATE_FAILURE_LATENCY_P95: P95 latency ${summary.latency_p95_ms}ms exceeds threshold ${thresholds.max_latency_p95_ms}ms`,
    );
  }

  // Gate 5: Cost per generation
  if (summary.average_cost_usd > thresholds.max_average_cost_usd) {
    gateFailures.push(
      `GATE_FAILURE_COST: Average generation cost $${summary.average_cost_usd.toFixed(4)} exceeds threshold $${thresholds.max_average_cost_usd.toFixed(4)}`,
    );
  }

  return {
    approved: gateFailures.length === 0,
    gate_failures: gateFailures,
  };
}
