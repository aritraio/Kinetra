import type { LandmarkPoint } from '@kinetra/contracts';

export interface FilterOptions {
  /**
   * Smoothing factor alpha in range (0, 1].
   * Higher values follow raw inputs more closely; lower values smooth more aggressively.
   * Default is 0.65.
   */
  alpha?: number;
  /**
   * Minimum visibility score below which coordinates are held from previous frame.
   * Default is 0.40.
   */
  minVisibility?: number;
}

/**
 * Stateful Exponential Moving Average (EMA) filter for 33 MediaPipe pose landmarks.
 * Removes high-frequency jitter caused by lighting or sensor noise while preserving
 * fast velocity reversals at the bottom of a repetition.
 */
export class LandmarkSmoothingFilter {
  private smoothedLandmarks: LandmarkPoint[] | null = null;
  private readonly alpha: number;
  private readonly minVisibility: number;

  constructor(options: FilterOptions = {}) {
    this.alpha = Math.max(0.1, Math.min(1.0, options.alpha ?? 0.65));
    this.minVisibility = options.minVisibility ?? 0.4;
  }

  /**
   * Filters a frame of 33 landmarks, returning a smoothed landmark array.
   */
  filter(rawLandmarks: LandmarkPoint[]): LandmarkPoint[] {
    if (rawLandmarks?.length !== 33) {
      return rawLandmarks;
    }

    if (!this.smoothedLandmarks) {
      // First frame initializes the filter
      this.smoothedLandmarks = rawLandmarks.map((l) => ({ ...l }));
      return this.smoothedLandmarks;
    }

    const nextSmoothed: LandmarkPoint[] = [];

    for (let i = 0; i < 33; i++) {
      const raw = rawLandmarks[i];
      const prev = this.smoothedLandmarks[i];
      if (!raw || !prev) continue;

      if (raw.visibility < this.minVisibility) {
        // Occluded or low-confidence landmark: retain previous position with decayed visibility
        nextSmoothed.push({
          x: prev.x,
          y: prev.y,
          z: prev.z,
          visibility: Math.max(0, prev.visibility * 0.9),
        });
      } else {
        // Exponential moving average
        const smoothX = this.alpha * raw.x + (1 - this.alpha) * prev.x;
        const smoothY = this.alpha * raw.y + (1 - this.alpha) * prev.y;
        const smoothZ =
          raw.z !== undefined && prev.z !== undefined
            ? this.alpha * raw.z + (1 - this.alpha) * prev.z
            : raw.z;
        const smoothVis = this.alpha * raw.visibility + (1 - this.alpha) * prev.visibility;

        nextSmoothed.push({
          x: Number(smoothX.toFixed(4)),
          y: Number(smoothY.toFixed(4)),
          z: smoothZ !== undefined ? Number(smoothZ.toFixed(4)) : undefined,
          visibility: Number(smoothVis.toFixed(4)),
        });
      }
    }

    this.smoothedLandmarks = nextSmoothed;
    return nextSmoothed;
  }

  /**
   * Resets internal smoothed state (e.g. at the start of a new set).
   */
  reset(): void {
    this.smoothedLandmarks = null;
  }
}
