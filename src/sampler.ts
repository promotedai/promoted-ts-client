/**
 * Sampler provides algorithms that let us choose a subset of SDK
 * traffic to process, in a testable way.
 */
export interface Sampler {
  sampleRandom(threshold: number): boolean;
}

/**
 * Basic implementation.
 */
export class SamplerImpl implements Sampler {
  /**
   * Simple random sampling that selects below the given threshold.
   * @param threshold the sampling percentage in the range [0, 1).
   * @returns true if we should sample in, false if we should sample out.
   */
  sampleRandom(threshold: number): boolean {
    if (threshold >= 1) {
      return true;
    }
    if (threshold <= 0) {
      return false;
    }
    return Math.random() < threshold;
  }
}
