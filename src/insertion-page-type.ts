/**
 * Indicates whether the full insertions are the complete list or
 * pre-paged.
 * For shadow traffic, they should be unpaged, or else an error
 * will be thrown in prepareForLogging.
 */
export enum InsertionPageType {
  /**
   * Full insertions are unpaged, i.e. they include the full list.
   */
  Unpaged = 1,

  /**
   * Full insertions are a single page. Invalid on shadow traffic.
   */
  PrePaged = 2,
}
