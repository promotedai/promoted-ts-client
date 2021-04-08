import { timeoutWrapper } from './timeout';
import type { Insertion, Request, Response } from './types/delivery';
import type { CohortMembership, LogRequest, LogResponse } from './types/event';

/**
 * Design-wise
 *
 * Constructor vs method argument
 * - If a value varies based on the specific request, put it as an argument
 * to the method.
 */

const DEFAULT_LIMIT = 10;
const DEFAULT_DELIVERY_TIMEOUT_MILLIS = 250;
const DEFAULT_METRICS_TIMEOUT_MILLIS = 3000;

/**
 * The main interface for our Promoted Client.
 */
export interface PromotedClient {
  /**
   * Used to call Delivery API.  Takes the inputted list of Content and
   * ranks it.  Supports running conditionally.
   */
  deliver(deliveryRequest: DeliveryRequest): Promise<DeliveryResponse>;

  /**
   * Used to only log the Delivery request.
   */
  logRequest(deliveryRequest: DeliveryRequest): Promise<DeliveryResponse>;
}

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
   * For testing. Used by unit tests to swap out timeout functionality.
   */
  deliveryTimeoutWrapper?: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;

  /**
   * For testing. Used by unit tests to swap out timeout functionality.
   */
  metricsTimeoutWrapper?: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;
}

/**
 * Simple function interface for making API calls.
 */
export interface ApiClient<Req, Res> {
  (request: Req): Promise<Res>;
}

export interface ErrorHandler {
  (err: Error): void;
}

export interface InsertionMapFn {
  (insertion: Insertion): Insertion;
}

/**
 * Used to set default values on BaseRequests in the Client's constructor.
 */
export interface BaseRequest {
  /* Defaults to true */
  shouldOptimize?: boolean;
  // If you modify, please update fillInMissingBaseFields.

  toCompactDeliveryInsertion?: InsertionMapFn;
  toCompactMetricsInsertion?: InsertionMapFn;
}

/**
 * Used to set default values on BaseRequests in the Client's constructor.
 */
export interface RequiredBaseRequest {
  shouldOptimize: boolean;
  toCompactDeliveryInsertion: InsertionMapFn;
  toCompactMetricsInsertion: InsertionMapFn;
}

/**
 * The input into our deliver call to optimize content ranking.
 */
export interface DeliveryRequest extends BaseRequest {
  /**
   * The Request for content.  Contains insertions of incoming results.
   */
  request: Request;

  fullInsertions: Insertion[];

  /**
   * If set, this is runs delivery as a client-side experiment.  The CONTROL
   * arm does not run delivery.  TREATMENT arm uses Delivery API for results.
   * This CohortMembership is also logged to Metrics.
   */
  cohortMembershipIfActivated?: CohortMembership;
}

/**
 * The result of the delivery call.  Provides hooks for delay calls.
 */
export interface DeliveryResponse {
  /**
   * Should be called after sending response to the client.
   * Allows clients to delay logging until after a response is sent to clients.
   */
  finishAfterResponse: () => Promise<void>;

  /**
   * A list of the resulting Insertions.  If we do not call Delivery or hit
   * errors, we return a truncated version of the input Insertion list.
   */
  insertion: Insertion[];
}

/**
 * Create PromotedClients.
 */
export const newPromotedClient = (args: PromotedClientArguments) => {
  if (args.enabled === undefined || args.enabled) {
    return new PromotedClientImpl(args);
  } else {
    return new NoopPromotedClient();
  }
};

/**
 * Used for clients to disable external calls.
 */
export class NoopPromotedClient implements PromotedClient {
  public async deliver(deliveryRequest: DeliveryRequest): Promise<DeliveryResponse> {
    const { request, fullInsertions } = deliveryRequest;
    const limit = request.limit === undefined ? DEFAULT_LIMIT : request.limit;
    const resultInsertions = fullInsertions.slice(0, limit);
    return Promise.resolve({
      finishAfterResponse: () => Promise.resolve(undefined),
      insertion: resultInsertions,
    });
  }

