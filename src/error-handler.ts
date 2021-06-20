export interface ErrorHandler {
  (err: Error): void;
}

/**
 * Simple ErrorHandler that throws the error.
 */
export const throwOnError: ErrorHandler = (err) => {
  throw err;
};

/**
 * Simple ErrorHandler that logs to console.err.
 */
export const logOnError: ErrorHandler = (err) => console.error(err);
