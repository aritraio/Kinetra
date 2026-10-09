import { describe, expect, it } from 'vitest';
import {
  jointAnglesSchema,
  LANDMARK_INDEX,
  type LandmarkPoint,
  postureSessionSummarySchema,
  repEvaluationSchema,
} from '../packages/contracts/src/index';
import {
  calculateAngle2D,
  calculateTorsoAngle,
  computeSquatAngles,
  detectTrackedSide,
  LandmarkSmoothingFilter,
  SquatRepStateMachine,
  summarizeSquatSession,
} from '../packages/domain/src/index';
import { POSTURE_FIXTURES } from '../evals/fixtures/posture-fixtures';
import { evaluateFixture, runPostureEvaluation } from '../evals/posture-eval';

describe('Phase 7 — Local Posture & Form Lab', () => {
  describe('P7-01 & P7-03: Biomechanical Kinematics & Pure Functions', () => {
    it('computes exact 2D interior joint angles without NaN or floating inaccuracies', () => {
      // Collinear: 180°
      const a = { x: 0.5, y: 0.2 };
      const b = { x: 0.5, y: 0.5 };
      const c = { x: 0.5, y: 0.8 };
      expect(calculateAngle2D(a, b, c)).toBe(180);

      // Right angle: 90°
      const rightA = { x: 0.5, y: 0.2 };
      const rightB = { x: 0.5, y: 0.5 };
      const rightC = { x: 0.8, y: 0.5 };
      expect(calculateAngle2D(rightA, rightB, rightC)).toBe(90);

      // Acute angle: 45°
      const acuteA = { x: 0.5, y: 0.2 };
      const acuteB = { x: 0.5, y: 0.5 };
      const acuteC = { x: 0.712, y: 0.288 };
      expect(Math.round(calculateAngle2D(acuteA, acuteB, acuteC))).toBe(45);

      // Degenerate zero magnitude
      expect(calculateAngle2D(b, b, c)).toBe(180);
    });

    it('computes torso inclination angle relative to vertical axis', () => {
      // Perfectly upright (shoulder directly above hip)
      const uprightHip = { x: 0.5, y: 0.6 };
      const uprightShoulder = { x: 0.5, y: 0.3 };
      expect(calculateTorsoAngle(uprightShoulder, uprightHip)).toBe(0);

      // Leaning forward at 45°
      const leaningHip = { x: 0.5, y: 0.6 };
      const leaningShoulder = { x: 0.7, y: 0.4 };
      const angle = calculateTorsoAngle(leaningShoulder, leaningHip);
      expect(angle).toBeGreaterThan(40);
      expect(angle).toBeLessThan(50);
    });

    it('determines tracked side automatically from sagittal landmark visibility', () => {
      const mockLandmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility: 0.9,
      }));

      // Bilateral when both sides have high visibility
      expect(detectTrackedSide(mockLandmarks)).toBe('bilateral');

      // Left side when right side has low confidence
      const rHip = mockLandmarks[LANDMARK_INDEX.RIGHT_HIP];
      const rKnee = mockLandmarks[LANDMARK_INDEX.RIGHT_KNEE];
      const rAnkle = mockLandmarks[LANDMARK_INDEX.RIGHT_ANKLE];
      if (rHip) rHip.visibility = 0.2;
      if (rKnee) rKnee.visibility = 0.1;
      if (rAnkle) rAnkle.visibility = 0.1;
      expect(detectTrackedSide(mockLandmarks)).toBe('left');
    });

    it('suppresses reliable status when landmarks fall below minimum confidence', () => {
      const lowConfidenceLandmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility: 0.3,
      }));

      const angles = computeSquatAngles(lowConfidenceLandmarks, 0.55);
      expect(angles.isReliable).toBe(false);
      expect(angles.confidence).toBeLessThan(0.55);
      expect(jointAnglesSchema.safeParse(angles).success).toBe(true);
    });
  });

  describe('P7-03: Signal Smoothing & Confidence Filtering', () => {
    it('smoothes landmark coordinates and reduces high-frequency jitter', () => {
      const filter = new LandmarkSmoothingFilter({ alpha: 0.4 });
      const rawFrameA: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility: 0.9,
      }));
      // Sudden noisy jump on frame B
      const rawFrameB: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
        x: 0.6,
        y: 0.6,
        visibility: 0.9,
      }));

      filter.filter(rawFrameA);
      const smoothedB = filter.filter(rawFrameB);

      // Smoothed coordinate should be damped (0.4 * 0.6 + 0.6 * 0.5 = 0.54)
      expect(smoothedB[0]?.x).toBeLessThan(0.6);
      expect(smoothedB[0]?.x).toBeGreaterThan(0.5);
    });

    it('retains previous coordinates when landmark is occluded or visibility drops', () => {
      const filter = new LandmarkSmoothingFilter({ minVisibility: 0.4 });
      const baseFrame: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
        x: 0.45,
        y: 0.75,
        visibility: 0.9,
      }));
      const occludedFrame: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
        x: 0.99,
        y: 0.99,
        visibility: 0.1, // Occluded
      }));

      filter.filter(baseFrame);
      const smoothedOccluded = filter.filter(occludedFrame);

      // Coordinate should not jump to 0.99
      const kneePt = smoothedOccluded[LANDMARK_INDEX.LEFT_KNEE];
      expect(kneePt?.x).toBe(0.45);
      expect(kneePt?.y).toBe(0.75);
      expect(kneePt?.visibility).toBeLessThan(0.9);
    });
  });

  describe('P7-03 & P7-05: Hysteresis State Machine & Rep Detection', () => {
    it('debounces rapid twitches under minimum rep duration', () => {
      const sm = new SquatRepStateMachine({ minRepDurationSec: 0.6 });
      const baseAngles = {
        kneeAngle: 170,
        hipAngle: 170,
        torsoAngle: 5,
        side: 'left' as const,
        confidence: 0.95,
        isReliable: true,
      };

      sm.processFrame(baseAngles, 1000);
      // Sudden drop and rebound within 200ms
      sm.processFrame({ ...baseAngles, kneeAngle: 85 }, 1100);
      sm.processFrame({ ...baseAngles, kneeAngle: 170 }, 1200);

      // Rep should be debounced and discarded
      expect(sm.getRepCount()).toBe(0);
      expect(sm.getCompletedReps().length).toBe(0);
    });

    it('pauses state machine transitions on low confidence frames', () => {
      const sm = new SquatRepStateMachine();
      const reliableStanding = {
        kneeAngle: 170,
        hipAngle: 170,
        torsoAngle: 5,
        side: 'left' as const,
        confidence: 0.9,
        isReliable: true,
      };
      const lowConfidenceFrame = {
        kneeAngle: 90,
        hipAngle: 90,
        torsoAngle: 20,
        side: 'left' as const,
        confidence: 0.2,
        isReliable: false,
      };

      sm.processFrame(reliableStanding, 1000);
      const out = sm.processFrame(lowConfidenceFrame, 1500);

      expect(out.isReliable).toBe(false);
      expect(out.activeCue).toContain('Low confidence');
      expect(sm.getState()).toBe('STAND'); // Did not transition to DESCENDING/BOTTOM
    });

    it('correctly classifies full parallel depth vs shallow partial reps', () => {
      const sm = new SquatRepStateMachine();
      const base = {
        hipAngle: 160,
        torsoAngle: 10,
        side: 'left' as const,
        confidence: 0.95,
        isReliable: true,
      };

      // Rep 1: Full deep squat (min knee angle 85°)
      for (let i = 0; i < 5; i++) sm.processFrame({ ...base, kneeAngle: 170 }, 1000 + i * 50);
      for (let i = 0; i < 10; i++)
        sm.processFrame({ ...base, kneeAngle: 170 - (i / 9) * 85 }, 1300 + i * 100);
      for (let i = 0; i < 10; i++)
        sm.processFrame({ ...base, kneeAngle: 85 + (i / 9) * 85 }, 2400 + i * 100);
      for (let i = 0; i < 5; i++) sm.processFrame({ ...base, kneeAngle: 170 }, 3500 + i * 50);

      expect(sm.getRepCount()).toBe(1);
      expect(sm.getPartialRepCount()).toBe(0);
      const rep1 = sm.getCompletedReps()[0];
      expect(rep1).toBeDefined();
      if (rep1) {
        expect(rep1.valid).toBe(true);
        expect(rep1.minKneeAngle).toBeLessThanOrEqual(100);
        expect(repEvaluationSchema.safeParse(rep1).success).toBe(true);
      }

      // Rep 2: Shallow squat (min knee angle 125°)
      for (let i = 0; i < 5; i++) sm.processFrame({ ...base, kneeAngle: 170 }, 4000 + i * 50);
      for (let i = 0; i < 10; i++)
        sm.processFrame({ ...base, kneeAngle: 170 - (i / 9) * 45 }, 4300 + i * 100);
      for (let i = 0; i < 10; i++)
        sm.processFrame({ ...base, kneeAngle: 125 + (i / 9) * 45 }, 5400 + i * 100);
      for (let i = 0; i < 5; i++) sm.processFrame({ ...base, kneeAngle: 170 }, 6500 + i * 50);

      expect(sm.getRepCount()).toBe(1); // Still 1 valid
      expect(sm.getPartialRepCount()).toBe(1); // 1 partial rep
      const rep2 = sm.getCompletedReps()[1];
      expect(rep2).toBeDefined();
      if (rep2) {
        expect(rep2.valid).toBe(false);
        expect(rep2.minKneeAngle).toBeGreaterThan(100);
      }
    });
  });

  describe('P7-04 & P7-05: Labeled Landmark Fixtures Evaluation Suite', () => {
    it('evaluates all 8 labeled benchmark fixtures and verifies 100% rep counting precision', () => {
      const summary = runPostureEvaluation();

      expect(summary.totalFixtures).toBe(8);
      expect(summary.repCountAccuracyPct).toBe(100);
      expect(summary.partialRepAccuracyPct).toBe(100);
      expect(summary.meanAbsoluteTempoErrorSec).toBeLessThan(0.45);
      expect(summary.passedFixtures).toBe(8);
    });

    it('verifies noise resistance on Gaussian landmark jitter fixture', () => {
      const fixture = POSTURE_FIXTURES.find((f) => f.id === 'noisy_jitter');
      expect(fixture).toBeDefined();
      if (!fixture) return;

      const result = evaluateFixture(fixture);
      expect(result.detectedValidReps).toBe(4);
      expect(result.detectedPartialReps).toBe(0);
      expect(result.repCountError).toBe(0);
      expect(result.passed).toBe(true);
    });

    it('verifies camera translation invariance on drift fixture', () => {
      const fixture = POSTURE_FIXTURES.find((f) => f.id === 'camera_movement_drift');
      expect(fixture).toBeDefined();
      if (!fixture) return;

      const result = evaluateFixture(fixture);
      expect(result.detectedValidReps).toBe(3);
      expect(result.detectedPartialReps).toBe(0);
      expect(result.repCountError).toBe(0);
      expect(result.passed).toBe(true);
    });

    it('verifies intermittent occlusion handling without false reps', () => {
      const fixture = POSTURE_FIXTURES.find((f) => f.id === 'intermittent_occlusion');
      expect(fixture).toBeDefined();
      if (!fixture) return;

      const result = evaluateFixture(fixture);
      expect(result.detectedValidReps).toBe(3);
      expect(result.detectedPartialReps).toBe(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('P7-06 & P7-07: Session Summary & Privacy & Ethical Safety', () => {
    it('summarizes squat session into structured report with actionable feedback', () => {
      const reps = [
        {
          repNumber: 1,
          valid: true,
          minKneeAngle: 85,
          eccentricDurationSec: 2.0,
          pauseDurationSec: 0.4,
          concentricDurationSec: 1.0,
          totalDurationSec: 3.4,
          startTs: 1000,
          bottomTs: 3000,
          endTs: 4400,
          tempo: '2.0-0.4-1.0',
          formFeedback: ['Deep squat achieved (85° knee angle)', 'Controlled descent (2.0s)'],
        },
        {
          repNumber: 2,
          valid: true,
          minKneeAngle: 90,
          eccentricDurationSec: 2.1,
          pauseDurationSec: 0.3,
          concentricDurationSec: 1.1,
          totalDurationSec: 3.5,
          startTs: 5000,
          bottomTs: 7100,
          endTs: 8500,
          tempo: '2.1-0.3-1.1',
          formFeedback: ['Parallel depth achieved (90° knee angle)', 'Controlled descent (2.1s)'],
        },
      ];

      const summary = summarizeSquatSession(reps);
      expect(postureSessionSummarySchema.safeParse(summary).success).toBe(true);
      expect(summary.totalReps).toBe(2);
      expect(summary.validReps).toBe(2);
      expect(summary.partialReps).toBe(0);
      expect(summary.formScore).toBeGreaterThanOrEqual(90);
      expect(summary.feedbackSummary.length).toBeGreaterThan(0);
    });

    it('makes no body-fat, medical, or diagnostic claims in posture analysis', () => {
      const fixture = POSTURE_FIXTURES[0];
      expect(fixture).toBeDefined();
      if (!fixture) return;

      const result = evaluateFixture(fixture);
      // Verify strings do not contain prohibited medical or body-fat terms
      const outputText = JSON.stringify(result).toLowerCase();
      expect(outputText).not.toContain('body fat');
      expect(outputText).not.toContain('bodyfat');
      expect(outputText).not.toContain('diagnos');
      expect(outputText).not.toContain('injury risk');
      expect(outputText).not.toContain('disease');
    });
  });
});
