import { z } from 'zod';

/**
 * Standard MediaPipe 33 Pose Landmark indices
 */
export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type LandmarkIndexName = keyof typeof LANDMARK_INDEX;

/**
 * Single landmark point in normalized coordinates [0, 1]
 */
export const landmarkPointSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  z: z.number().optional(),
  visibility: z.number().min(0).max(1),
});
export type LandmarkPoint = z.infer<typeof landmarkPointSchema>;

/**
 * Frame containing 33 pose landmarks with local timestamp
 */
export const poseLandmarksFrameSchema = z.strictObject({
  timestampMs: z.number().nonnegative(),
  landmarks: z.array(landmarkPointSchema).length(33),
});
export type PoseLandmarksFrame = z.infer<typeof poseLandmarksFrameSchema>;

/**
 * Tracked side for unilateral or sagittal-plane pose analysis
 */
export const trackedSideSchema = z.enum(['left', 'right', 'bilateral']);
export type TrackedSide = z.infer<typeof trackedSideSchema>;

/**
 * Computed 2D image-plane joint kinematics
 */
export const jointAnglesSchema = z.strictObject({
  kneeAngle: z.number().min(0).max(180),
  hipAngle: z.number().min(0).max(180),
  torsoAngle: z.number().min(0).max(180),
  side: trackedSideSchema,
  confidence: z.number().min(0).max(1),
  isReliable: z.boolean(),
});
export type JointAngles = z.infer<typeof jointAnglesSchema>;

/**
 * Hysteresis-based rep state machine states
 */
export const repStateSchema = z.enum(['STAND', 'DESCENDING', 'BOTTOM', 'ASCENDING']);
export type RepState = z.infer<typeof repStateSchema>;

/**
 * Evaluated completed repetition metrics
 */
export const repEvaluationSchema = z.strictObject({
  repNumber: z.number().int().positive(),
  valid: z.boolean(),
  minKneeAngle: z.number().min(0).max(180),
  eccentricDurationSec: z.number().nonnegative(),
  pauseDurationSec: z.number().nonnegative(),
  concentricDurationSec: z.number().nonnegative(),
  totalDurationSec: z.number().nonnegative(),
  startTs: z.number().nonnegative(),
  bottomTs: z.number().nonnegative(),
  endTs: z.number().nonnegative(),
  tempo: z.string(),
  formFeedback: z.array(z.string()),
});
export type RepEvaluation = z.infer<typeof repEvaluationSchema>;

/**
 * Summary of a completed local posture & form session
 */
export const postureSessionSummarySchema = z.strictObject({
  exercise: z.literal('squat'),
  totalReps: z.number().int().nonnegative(),
  validReps: z.number().int().nonnegative(),
  partialReps: z.number().int().nonnegative(),
  averageDepthAngle: z.number().min(0).max(180),
  averageEccentricSec: z.number().nonnegative(),
  averageConcentricSec: z.number().nonnegative(),
  formScore: z.number().min(0).max(100),
  feedbackSummary: z.array(z.string()),
  timestamp: z.string(),
});
export type PostureSessionSummary = z.infer<typeof postureSessionSummarySchema>;

/**
 * Camera device state and lifecycle status
 */
export const cameraStatusSchema = z.enum([
  'idle',
  'requesting',
  'streaming',
  'denied',
  'unsupported',
  'stopped',
  'error',
]);
export type CameraStatus = z.infer<typeof cameraStatusSchema>;
