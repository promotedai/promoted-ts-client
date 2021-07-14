import { InsertionMapFn } from './base-request';
import { InsertionPageType } from './insertion-page-type';
import { Insertion, Request } from './types/delivery';
import { CohortMembership } from './types/event';

/**
 * Represents a single call for retrieving and ranking content.
 */
export interface DeliveryRequest {
  /** Removes unnecessary fields on Insertions for Delivery API. */
  toCompactDeliveryInsertion?: InsertionMapFn;

  /** Removes unnecessary fields on Insertions for Metrics API. */
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
   * A way to customize when `deliver` should not run an experiment and just log
   * (CONTROL) vs run through the experiment deliver code path.
   * Defaults to false.
   */
  onlyLog?: boolean;

  /**
   * Used to run a client-side experiment.  Activation happens if other
   * overrides do not disable it (`enabled=false` or `onlyLog=true`).
   *
   * If undefined, no experiment is run.  By default, Delivery API is called.
   *
   * If set, this is runs `deliver` as a client-side experiment.  The CONTROL
   * arm does not call Delivery API.  It only logs.  The TREATMENT arm uses
   * Delivery API to change Insertions.
   *
   * This CohortMembership is also logged to Metrics.
   */
  experiment?: CohortMembership;

  /**
   * Indicates the page type of the full insertion list on this request.
   * For a DeliveryRequest, you should always pass "unpaged" full insertions, and
   * the SDK makes this assumption on your behalf.
   */
  insertionPageType?: InsertionPageType;
}
