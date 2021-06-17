import { SamplerImpl } from './sampler';

describe('impl', () => {
  let sampler: SamplerImpl;

  beforeEach(() => {
    sampler = new SamplerImpl();
  });

  it('always samples', () => {
    expect(sampler.sampleRandom(1)).toBeTruthy();
  });

  it('never samples', () => {
    expect(sampler.sampleRandom(0)).toBeFalsy();
  });

  it('sometimes samples', () => {
    expect(sampler.sampleRandom(0.5)).toBeDefined();
  });
});
