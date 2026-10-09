import {
  type JointAngles,
  LANDMARK_INDEX,
  type LandmarkPoint,
  type TrackedSide,
} from '@kinetra/contracts';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Calculates the 2D interior angle at vertex `b` formed by points a-b-c.
 * Returns angle in degrees [0, 180].
 */
export function calculateAngle2D(a: Point2D, b: Point2D, c: Point2D): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (mag1 === 0 || mag2 === 0) {
    return 180;
  }

  // Clamp cosine to [-1, 1] to avoid NaN from floating point inaccuracies
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  const angleRad = Math.acos(cosAngle);
  return Number(((angleRad * 180) / Math.PI).toFixed(1));
}

/**
 * Calculates the torso inclination angle relative to the vertical axis (0, -1).
 * Returns angle in degrees [0, 180], where 0 is perfectly upright and 90 is horizontal.
 */
export function calculateTorsoAngle(shoulder: Point2D, hip: Point2D): number {
  // Vector from hip pointing upward towards shoulder
  const vx = shoulder.x - hip.x;
  const vy = shoulder.y - hip.y;

  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag === 0) return 0;

  // Vertical axis pointing upward in screen coordinates (screen y increases downward)
  // Upward is (0, -1)
  const dot = vx * 0 + vy * -1;
  const cosAngle = Math.max(-1, Math.min(1, dot / mag));
  const angleRad = Math.acos(cosAngle);
  return Number(((angleRad * 180) / Math.PI).toFixed(1));
}

/**
 * Automatically chooses the best side (left vs right) to track based on
 * landmark visibility and confidence in the sagittal plane.
 */
export function detectTrackedSide(landmarks: LandmarkPoint[]): TrackedSide {
  if (landmarks.length < 33) return 'bilateral';

  const leftConfidence =
    (landmarks[LANDMARK_INDEX.LEFT_HIP]?.visibility ?? 0) +
    (landmarks[LANDMARK_INDEX.LEFT_KNEE]?.visibility ?? 0) +
    (landmarks[LANDMARK_INDEX.LEFT_ANKLE]?.visibility ?? 0);

  const rightConfidence =
    (landmarks[LANDMARK_INDEX.RIGHT_HIP]?.visibility ?? 0) +
    (landmarks[LANDMARK_INDEX.RIGHT_KNEE]?.visibility ?? 0) +
    (landmarks[LANDMARK_INDEX.RIGHT_ANKLE]?.visibility ?? 0);

  // If both have comparable high visibility (> 2.7 out of 3), bilateral/average
  if (Math.abs(leftConfidence - rightConfidence) < 0.3 && leftConfidence > 2.0) {
    return 'bilateral';
  }

  return leftConfidence >= rightConfidence ? 'left' : 'right';
}

export const MIN_LANDMARK_CONFIDENCE_THRESHOLD = 0.55;

/**
 * Computes image-plane squat angles (knee flexion, hip angle, torso inclination)
 * from 33 MediaPipe pose landmarks.
 */
export function computeSquatAngles(
  landmarks: LandmarkPoint[],
  minConfidence: number = MIN_LANDMARK_CONFIDENCE_THRESHOLD,
): JointAngles {
  if (!landmarks || landmarks.length < 33) {
    return {
      kneeAngle: 180,
      hipAngle: 180,
      torsoAngle: 0,
      side: 'bilateral',
      confidence: 0,
      isReliable: false,
    };
  }

  const side = detectTrackedSide(landmarks);

  let hip: LandmarkPoint;
  let knee: LandmarkPoint;
  let ankle: LandmarkPoint;
  let shoulder: LandmarkPoint;

  if (side === 'left') {
    hip = landmarks[LANDMARK_INDEX.LEFT_HIP]!;
    knee = landmarks[LANDMARK_INDEX.LEFT_KNEE]!;
    ankle = landmarks[LANDMARK_INDEX.LEFT_ANKLE]!;
    shoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER]!;
  } else if (side === 'right') {
    hip = landmarks[LANDMARK_INDEX.RIGHT_HIP]!;
    knee = landmarks[LANDMARK_INDEX.RIGHT_KNEE]!;
    ankle = landmarks[LANDMARK_INDEX.RIGHT_ANKLE]!;
    shoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER]!;
  } else {
    // Bilateral average
    const lHip = landmarks[LANDMARK_INDEX.LEFT_HIP]!;
    const rHip = landmarks[LANDMARK_INDEX.RIGHT_HIP]!;
    const lKnee = landmarks[LANDMARK_INDEX.LEFT_KNEE]!;
    const rKnee = landmarks[LANDMARK_INDEX.RIGHT_KNEE]!;
    const lAnkle = landmarks[LANDMARK_INDEX.LEFT_ANKLE]!;
    const rAnkle = landmarks[LANDMARK_INDEX.RIGHT_ANKLE]!;
    const lShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER]!;
    const rShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER]!;

    hip = {
      x: (lHip.x + rHip.x) / 2,
      y: (lHip.y + rHip.y) / 2,
      visibility: (lHip.visibility + rHip.visibility) / 2,
    };
    knee = {
      x: (lKnee.x + rKnee.x) / 2,
      y: (lKnee.y + rKnee.y) / 2,
      visibility: (lKnee.visibility + rKnee.visibility) / 2,
    };
    ankle = {
      x: (lAnkle.x + rAnkle.x) / 2,
      y: (lAnkle.y + rAnkle.y) / 2,
      visibility: (lAnkle.visibility + rAnkle.visibility) / 2,
    };
    shoulder = {
      x: (lShoulder.x + rShoulder.x) / 2,
      y: (lShoulder.y + rShoulder.y) / 2,
      visibility: (lShoulder.visibility + rShoulder.visibility) / 2,
    };
  }

  const avgConfidence =
    (hip.visibility + knee.visibility + ankle.visibility + shoulder.visibility) / 4;
  const isReliable =
    hip.visibility >= minConfidence &&
    knee.visibility >= minConfidence &&
    ankle.visibility >= minConfidence &&
    shoulder.visibility >= minConfidence;

  // Knee angle formed by Hip - Knee - Ankle
  const kneeAngle = calculateAngle2D(hip, knee, ankle);

  // Hip angle formed by Shoulder - Hip - Knee
  const hipAngle = calculateAngle2D(shoulder, hip, knee);

  // Torso inclination relative to vertical
  const torsoAngle = calculateTorsoAngle(shoulder, hip);

  return {
    kneeAngle,
    hipAngle,
    torsoAngle,
    side,
    confidence: Number(avgConfidence.toFixed(2)),
    isReliable,
  };
}
