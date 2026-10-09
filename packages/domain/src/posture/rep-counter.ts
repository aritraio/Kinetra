import type { JointAngles, RepEvaluation, RepState } from '@kinetra/contracts';

export interface SquatThresholds {
  standThreshold: number; // e.g. 162°
  descentTrigger: number; // e.g. 152°
  parallelDepthThreshold: number; // e.g. 100°
  deepDepthThreshold: number; // e.g. 85°
  ascentTrigger: number; // e.g. 118°
  minRepDurationSec: number; // e.g. 0.6s
  inflectionRiseMargin: number; // e.g. 6.0°
  ascentRiseMargin: number; // e.g. 10.0°
}

export const DEFAULT_SQUAT_THRESHOLDS: SquatThresholds = {
  standThreshold: 162,
  descentTrigger: 152,
  parallelDepthThreshold: 100,
  deepDepthThreshold: 85,
  ascentTrigger: 118,
  minRepDurationSec: 0.6,
  inflectionRiseMargin: 6.0,
  ascentRiseMargin: 10.0,
};

export interface SquatFrameOutput {
  state: RepState;
  repCount: number;
  partialRepCount: number;
  currentKneeAngle: number;
  currentTorsoAngle: number;
  activeCue: string;
  isReliable: boolean;
  completedRep: RepEvaluation | null;
  minKneeAngleInRep: number;
  elapsedInRepSec: number;
}

/**
 * Hysteresis-based finite state machine for bodyweight squats.
 * Prevents threshold flickering, measures tempo phases from real timestamps,
 * and distinguishes full vs partial repetitions.
 */
export class SquatRepStateMachine {
  private state: RepState = 'STAND';
  private repNumber = 0;
  private completedReps: RepEvaluation[] = [];

  private lastStandTs = 0;
  private descentStartTs = 0;
  private bottomTs = 0;
  private minKneeAngleTs = 0;
  private firstRiseTs = 0;
  private ascentStartTs = 0;
  private minKneeAngleInCurrentRep = 180;
  private maxTorsoAngleInCurrentRep = 0;
  private smoothedKneeAngle: number | null = null;

  private activeCue = 'Stand tall facing the side profile to begin';
  private readonly thresholds: SquatThresholds;

  constructor(thresholds: Partial<SquatThresholds> = {}) {
    this.thresholds = { ...DEFAULT_SQUAT_THRESHOLDS, ...thresholds };
  }

  getState(): RepState {
    return this.state;
  }

  getRepCount(): number {
    return this.completedReps.filter((r) => r.valid).length;
  }

  getPartialRepCount(): number {
    return this.completedReps.filter((r) => !r.valid).length;
  }

  getCompletedReps(): RepEvaluation[] {
    return [...this.completedReps];
  }

  reset(): void {
    this.state = 'STAND';
    this.repNumber = 0;
    this.completedReps = [];
    this.lastStandTs = 0;
    this.descentStartTs = 0;
    this.bottomTs = 0;
    this.minKneeAngleTs = 0;
    this.firstRiseTs = 0;
    this.ascentStartTs = 0;
    this.minKneeAngleInCurrentRep = 180;
    this.maxTorsoAngleInCurrentRep = 0;
    this.smoothedKneeAngle = null;
    this.activeCue = 'Stand tall facing the side profile to begin';
  }

