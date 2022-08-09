import { combineHash, hashCode } from './hash';
import {
  ProcessedTwoArmExperimentConfig,
  prepareTwoArmExperimentConfig,
  twoArmExperimentConfig5050,
  twoArmExperimentMembership,
} from '.';

describe('prepare', () => {
  it('good', () => {
    expect(
      prepareTwoArmExperimentConfig({
        cohortId: 'HOLD_OUT',
        numActiveControlBuckets: 10,
        numControlBuckets: 50,
        numActiveTreatmentBuckets: 10,
        numTreatmentBuckets: 50,
      })
    ).toEqual({
      cohortId: 'HOLD_OUT',
      cohortIdHash: 268162990,
      numActiveControlBuckets: 10,
      numActiveTreatmentBuckets: 10,
      numControlBuckets: 50,
      numTotalBuckets: 100,
      numTreatmentBuckets: 50,
    });
  });

  describe('bad', () => {
    it('cohortId', () => {
      expect(() =>
        prepareTwoArmExperimentConfig({
          cohortId: '',
          numActiveControlBuckets: 10,
          numControlBuckets: 50,
          numActiveTreatmentBuckets: 10,
          numTreatmentBuckets: 50,
        })
      ).toThrow('cohortId needs to be a non-empty string');
    });

    it('numActiveControlBuckets negative', () => {
      expect(() =>
        prepareTwoArmExperimentConfig({
          cohortId: 'HOLD_OUT',
          numActiveControlBuckets: -1,
          numControlBuckets: 50,
          numActiveTreatmentBuckets: 10,
          numTreatmentBuckets: 50,
        })
      ).toThrow('numActiveControlBuckets needs to be non-negative');
    });

    it('numTreatmentBuckets negative', () => {
      expect(() =>
        prepareTwoArmExperimentConfig({
          cohortId: 'HOLD_OUT',
          numActiveControlBuckets: 10,
          numControlBuckets: 50,
          numActiveTreatmentBuckets: -1,
          numTreatmentBuckets: 50,
        })
      ).toThrow('numActiveTreatmentBuckets needs to be non-negative');
    });

    it('numActiveControlBuckets > numControlBuckets', () => {
      expect(() =>
        prepareTwoArmExperimentConfig({
          cohortId: 'HOLD_OUT',
          numActiveControlBuckets: 60,
          numControlBuckets: 50,
          numActiveTreatmentBuckets: 10,
          numTreatmentBuckets: 50,
        })
      ).toThrow('numActiveControlBuckets needs to be <= numControlBuckets');
    });

    it('numTreatmentBuckets > numTreatmentBuckets', () => {
      expect(() =>
        prepareTwoArmExperimentConfig({
          cohortId: 'HOLD_OUT',
          numActiveControlBuckets: 10,
          numControlBuckets: 50,
          numActiveTreatmentBuckets: 60,
          numTreatmentBuckets: 50,
        })
      ).toThrow('numActiveTreatmentBuckets needs to be <= numTreatmentBuckets');
    });
  });
});