  public async logRequest(deliveryRequest: DeliveryRequest): Promise<DeliveryResponse> {
    return this.deliver(deliveryRequest);
  }
}

/**
 * A PromotedClient implementation that calls Promoted's APIs.
 */
export class PromotedClientImpl implements PromotedClient {
  private deliveryClient: ApiClient<Request, Response>;
  private metricsClient: ApiClient<LogRequest, LogResponse>;
  private performChecks: boolean;
  private defaultRequestValues: RequiredBaseRequest;
  private handleError: ErrorHandler;
  private uuid: () => string;
  private deliveryTimeoutMillis: number;
  private metricsTimeoutMillis: number;
  private shouldApplyTreatment: (cohortMembership: CohortMembership | undefined) => boolean;
  // For testing.
  private nowMillis: () => number;
  private deliveryTimeoutWrapper: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;
  private metricsTimeoutWrapper: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;

  // TODO - how to handle timeout?
  // TODO - how to perform limit?

  /**
   * @params {DeliveryClientArguments} args The arguments for the logger.
   */
  public constructor(args: PromotedClientArguments) {
    this.deliveryClient = args.deliveryClient;
    this.metricsClient = args.metricsClient;
    this.performChecks = args.performChecks === undefined ? true : args.performChecks;
    const { defaultRequestValues } = args;
    this.defaultRequestValues = {
      shouldOptimize: defaultRequestValues?.shouldOptimize === undefined ? true : defaultRequestValues.shouldOptimize,
      toCompactDeliveryInsertion:
        defaultRequestValues?.toCompactDeliveryInsertion === undefined
          ? (insertion) => insertion
          : defaultRequestValues.toCompactDeliveryInsertion,
      toCompactMetricsInsertion:
        defaultRequestValues?.toCompactMetricsInsertion === undefined
          ? (insertion) => insertion
          : defaultRequestValues.toCompactMetricsInsertion,
    };
    this.handleError = args.handleError;
    this.uuid = args.uuid;
    this.deliveryTimeoutMillis =
      args.deliveryTimeoutMillis === undefined ? DEFAULT_DELIVERY_TIMEOUT_MILLIS : args.deliveryTimeoutMillis;
    this.metricsTimeoutMillis =
      args.metricsTimeoutMillis === undefined ? DEFAULT_METRICS_TIMEOUT_MILLIS : args.metricsTimeoutMillis;
    this.nowMillis = args.nowMillis === undefined ? () => Date.now() : args.nowMillis;
    this.shouldApplyTreatment =
      args.shouldApplyTreatment === undefined ? defaultShouldApplyTreatment : args.shouldApplyTreatment;
    this.deliveryTimeoutWrapper =
      args.deliveryTimeoutWrapper === undefined ? timeoutWrapper : args.deliveryTimeoutWrapper;
    this.metricsTimeoutWrapper = args.metricsTimeoutWrapper === undefined ? timeoutWrapper : args.metricsTimeoutWrapper;
  }

  public async logRequest(deliveryRequest: DeliveryRequest): Promise<DeliveryResponse> {
    // Use deliver method but force shouldOptimize to false.
    return this.deliver({
      ...deliveryRequest,
      shouldOptimize: false,
    });
  }