  /**
   * Processes a single frame of computed joint angles and timestamp.
   */
  processFrame(angles: JointAngles, timestampMs: number): SquatFrameOutput {
    let completedRep: RepEvaluation | null = null;
    const { kneeAngle: rawKneeAngle, torsoAngle, isReliable } = angles;

    if (!isReliable) {
      return {
        state: this.state,
        repCount: this.getRepCount(),
        partialRepCount: this.getPartialRepCount(),
        currentKneeAngle: rawKneeAngle,
        currentTorsoAngle: torsoAngle,
        activeCue: 'Low confidence — ensure full body is visible in good lighting',
        isReliable: false,
        completedRep: null,
        minKneeAngleInRep: this.minKneeAngleInCurrentRep,
        elapsedInRepSec: this.descentStartTs > 0 ? (timestampMs - this.descentStartTs) / 1000 : 0,
      };
    }

    // Apply exponential smoothing to knee angle to avoid single-frame noise spikes
    if (this.smoothedKneeAngle === null) {
      this.smoothedKneeAngle = rawKneeAngle;
    } else {
      this.smoothedKneeAngle = Number(
        (0.6 * rawKneeAngle + 0.4 * this.smoothedKneeAngle).toFixed(1),
      );
    }
    const kneeAngle = this.smoothedKneeAngle;

    switch (this.state) {
      case 'STAND': {
        this.activeCue = 'Ready — begin descent when prepared';
        if (kneeAngle >= this.thresholds.standThreshold) {
          this.lastStandTs = timestampMs;
        }

        if (kneeAngle < this.thresholds.descentTrigger) {
          // Transition: STAND -> DESCENDING
          this.state = 'DESCENDING';
          this.descentStartTs = this.lastStandTs > 0 ? this.lastStandTs : timestampMs;
          this.minKneeAngleInCurrentRep = kneeAngle;
          this.minKneeAngleTs = timestampMs;
          this.bottomTs = timestampMs;
          this.firstRiseTs = 0;
          this.ascentStartTs = timestampMs;
          this.maxTorsoAngleInCurrentRep = torsoAngle;
          this.activeCue = 'Control descent — push hips back';
        }
        break;
      }

      case 'DESCENDING': {
        if (kneeAngle < this.minKneeAngleInCurrentRep) {
          this.minKneeAngleInCurrentRep = kneeAngle;
          this.minKneeAngleTs = timestampMs;
        }
        if (torsoAngle > this.maxTorsoAngleInCurrentRep) {
          this.maxTorsoAngleInCurrentRep = torsoAngle;
        }

        // Reversal check: sustained rise of inflectionRiseMargin (e.g. 6°)
        const hasReversed =
          kneeAngle >= this.minKneeAngleInCurrentRep + this.thresholds.inflectionRiseMargin;

        if (hasReversed) {
          this.state = 'BOTTOM';
          this.bottomTs = this.minKneeAngleTs;
          this.firstRiseTs = 0;
          this.activeCue =
            this.minKneeAngleInCurrentRep <= this.thresholds.parallelDepthThreshold
              ? 'Good depth reached! Drive upward'
              : 'Inflection reached — aim for parallel depth (≤ 100°)';
        } else {
          this.activeCue = 'Descending — maintain controlled pace';
        }
        break;
      }

      case 'BOTTOM': {
        if (kneeAngle < this.minKneeAngleInCurrentRep) {
          this.minKneeAngleInCurrentRep = kneeAngle;
          this.minKneeAngleTs = timestampMs;
          this.bottomTs = timestampMs;
        }
        if (torsoAngle > this.maxTorsoAngleInCurrentRep) {
          this.maxTorsoAngleInCurrentRep = torsoAngle;
        }

        // Detect start of upward rise
        if (kneeAngle > this.minKneeAngleInCurrentRep + 1.5 && this.firstRiseTs === 0) {
          this.firstRiseTs = timestampMs;
        }

        // Ascending check: knee angle rises above ascentTrigger or rises >= ascentRiseMargin (10°)
        const isAscending =
          kneeAngle >= this.thresholds.ascentTrigger ||
          kneeAngle >= this.minKneeAngleInCurrentRep + this.thresholds.ascentRiseMargin;

        if (isAscending) {
          this.state = 'ASCENDING';
          this.ascentStartTs = this.firstRiseTs > 0 ? this.firstRiseTs : timestampMs;
          this.activeCue = 'Drive up through midfoot — exhale on ascent';
        } else {
          this.activeCue =
            this.minKneeAngleInCurrentRep <= this.thresholds.parallelDepthThreshold
              ? 'Hold depth briefly — drive up'
              : 'Deeper next rep to reach parallel';
        }
        break;
      }

      case 'ASCENDING': {
        if (torsoAngle > this.maxTorsoAngleInCurrentRep) {
          this.maxTorsoAngleInCurrentRep = torsoAngle;
        }

        // Return to standing posture
        if (kneeAngle >= this.thresholds.standThreshold) {
          const totalDurationSec = Math.max(0.1, (timestampMs - this.descentStartTs) / 1000);

          // Debounce rapid noise / twitch
          if (totalDurationSec >= this.thresholds.minRepDurationSec) {
            this.repNumber += 1;

            const eccentricSec = Math.max(
              0.1,
              Number(((this.bottomTs - this.descentStartTs) / 1000).toFixed(2)),
            );
            const pauseSec = Math.max(
              0.0,
              Number(((this.ascentStartTs - this.bottomTs) / 1000).toFixed(2)),
            );
            const concentricSec = Math.max(
              0.1,
              Number(((timestampMs - this.ascentStartTs) / 1000).toFixed(2)),
            );
            const isValidDepth =
              this.minKneeAngleInCurrentRep <= this.thresholds.parallelDepthThreshold;

            const feedback: string[] = [];
            if (this.minKneeAngleInCurrentRep <= this.thresholds.deepDepthThreshold) {
              feedback.push(`Deep squat achieved (${this.minKneeAngleInCurrentRep}° knee angle)`);
            } else if (isValidDepth) {
              feedback.push(
                `Parallel depth achieved (${this.minKneeAngleInCurrentRep}° knee angle)`,
              );
            } else {
              feedback.push(
                `Partial depth (${this.minKneeAngleInCurrentRep}°): work towards parallel (≤ 100°)`,
              );
            }

            if (eccentricSec < 1.0) {
              feedback.push(`Fast descent (${eccentricSec}s): slow down for greater control`);
            } else {
              feedback.push(`Controlled descent (${eccentricSec}s)`);
            }

            if (this.maxTorsoAngleInCurrentRep > 45) {
              feedback.push('Notable forward torso lean: keep chest proud');
            }

            completedRep = {
              repNumber: this.repNumber,
              valid: isValidDepth,
              minKneeAngle: this.minKneeAngleInCurrentRep,
              eccentricDurationSec: eccentricSec,
              pauseDurationSec: pauseSec,
              concentricDurationSec: concentricSec,
              totalDurationSec: Number(totalDurationSec.toFixed(2)),
              startTs: this.descentStartTs,
              bottomTs: this.bottomTs,
              endTs: timestampMs,
              tempo: `${eccentricSec.toFixed(1)}-${pauseSec.toFixed(1)}-${concentricSec.toFixed(1)}`,
              formFeedback: feedback,
            };

            this.completedReps.push(completedRep);
            this.activeCue = isValidDepth
              ? `Rep ${this.repNumber} complete! (Tempo ${completedRep.tempo})`
              : `Partial rep recorded. Focus on depth.`;
          }

          // Reset to STAND
          this.state = 'STAND';
          this.minKneeAngleInCurrentRep = 180;
          this.maxTorsoAngleInCurrentRep = 0;
          this.firstRiseTs = 0;
          this.lastStandTs = timestampMs;
        }
        break;
      }
    }

    return {
      state: this.state,
      repCount: this.getRepCount(),
      partialRepCount: this.getPartialRepCount(),
      currentKneeAngle: kneeAngle,
      currentTorsoAngle: torsoAngle,
      activeCue: this.activeCue,
      isReliable: true,
      completedRep,
      minKneeAngleInRep: this.minKneeAngleInCurrentRep,
      elapsedInRepSec: this.descentStartTs > 0 ? (timestampMs - this.descentStartTs) / 1000 : 0,
    };
  }
}