describe('twoArmExperimentConfig', () => {
  it('good', () => {
    expect(twoArmExperimentConfig5050('HOLD_OUT1', 1, 1)).toEqual({
      cohortId: 'HOLD_OUT1',
      cohortIdHash: -276881853,
      numActiveControlBuckets: 10,
      numActiveTreatmentBuckets: 10,
      numControlBuckets: 500,
      numTotalBuckets: 1000,
      numTreatmentBuckets: 500,
    });
  });

  it('partial bucket', () => {
    expect(twoArmExperimentConfig5050('v1', 2.5, 2.5)).toEqual({
      cohortId: 'v1',
      cohortIdHash: 3707,
      numActiveControlBuckets: 25,
      numActiveTreatmentBuckets: 25,
      numControlBuckets: 500,
      numTotalBuckets: 1000,
      numTreatmentBuckets: 500,
    });
  });

  describe('bad', () => {
    it('controlPercent too low', () => {
      expect(() => twoArmExperimentConfig5050('HOLD_OUT1', -1, 10)).toThrow(
        'numActiveControlBuckets needs to be non-negative'
      );
    });

    it('controlPercent too high', () => {
      expect(() => twoArmExperimentConfig5050('HOLD_OUT1', 60, 10)).toThrow(
        'numActiveControlBuckets needs to be <= numControlBuckets'
      );
    });

    it('treatmentPercent too low', () => {
      expect(() => twoArmExperimentConfig5050('HOLD_OUT1', 10, -1)).toThrow(
        'numActiveTreatmentBuckets needs to be non-negative'
      );
    });

    it('treatmentPercent too high', () => {
      expect(() => twoArmExperimentConfig5050('HOLD_OUT1', 10, 60)).toThrow(
        'numActiveTreatmentBuckets needs to be <= numTreatmentBuckets'
      );
    });
  });
});

describe('twoArmExperimentMembership', () => {
  const experimentConfig = prepareTwoArmExperimentConfig({
    cohortId: 'HOLD_OUT',
    numActiveControlBuckets: 25,
    numActiveTreatmentBuckets: 25,
    numControlBuckets: 50,
    numTreatmentBuckets: 50,
  });

  it('treatment', () => {
    expect(twoArmExperimentMembership('user1', experimentConfig)).toEqual({
      arm: 'TREATMENT',
      cohortId: 'HOLD_OUT',
    });
  });

  it('control', () => {
    expect(twoArmExperimentMembership('user2', experimentConfig)).toEqual({
      arm: 'CONTROL',
      cohortId: 'HOLD_OUT',
    });
  });

  it('not active', () => {
    expect(twoArmExperimentMembership('user3', experimentConfig)).toBeUndefined();
  });

  describe('specific uidscheck for negative modulo', () => {
    it('undefined', () => {
      const config = twoArmExperimentConfig5050('v1', 2.5, 2.5, 1000);
      const userId = 'C329D70D-1EAF-4D69-A373-12D78068BE86';
      const hash = combineHash(hashCode(userId), config.cohortIdHash);
      expect(hash).toEqual(-28423771053);
      expect(twoArmExperimentMembership(userId, config)).toBeUndefined();
    });

    it('treatment', () => {
      const config = twoArmExperimentConfig5050('v1', 50, 50);
      const userId = 'C329D70D-1EAF-4D69-A373-12D78068BE86';
      const hash = combineHash(hashCode(userId), config.cohortIdHash);
      expect(hash).toEqual(-28423771053);
      expect(twoArmExperimentMembership(userId, config)).toEqual({ arm: 'TREATMENT', cohortId: 'v1' });
    });
  });
});

describe('check distribution', () => {
  it('not enough buckets', () => {
    const config = twoArmExperimentConfig5050('v1', 2.5, 2.5, 100);
    expect(runForSampleUsers(config, 1000)).toEqual({
      CONTROL: 34,
      TREATMENT: 26,
      undefined: 940,
    });
  });

  it('need more buckets', () => {
    const config = twoArmExperimentConfig5050('v1', 2.5, 2.5);
    expect(runForSampleUsers(config, 1000)).toEqual({
      CONTROL: 27,
      TREATMENT: 24,
      undefined: 949,
    });
  });

  const runForSampleUsers = (config: ProcessedTwoArmExperimentConfig, count: number) => {
    return Array(count)
      .fill(0)
      .map((_, i) => {
        const membership = twoArmExperimentMembership('' + i, config);
        if (membership == undefined) {
          return 'undefined';
        }
        return membership.arm?.toString() ?? '';
      })
      .reduce((counts, expValue) => {
        counts[expValue] = counts[expValue] ? counts[expValue] + 1 : 1;
        return counts;
      }, {});
  };
});