  /**
   * Used to optimize a list of content.  This function modifies deliveryRequest.
   */
  public async deliver(deliveryRequest: DeliveryRequest): Promise<DeliveryResponse> {
    if (this.performChecks) {
      const error = checkThatLogIdsNotSet(deliveryRequest);
      if (error) {
        this.handleError(error);
      }
    }
    const shouldOptimize = this.getShouldOptimize(deliveryRequest);
    const toCompactDeliveryInsertion = this.getToCompactDeliveryInsertion(deliveryRequest);
    this.preDeliveryFillInFields(deliveryRequest);

    // TODO - if response only passes back IDs that are passed in, then we can
    // return just IDs back.

    // We default to returning the input insertions.
    let resultInsertions: Insertion[] | undefined = undefined;
    // If defined, log the CohortMembership to Metrics API.
    let cohortMembershipToLog: CohortMembership | undefined = undefined;
    // If defined, log the Request to Metrics API.
    let requestToLog: Request | undefined = undefined;

    // TODO - add clientRequestId.

    let insertionsFromPromoted = false;
    try {
      if (shouldOptimize) {
        cohortMembershipToLog = newCohortMembershipToLog(deliveryRequest);
        if (this.shouldApplyTreatment(cohortMembershipToLog)) {
          const delRequest = {
            ...deliveryRequest.request,
            insertion: deliveryRequest.fullInsertions.map(toCompactDeliveryInsertion),
          };
          const response = await this.deliveryTimeoutWrapper(
            this.deliveryClient(delRequest),
            this.deliveryTimeoutMillis
          );
          insertionsFromPromoted = true;
          resultInsertions = getResultInsertions(response, deliveryRequest);
        }
      }
    } catch (error) {
      this.handleError(error);
    }
    if (!insertionsFromPromoted) {
      // If you update this, update the no-op version too.
      requestToLog = deliveryRequest.request;
      const limit = requestToLog.limit === undefined ? DEFAULT_LIMIT : requestToLog.limit;
      resultInsertions = deliveryRequest.fullInsertions.slice(0, limit);
    }
    const insertion = resultInsertions === undefined ? [] : resultInsertions;
    this.addMissingRequestId(requestToLog);
    this.addMissingIdsOnInsertionArray(insertion);
    return {
      finishAfterResponse: this.newFinishAfterResponse(deliveryRequest, requestToLog, cohortMembershipToLog),
      insertion,
    };
  }

  /**
   * Creates a function that can be used after sending the response.
   */
  // TODO - it's confusing to take both DeliveryRequest and Request.
  newFinishAfterResponse(
    deliveryRequest: DeliveryRequest,
    request?: Request,
    cohortMembership?: CohortMembership
  ): () => Promise<void> {
    if (request === undefined && cohortMembership === undefined) {
      // If no log records, short-cut.
      return () => Promise.resolve(undefined);
    }
    return async () => {
      try {
        const toCompactMetricsInsertion = this.getToCompactMetricsInsertion(deliveryRequest);
        const logRequest = newLogRequest(deliveryRequest);
        if (request) {
          const copyRequest = {
            ...request,
            insertion: deliveryRequest.fullInsertions.map(toCompactMetricsInsertion),
          };
          logRequest.request = [copyRequest];
        }
        if (cohortMembership) {
          logRequest.cohortMembership = [cohortMembership];
        }
        await this.metricsTimeoutWrapper(this.metricsClient(logRequest), this.metricsTimeoutMillis);
      } catch (error) {
        this.handleError(error);
      }
      return Promise.resolve(undefined);
    };
  }

  getShouldOptimize = (deliveryRequest: DeliveryRequest): boolean => {
    if (deliveryRequest.shouldOptimize !== undefined) {
      return deliveryRequest.shouldOptimize;
    }
    return this.defaultRequestValues.shouldOptimize;
  };

  getToCompactDeliveryInsertion = (deliveryRequest: DeliveryRequest): InsertionMapFn => {
    if (deliveryRequest.toCompactDeliveryInsertion !== undefined) {
      return deliveryRequest.toCompactDeliveryInsertion;
    }
    return this.defaultRequestValues.toCompactDeliveryInsertion;
  };

  getToCompactMetricsInsertion = (deliveryRequest: DeliveryRequest): InsertionMapFn => {
    if (deliveryRequest.toCompactMetricsInsertion !== undefined) {
      return deliveryRequest.toCompactMetricsInsertion;
    }
    return this.defaultRequestValues.toCompactMetricsInsertion;
  };

