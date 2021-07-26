import { retryPromise } from './retry';

const MAX_RETRY_ATTEMPTS = 3;

describe('retryPromise', () => {
  it('no retries', async () => {
    const mockPromiseFn = jest.fn(() => Promise.resolve(1));
    const value = await retryPromise(MAX_RETRY_ATTEMPTS, mockPromiseFn);
    expect(value).toEqual(1);
  });

  it('one failure then success', async () => {
    let failureCount = 0;
    const mockPromiseFn = jest.fn(() => {
      if (failureCount == 0) {
        failureCount++;
        throw Error('timeout');
      }
      return Promise.resolve(1);
    });
    const value = await retryPromise(MAX_RETRY_ATTEMPTS, mockPromiseFn);
    expect(value).toEqual(1);
  });

  it('all failures', async () => {
    const mockPromiseFn = jest.fn(() => {
      throw Error('timeout');
    });
    await expect(retryPromise(MAX_RETRY_ATTEMPTS, mockPromiseFn)).rejects.toThrow('timeout');
  });
});
