/**
 * Since the Promise starts before this call, calls run a little longer than timeoutMillis.
 */
export const timeoutWrapper = <T>(promise: Promise<T>, timeoutMillis: number): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Timeout')), timeoutMillis);
  });

  return Promise.race([promise, timeoutPromise]).then((result) => {
    clearTimeout(timeout);
    return result;
  });
};
