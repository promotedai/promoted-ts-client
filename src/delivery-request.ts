import { Request } from './types/delivery';
import { CohortMembership } from './types/event';

/**
 * Represents a single call for retrieving and ranking content.
 */
export interface DeliveryRequest {
  /**
   * The Request for content.
   */
  request: Request;

  /**
   * Clients should send a subset of all request insertions to Promoted on
   * `request.insertion`.  The `insertionStart` specifies the start index of
   * the array `request.insertion` in the list of all request insertions.
   *
   * `request.paging.offset` should be set to the zero-based position in all request insertions
   * (not the relative position in `request.insertion`s).
   *
   * Examples:
   * a. If there are 10 items and all 10 items are in `request.insertion`, then
   *    insertionStart=0.
   * b. If there are 10,000 items and the first 500 items are on `request.insertion`,
   *    then insertionStart=0.
   * c. If there are 10,000 items and we want to send items [500,1000) on `request.insertion`,
   *    then insertionStart=500.
   * c. If there are 10,000 items and we want to send items the last page [9500,10000) on `request.insertion`,
   *    then insertionStart=9500.
   *
   * This field is required because it will likely be a source of bugs.
   *
   * TODO - create a visualization and link to it.
   */
  insertionStart: number;

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
}
