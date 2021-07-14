import { InsertionMapFn } from './base-request';
import { InsertionPageType } from './insertion-page-type';
import { Insertion, Request } from './types/delivery';

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
