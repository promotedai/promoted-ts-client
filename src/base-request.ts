import type { Properties } from './types/common';

export interface PropertiesMapFn {
  (properties: Properties): Properties | undefined;
}

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

  /** A function to shrink the Properties on Delivery API. */
  toCompactDeliveryProperties: PropertiesMapFn;
  /** A function to shrink the Properties on Metrics API. */
  toCompactMetricsProperties: PropertiesMapFn;
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

  /** Removes unnecessary fields on Properties for Delivery API. */
  toCompactDeliveryProperties?: PropertiesMapFn;

  /** Removes unnecessary fields on Properties for Metrics API. */
  toCompactMetricsProperties?: PropertiesMapFn;
}
