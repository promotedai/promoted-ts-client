/**
 * Used to set default values on BaseRequests in the Client's constructor.
 */
export interface RequiredBaseRequest {
  /**
   * A way to customize when `deliver` should not run an experiment and just log
   * (CONTROL) vs run through the experiment deliver code path.
   * Defaults to false.
   */
  onlyLog: boolean;
}

/**
 * Common interface so we can set request values in PromotedClient's constructor.
 */
export interface BaseRequest {
  /**
   * A way to customize when `deliver` should not run an experiment and just log
   * (CONTROL) vs run through the experiment deliver code path.
   * Defaults to false.
   */
  onlyLog?: boolean;
}