  preDeliveryFillInFields = (deliveryRequest: DeliveryRequest) => {
    const { request } = deliveryRequest;
    let { timing } = request;
    if (!timing) {
      timing = {};
      request.timing = timing;
    }
    if (!timing.clientLogTimestamp) {
      timing.clientLogTimestamp = this.nowMillis();
    }
    // TODO - fill in clientRequestId.
  };

  /**
   * Called after potential Delivery.  Fill in fields
   */
  addMissingRequestId = (logRequest: Request | undefined) => {
    if (logRequest) {
      if (!logRequest.requestId) {
        logRequest.requestId = this.uuid();
      }
    }
  };

  addMissingIdsOnInsertionArray = (insertions: Insertion[]) => {
    insertions.forEach((insertion) => {
      if (!insertion.insertionId) {
        insertion.insertionId = this.uuid();
      }
    });
  };
}

/**
 * Simple ErrorHandler that throws the error.
 */
export const throwOnError: ErrorHandler = (err) => {
  throw err;
};

/**
 * Simple ErrorHandler that logs to console.err.
 */
export const logOnError: ErrorHandler = (err) => console.error(err);

/**
 * Default function for 'shouldApplyTreatment'.
 */
const defaultShouldApplyTreatment = (cohortMembership: CohortMembership) => {
  const arm = cohortMembership?.arm;
  return arm === undefined || arm !== 'CONTROL';
};

const newCohortMembershipToLog = (deliveryRequest: DeliveryRequest): CohortMembership | undefined => {
  if (deliveryRequest.cohortMembershipIfActivated === undefined) {
    return undefined;
  }
  const { request } = deliveryRequest;
  const cohortMembership = { ...deliveryRequest.cohortMembershipIfActivated };
  if (!cohortMembership.platformId && request.platformId) {
    cohortMembership.platformId = request.platformId;
  }
  if (!cohortMembership.userInfo && request.userInfo) {
    cohortMembership.userInfo = request.userInfo;
  }
  if (!cohortMembership.timing && request.timing) {
    cohortMembership.timing = request.timing;
  }
  return cohortMembership;
};

const newLogRequest = (deliveryRequest: DeliveryRequest): LogRequest => {
  const {
    request: { platformId, userInfo, timing },
  } = deliveryRequest;
  const logRequest: LogRequest = {};
  if (platformId) {
    logRequest.platformId = platformId;
  }
  if (userInfo) {
    logRequest.userInfo = userInfo;
  }
  if (timing) {
    logRequest.timing = timing;
  }
  return logRequest;
};

const checkThatLogIdsNotSet = (deliveryRequest: DeliveryRequest): Error | undefined => {
  const { request, fullInsertions } = deliveryRequest;
  if (request.requestId) {
    return new Error('Request.requestId should not be set');
  }
  if (request.insertion) {
    return new Error('Do not set Request.insertion.  Set fullInsertions.');
  }

  for (const insertion of fullInsertions) {
    if (insertion.requestId) {
      return new Error('Insertion.requestId should not be set');
    }
    if (insertion.insertionId) {
      return new Error('Insertion.insertionId should not be set');
    }
    if (!insertion.contentId) {
      return new Error('Insertion.contentId should be set');
    }
  }
  return undefined;
};

/**
 *
 */
const getResultInsertions = (response: Response, deliveryRequest: DeliveryRequest): Insertion[] => {
  const contentIdToInputInsertion = deliveryRequest.fullInsertions.reduce(
    (map: { [contnetId: string]: Insertion }, insertion) => {
      if (insertion.contentId !== undefined) {
        map[insertion.contentId] = insertion;
      }
      return map;
    },
    {}
  );

  if (!response.insertion) {
    return [];
  }
  return response.insertion?.map((responseInsertion) => {
    if (responseInsertion.contentId === undefined) {
      return responseInsertion;
    }
    const copy = { ...responseInsertion };
    const inputInsertion = contentIdToInputInsertion[responseInsertion.contentId];
    if (inputInsertion) {
      copy.properties = inputInsertion.properties;
    }
    return copy;
  });
};
