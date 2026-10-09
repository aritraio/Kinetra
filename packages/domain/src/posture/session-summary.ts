import type { PostureSessionSummary, RepEvaluation } from '@kinetra/contracts';

/**
 * Summarizes completed squat repetitions into a structured performance report.
 * Evaluates depth adherence, tempo consistency, and produces actionable biomechanical cues.
 */
export function summarizeSquatSession(
  reps: RepEvaluation[],
  timestamp: string = new Date().toISOString(),
): PostureSessionSummary {
  if (reps.length === 0) {
    return {
      exercise: 'squat',
      totalReps: 0,
      validReps: 0,
      partialReps: 0,
      averageDepthAngle: 180,
      averageEccentricSec: 0,
      averageConcentricSec: 0,
      formScore: 0,
      feedbackSummary: ['No completed reps detected in this set.'],
      timestamp,
    };
  }

  const totalReps = reps.length;
  const validReps = reps.filter((r) => r.valid).length;
  const partialReps = totalReps - validReps;

  const totalDepth = reps.reduce((sum, r) => sum + r.minKneeAngle, 0);
  const averageDepthAngle = Number((totalDepth / totalReps).toFixed(1));

  const totalEccentric = reps.reduce((sum, r) => sum + r.eccentricDurationSec, 0);
  const averageEccentricSec = Number((totalEccentric / totalReps).toFixed(2));

  const totalConcentric = reps.reduce((sum, r) => sum + r.concentricDurationSec, 0);
  const averageConcentricSec = Number((totalConcentric / totalReps).toFixed(2));

  // Form score computation (0-100)
  // 1. Depth compliance (50% max)
  const depthRate = validReps / totalReps;
  const depthScore = depthRate * 50;

  // 2. Tempo control (30% max): reward eccentric >= 1.5s (up to 3s)
  const controlledEccentricReps = reps.filter(
    (r) => r.eccentricDurationSec >= 1.2 && r.eccentricDurationSec <= 4.0,
  ).length;
  const tempoScore = (controlledEccentricReps / totalReps) * 30;

  // 3. Consistency bonus (20% max): low variance in depth
  const depthVariance =
    reps.reduce((sum, r) => sum + Math.pow(r.minKneeAngle - averageDepthAngle, 2), 0) / totalReps;
  const consistencyScore = Math.max(0, 20 - Math.min(20, depthVariance * 0.2));

  const formScore = Math.round(
    Math.min(100, Math.max(0, depthScore + tempoScore + consistencyScore)),
  );

  // Generate actionable summary feedback
  const feedbackSummary: string[] = [];

  if (validReps === totalReps) {
    feedbackSummary.push(
      `Excellent depth: 100% of reps achieved parallel or deeper (avg ${averageDepthAngle}°).`,
    );
  } else if (validReps > 0) {
    feedbackSummary.push(
      `${validReps} of ${totalReps} reps reached full depth. ${partialReps} reps were shallow.`,
    );
  } else {
    feedbackSummary.push(
      'All reps were shallow: prioritize hip mobility and lower depth (≤ 100° knee angle).',
    );
  }

  if (averageEccentricSec >= 1.8) {
    feedbackSummary.push(`Great eccentric control (avg ${averageEccentricSec}s descent).`);
  } else {
    feedbackSummary.push(
      `Descent was slightly brisk (avg ${averageEccentricSec}s). Slow down to ~2s for stability.`,
    );
  }

  if (averageConcentricSec <= 1.5) {
    feedbackSummary.push(
      `Explosive upward drive maintained (avg ${averageConcentricSec}s ascent).`,
    );
  }

  return {
    exercise: 'squat',
    totalReps,
    validReps,
    partialReps,
    averageDepthAngle,
    averageEccentricSec,
    averageConcentricSec,
    formScore,
    feedbackSummary,
    timestamp,
  };
}
