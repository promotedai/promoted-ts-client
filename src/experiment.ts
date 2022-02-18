import { combineHash, hashCode } from './hash';
import type { CohortMembership } from './types/event';

/**
 * Represents a two arm Experiment configuration.
 *
 * WARNING - while ramping up an experiment, do not change
 * numControlBuckets or numTreatmentBuckets.  This will
 * likely produce bad results.
 *
 * For the buckets, the treatment buckets are after the
 * control buckets.
 */
export interface TwoArmExperimentConfig {
  /** Name of cohort. */
  cohortId: string;

  /** Num of the numControlBuckets that are active. */
  numActiveControlBuckets: number;

  numControlBuckets: number;

  /** Num of the numTreatmentBuckets that are active. */
  numActiveTreatmentBuckets: number;

  numTreatmentBuckets: number;
}

/**
 * A version of TwoArmExperimentConfig with extra properties.
 */
export interface ProcessedTwoArmExperimentConfig extends TwoArmExperimentConfig {
  /** A hash of the cohortId. */
  cohortIdHash: number;

  /** numControlBuckets + numTreatmentBuckets */
  numTotalBuckets: number;
}

/**
 * Create a simple 50-50 Experiment config using 100 userId buckets.
 * @param cohortId name of the experiment
 * @param controlPercent percent of total to activate into the control arm. Range=[0,50]
 * @param treatmentPercent percent of total to activate into the treatment arm. Range=[0,50]
 */
export const twoArmExperimentConfig5050 = (cohortId: string, controlPercent: number, treatmentPercent: number) => {
  return prepareTwoArmExperimentConfig({
    cohortId,
    numActiveControlBuckets: controlPercent,
    numControlBuckets: 50,
    numActiveTreatmentBuckets: treatmentPercent,
    numTreatmentBuckets: 50,
  });
};

// TODO - cache recent buckets.

/**
 * Runs checks and creates cached values.
 */
export const prepareTwoArmExperimentConfig = (config: TwoArmExperimentConfig): ProcessedTwoArmExperimentConfig => {
  if (!config.cohortId) {
    throw 'cohortId needs to be a non-empty string';
  }
  if (config.numActiveControlBuckets < 0) {
    throw 'numActiveControlBuckets needs to be non-negative';
  }
  if (config.numActiveTreatmentBuckets < 0) {
    throw 'numActiveTreatmentBuckets needs to be non-negative';
  }
  if (config.numActiveControlBuckets > config.numControlBuckets) {
    throw 'numActiveControlBuckets needs to be <= numControlBuckets';
  }
  if (config.numActiveTreatmentBuckets > config.numTreatmentBuckets) {
    throw 'numActiveTreatmentBuckets needs to be <= numTreatmentBuckets';
  }
  return {
    ...config,
    cohortIdHash: hashCode(config.cohortId),
    numTotalBuckets: config.numControlBuckets + config.numTreatmentBuckets,
  };
};

/**
 * Takes a userId and figures out the CohortMembership.
 * Returns undefined when a user is not activated into
 * an experiment.
 */
export const twoArmExperimentMembership = (
  userId: string,
  config: ProcessedTwoArmExperimentConfig
): CohortMembership | undefined => {
  const hash = combineHash(hashCode(userId), config.cohortIdHash);
  const bucket = hash % config.numTotalBuckets;
  if (bucket < config.numActiveControlBuckets) {
    return {
      cohortId: config.cohortId,
      arm: 'CONTROL',
    };
  }
  const { numControlBuckets } = config;
  if (numControlBuckets <= bucket && bucket < numControlBuckets + config.numActiveTreatmentBuckets) {
    return {
      cohortId: config.cohortId,
      arm: 'TREATMENT',
    };
  }
  return undefined;
};
