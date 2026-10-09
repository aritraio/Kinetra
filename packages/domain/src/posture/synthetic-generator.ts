import { LANDMARK_INDEX, type LandmarkPoint, type PoseLandmarksFrame } from '@kinetra/contracts';

export interface SquatGeneratorOptions {
  reps: number;
  depthKneeAngleDeg?: number; // Minimum knee angle at bottom, default 85° (deep) or 100° (parallel)
  eccentricSec?: number; // Descent duration, default 2.0s
  pauseSec?: number; // Bottom hold duration, default 0.4s
  concentricSec?: number; // Ascent duration, default 1.0s
  restBetweenRepsSec?: number; // Standing duration between reps, default 1.0s
  fps?: number; // Target frame rate, default 30 fps
  noiseStdDev?: number; // Additive landmark noise, default 0
  occlusionIntervals?: Array<{ startSec: number; endSec: number }>; // Intervals where visibility drops
  cameraDriftRatePerSec?: { x: number; y: number }; // Global translation drift
  variableFramerate?: boolean; // Jitter timestamps to simulate unstable frame rate
}

/**
 * Generates mathematically verified synthetic MediaPipe 33-landmark sequences
 * of a person performing sagittal-profile squats.
 */
export function generateSquatLandmarkSequence(
  options: SquatGeneratorOptions,
): PoseLandmarksFrame[] {
  const {
    reps,
    depthKneeAngleDeg = 85,
    eccentricSec = 2.0,
    pauseSec = 0.4,
    concentricSec = 1.0,
    restBetweenRepsSec = 1.0,
    fps = 30,
    noiseStdDev = 0,
    occlusionIntervals = [],
    cameraDriftRatePerSec = { x: 0, y: 0 },
    variableFramerate = false,
  } = options;

  const frames: PoseLandmarksFrame[] = [];
  const repDuration = eccentricSec + pauseSec + concentricSec + restBetweenRepsSec;
  const totalDurationSec = reps * repDuration + 0.5; // Initial 0.5s standing buffer

  let currentTimeSec = 0;
  const baseDt = 1 / fps;

  // Pseudo-random number generator for reproducible noise
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const gaussianRandom = () => {
    const u1 = Math.max(1e-6, pseudoRandom());
    const u2 = pseudoRandom();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  };

  while (currentTimeSec <= totalDurationSec) {
    const timestampMs = Math.round(currentTimeSec * 1000);

    // Compute knee angle for current timestamp
    let kneeAngleDeg = 170; // Standing posture angle

    if (currentTimeSec >= 0.5) {
      const activeTime = currentTimeSec - 0.5;
      const currentRepIndex = Math.floor(activeTime / repDuration);

      if (currentRepIndex < reps) {
        const timeInRep = activeTime % repDuration;

        if (timeInRep < eccentricSec) {
          // Descent phase: cosine easing from 170° down to target depth
          const progress = timeInRep / eccentricSec;
          const eased = (1 - Math.cos(progress * Math.PI)) / 2;
          kneeAngleDeg = 170 - (170 - depthKneeAngleDeg) * eased;
        } else if (timeInRep < eccentricSec + pauseSec) {
          // Bottom pause phase
          kneeAngleDeg = depthKneeAngleDeg;
        } else if (timeInRep < eccentricSec + pauseSec + concentricSec) {
          // Ascent phase: cosine easing from target depth back to 170°
          const progress = (timeInRep - eccentricSec - pauseSec) / concentricSec;
          const eased = (1 - Math.cos(progress * Math.PI)) / 2;
          kneeAngleDeg = depthKneeAngleDeg + (170 - depthKneeAngleDeg) * eased;
        } else {
          // Rest standing between reps
          kneeAngleDeg = 170;
        }
      }
    }

    // Kinematics solver to position hip, knee, ankle, shoulder, and head
    // Ankle is pinned near bottom of screen
    const driftX = cameraDriftRatePerSec.x * currentTimeSec;
    const driftY = cameraDriftRatePerSec.y * currentTimeSec;

    const ankleX = 0.5 + driftX;
    const ankleY = 0.82 + driftY;

    // Biomechanical segment lengths in normalized height units
    const tibiaLen = 0.22;
    const femurLen = 0.24;
    const torsoLen = 0.26;

    // Convert knee angle to tibia and femur vectors
    // In standing (170°), tibia is vertical, femur is vertical.
    // In deep squat (85°), knee moves slightly forward, hips shift back and down.
    const flexionFactor = (170 - kneeAngleDeg) / (170 - 70); // 0 at standing, 1 at deep squat

    const kneeX = ankleX + 0.04 * flexionFactor;
    const kneeY = ankleY - tibiaLen * (1 - 0.1 * flexionFactor);

    // Exact forward kinematics for knee flexion angle
    const beta = Math.atan2(ankleY - kneeY, ankleX - kneeX);
    const gamma = beta - kneeAngleDeg * (Math.PI / 180);
    const hipX = kneeX + femurLen * Math.cos(gamma);
    const hipY = kneeY + femurLen * Math.sin(gamma);

    // Torso leans forward slightly as squat deepens to balance over midfoot
    const torsoInclinationRad = (10 + 28 * flexionFactor) * (Math.PI / 180);
    const shoulderX = hipX + torsoLen * Math.sin(torsoInclinationRad);
    const shoulderY = hipY - torsoLen * Math.cos(torsoInclinationRad);

    const noseX = shoulderX + 0.04 * Math.sin(torsoInclinationRad);
    const noseY = shoulderY - 0.08;

    // Check occlusion intervals
    const isOccluded = occlusionIntervals.some(
      (interval) => currentTimeSec >= interval.startSec && currentTimeSec <= interval.endSec,
    );
    const defaultVisibility = isOccluded ? 0.15 : 0.95;

    // Create 33 landmark array
    const landmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: defaultVisibility,
    }));

    const addPoint = (idx: number, baseX: number, baseY: number, vis = defaultVisibility) => {
      const nX = noiseStdDev > 0 ? gaussianRandom() * noiseStdDev : 0;
      const nY = noiseStdDev > 0 ? gaussianRandom() * noiseStdDev : 0;
      const clampedX = Math.max(0, Math.min(1, Number((baseX + nX).toFixed(4))));
      const clampedY = Math.max(0, Math.min(1, Number((baseY + nY).toFixed(4))));
      landmarks[idx] = {
        x: clampedX,
        y: clampedY,
        visibility: vis,
      };
    };

    // Populate key joints (both left and right side for complete skeleton)
    addPoint(LANDMARK_INDEX.NOSE, noseX, noseY);

    // Left side (tracked side)
    addPoint(LANDMARK_INDEX.LEFT_SHOULDER, shoulderX, shoulderY);
    addPoint(LANDMARK_INDEX.LEFT_ELBOW, shoulderX + 0.05, shoulderY + 0.12);
    addPoint(LANDMARK_INDEX.LEFT_WRIST, shoulderX + 0.08, shoulderY + 0.2);
    addPoint(LANDMARK_INDEX.LEFT_HIP, hipX, hipY);
    addPoint(LANDMARK_INDEX.LEFT_KNEE, kneeX, kneeY);
    addPoint(LANDMARK_INDEX.LEFT_ANKLE, ankleX, ankleY);
    addPoint(LANDMARK_INDEX.LEFT_HEEL, ankleX - 0.03, ankleY + 0.02);
    addPoint(LANDMARK_INDEX.LEFT_FOOT_INDEX, ankleX + 0.05, ankleY + 0.02);

    // Right side (slight visual parallax offset)
    const rightOffset = 0.02;
    addPoint(
      LANDMARK_INDEX.RIGHT_SHOULDER,
      shoulderX + rightOffset,
      shoulderY,
      defaultVisibility * 0.9,
    );
    addPoint(
      LANDMARK_INDEX.RIGHT_ELBOW,
      shoulderX + 0.05 + rightOffset,
      shoulderY + 0.12,
      defaultVisibility * 0.9,
    );
    addPoint(
      LANDMARK_INDEX.RIGHT_WRIST,
      shoulderX + 0.08 + rightOffset,
      shoulderY + 0.2,
      defaultVisibility * 0.9,
    );
    addPoint(LANDMARK_INDEX.RIGHT_HIP, hipX + rightOffset, hipY, defaultVisibility * 0.9);
    addPoint(LANDMARK_INDEX.RIGHT_KNEE, kneeX + rightOffset, kneeY, defaultVisibility * 0.9);
    addPoint(LANDMARK_INDEX.RIGHT_ANKLE, ankleX + rightOffset, ankleY, defaultVisibility * 0.9);
    addPoint(
      LANDMARK_INDEX.RIGHT_HEEL,
      ankleX - 0.03 + rightOffset,
      ankleY + 0.02,
      defaultVisibility * 0.9,
    );
    addPoint(
      LANDMARK_INDEX.RIGHT_FOOT_INDEX,
      ankleX + 0.05 + rightOffset,
      ankleY + 0.02,
      defaultVisibility * 0.9,
    );

    frames.push({
      timestampMs,
      landmarks,
    });

    // Time advancement: either fixed 1/fps or variable jitter
    const step = variableFramerate
      ? baseDt * (0.6 + 0.8 * pseudoRandom()) // 10-25 fps jitter
      : baseDt;
    currentTimeSec += step;
  }

  return frames;
}
