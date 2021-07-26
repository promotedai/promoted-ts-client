export const retryPromise = async <T>(maxRetryAttempts: number, promiseFn: () => Promise<T>): Promise<T> => {
  let finalError: Error | undefined;
  for (let i = 0; i < maxRetryAttempts; i++) {
    try {
      return await promiseFn();
    } catch (err) {
      // Only throw if it's the latest attempt.
      finalError = err;
    }
  }
  throw finalError;
};
