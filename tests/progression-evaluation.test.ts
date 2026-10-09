import { describe, expect, it } from 'vitest';
import { evaluateScenario, runProgressionEvaluationSuite } from '../evals/progression-eval';
import { PROGRESSION_SCENARIOS } from '../evals/fixtures/progression-fixtures';

describe('Phase 8 Adaptive Progression Evaluation Benchmark', () => {
  it('passes 100% of labeled progression scenarios', () => {
    const report = runProgressionEvaluationSuite();

    expect(report.totalScenarios).toBe(10);
    expect(report.passedScenarios).toBe(10);
    expect(report.passRatePct).toBe(100);
    expect(report.boundaryViolationsCount).toBe(0);
    expect(report.explainabilityCoveragePct).toBe(100);
    expect(report.determinismPassRatePct).toBe(100);
  });

  describe('Individual Scenario Verifications', () => {
    for (const scenario of PROGRESSION_SCENARIOS) {
      it(`Scenario [${scenario.id}] passes all domain criteria`, () => {
        const result = evaluateScenario(scenario);

        expect(result.passed).toBe(true);
        expect(result.actionMatches).toBe(true);
        expect(result.deltaMatches).toBe(true);
        expect(result.boundaryCompliant).toBe(true);
        expect(result.explainable).toBe(true);
        expect(result.reproducible).toBe(true);
      });
    }
  });
});
