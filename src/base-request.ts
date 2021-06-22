import type { Insertion } from './types/delivery';

export interface InsertionMapFn {
  (insertion: Insertion): Insertion;
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

  /** A function to shrink the Insertions on Delivery API. */
  toCompactDeliveryInsertion: InsertionMapFn;
  toCompactMetricsInsertion: InsertionMapFn;
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

  /** Removes unnecessary fields on Insertions for Delivery API. */
  toCompactDeliveryInsertion?: InsertionMapFn;

  /** Removes unnecessary fields on Insertions for Metrics API. */
  toCompactMetricsInsertion?: InsertionMapFn;
}
