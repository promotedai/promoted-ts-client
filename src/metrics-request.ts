import { InsertionMapFn } from './base-request';
import { Insertion, Request } from './types/delivery';

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

/**
 * Represents a single call for logging content.
 */
export interface MetricsRequest {
  /** A function to shrink the Insertions on Metrics API. */
  toCompactMetricsInsertion?: InsertionMapFn;

  /**
   * The Request for content.
   */
  request: Request;

  /**
   * Insertions with all metadata.  The `toCompact` functions are used to
   * transform the fullInsertion to Insertions on each of the requests.
   */
  fullInsertion: Insertion[];

  /**
   * Indicates the page type of the full insertion list on this request.
   */
  insertionPageType?: InsertionPageType;
}
