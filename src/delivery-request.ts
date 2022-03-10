import { InsertionPageType } from './insertion-page-type';
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
  insertionPageType: InsertionPageType;
}
