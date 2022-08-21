import { ApiClient } from './api-client';
import { BaseRequest } from './base-request';
import { ErrorHandler } from './error-handler';
import { Sampler } from './sampler';
import type { Request, Response } from './types/delivery';
import type { CohortMembership, LogRequest, LogResponse } from './types/event';

/**
 * Arguments for the client so values can be overriden
 */
export interface PromotedClientArguments {
  /**
   * A way to turn off logging.  Defaults to true.
   */
  enabled?: boolean;

  /**
   * The client used to call Delivery API.  No default so we can reduce network
   * dependencies on the core library.
   */
  deliveryClient: ApiClient<Request, Response>;

  /**
   * The client used to call Metrics API.  No default so we can reduce network
   * dependencies on the core library.
   */
  metricsClient: ApiClient<LogRequest, LogResponse>;

  /**
   * Performs extra dev checks.  Safer but slower.  Defaults to true.
   */
  performChecks?: boolean;

  /**
   * Rate (in the range 0.0-1.0) of logging traffic to forward to
   * the Delivery API for use as shadow traffic. 0.0 does no forwarding,
   * and 1.0 forwards every request.  Does not happen if a Delivery API
   * call is attempted.
   */
  shadowTrafficDeliveryRate?: number;

  /**
   * Option to make shadow traffic a blocking (as opposed to background)
   * call to delivery API, defaults to False.
   */
  blockingShadowTraffic?: boolean;

  /**
   * Default values to use on DeliveryRequests.
   */
  defaultRequestValues?: BaseRequest;

  /**
   * Handles errors.
   * Exposed to give clients flexibility into how errors are handled.
   * E.g. in dev, throw an error.  In prod, silently log and monitor.
   *
   * Example NextJS code:
   * ```
   * const throwError =
   *   process?.env?.NODE_ENV !== 'production' ||
   *   (typeof location !== "undefined" && location?.hostname === "localhost");
   * ...
   * handleError: throwError ? (err) => {
   *   throw error;
   * } : (err) => console.error(err);
   * ```
   */
  handleError: ErrorHandler;

  /**
   * Required as a dependency so clients can load reduce dependency on multiple
   * uuid libraries.
   */
  uuid: () => string;

  /* Defaults to 250ms */
  deliveryTimeoutMillis?: number;

  /* Defaults to 3000ms */
  metricsTimeoutMillis?: number;

  /**
   * Allows for customizing when the treatment gets applied.
   */
  shouldApplyTreatment?: (cohortMembership: CohortMembership | undefined) => boolean;

  /**
   * For testing.  Allows for easy mocking of the clock.
   */
  nowMillis?: () => number;

  /**
   * Exposed for testing, easy mocking of request sampling.
   */
  sampler?: Sampler;

  /**
   * For testing. Used by unit tests to swap out timeout functionality.
   */
  deliveryTimeoutWrapper?: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;

  /**
   * For testing. Used by unit tests to swap out timeout functionality.
   */
  metricsTimeoutWrapper?: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;

  /**
   * The maximum number of request insertions that will be passed to (and returned from)
   * Delivery API.
   */
  maxRequestInsertions?: number;
}
