/**
 * Returns a simple hash of a string.  Base implementation is from Java.
 */
export const hashCode = (input: string): number => {
  if (input.length === 0) {
    return 0;
  }
  let hash = 0;
  let ch: number;
  for (let i = 0; i < input.length; i++) {
    ch = input.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash |= 0; // Converts to 32-bit int
  }
  return hash;
};

/**
 * Returns a simple combined hash of two other hashes.  From Effective Java.
 */
export const combineHash = (hash1: number, hash2: number): number => {
  let hash = 17;
  hash = hash * 31 + hash1;
  hash = hash * 31 + hash2;
  return hash;
};
