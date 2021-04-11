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
  deliver(clientRequest: ClientRequest): Promise<ClientResponse>;

  /**
   * Used to only log the Delivery request.
   */
  prepareForLogging(clientRequest: ClientRequest): Promise<ClientResponse>;
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
   * Default values to use on ClientRequests.
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
 * Common interface so we can set request values in PromotedClient's constructor.
 */
export interface BaseRequest {
  /** Defaults to true */
  shouldOptimize?: boolean;

  /** A function to shrink the Insertions on Delivery API. */
  toCompactDeliveryInsertion?: InsertionMapFn;

  /** A function to shrink the Insertions on Metrics API. */
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
 * Represents a single call for retrieving and ranking content.
 */
export interface ClientRequest extends BaseRequest {
  /**
   * The Request for content.  Contains insertions of incoming results.
   */
  request: Request;

  /**
   * Insertions with all metadata.  The `toCompact` functions are used to
   * transform the fullInsertions to Insertions on each of the requests.
   */
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
export interface ClientResponse {
  /**
   * Sends the log records to Metrics API.
   * Clients need to call this, preferrably after they send the response to
   * their UI/apps.
   */
  log: () => Promise<void>;

  /**
   * A list of the resulting Insertions.  This list should be truncated
   * based on limit.
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
  public async deliver(clientRequest: ClientRequest): Promise<ClientResponse> {
    const { request, fullInsertions } = clientRequest;
    const limit = request.limit === undefined ? DEFAULT_LIMIT : request.limit;
    const resultInsertions = fullInsertions.slice(0, limit);
    return Promise.resolve({
      log: () => Promise.resolve(undefined),
      insertion: resultInsertions,
    });
  }

  public async prepareForLogging(clientRequest: ClientRequest): Promise<ClientResponse> {
    return this.deliver(clientRequest);
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
    const {
      defaultRequestValues: { shouldOptimize, toCompactDeliveryInsertion, toCompactMetricsInsertion } = {},
    } = args;
    this.defaultRequestValues = {
      shouldOptimize: shouldOptimize === undefined ? true : shouldOptimize,
      toCompactDeliveryInsertion:
        toCompactDeliveryInsertion === undefined ? (insertion) => insertion : toCompactDeliveryInsertion,
      toCompactMetricsInsertion:
        toCompactMetricsInsertion === undefined ? (insertion) => insertion : toCompactMetricsInsertion,
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

  public async prepareForLogging(clientRequest: ClientRequest): Promise<ClientResponse> {
    // Use deliver method but force shouldOptimize to false.
    return this.deliver({
      ...clientRequest,
      shouldOptimize: false,
    });
  }

  /**
   * Used to optimize a list of content.  This function modifies clientRequest.
   */
  public async deliver(clientRequest: ClientRequest): Promise<ClientResponse> {
    if (this.performChecks) {
      const error = checkThatLogIdsNotSet(clientRequest);
      if (error) {
        this.handleError(error);
      }
    }
    this.preDeliveryFillInFields(clientRequest);
    const shouldOptimize = this.getShouldOptimize(clientRequest);

    // TODO - if response only passes back IDs that are passed in, then we can
    // return just IDs back.

    // We default to returning the input insertions.
    let resultInsertions: Insertion[] | undefined = undefined;
    // If defined, log the CohortMembership to Metrics API.
    let cohortMembershipToLog: CohortMembership | undefined = undefined;

    // TODO - add clientRequestId.

    let insertionsFromPromoted = false;
    if (shouldOptimize) {
      try {
        cohortMembershipToLog = newCohortMembershipToLog(clientRequest);
        if (this.shouldApplyTreatment(cohortMembershipToLog)) {
          const toCompactDeliveryInsertion = this.getToCompactDeliveryInsertion(clientRequest);
          const deliveryRequest = {
            ...clientRequest.request,
            insertion: clientRequest.fullInsertions.map(toCompactDeliveryInsertion),
          };
          const response = await this.deliveryTimeoutWrapper(
            this.deliveryClient(deliveryRequest),
            this.deliveryTimeoutMillis
          );
          insertionsFromPromoted = true;
          resultInsertions = fillInDetails(
            response.insertion === undefined ? [] : response.insertion,
            clientRequest.fullInsertions
          );
        }
      } catch (error) {
        this.handleError(error);
      }
    }
    // If defined, log the Request to Metrics API.
    let requestToLog: Request | undefined = undefined;
    if (!insertionsFromPromoted) {
      // If you update this, update the no-op version too.
      requestToLog = clientRequest.request;
      const limit = requestToLog.limit === undefined ? DEFAULT_LIMIT : requestToLog.limit;
      resultInsertions = clientRequest.fullInsertions.slice(0, limit);
    }
    const insertion = resultInsertions === undefined ? [] : resultInsertions;
    this.addMissingRequestId(requestToLog);
    this.addMissingIdsOnInsertionArray(insertion);
    return {
      log: this.createLogFn(clientRequest, requestToLog, cohortMembershipToLog),
      insertion,
    };
  }

  /**
   * Creates a function that can be used after sending the response.
   */
  // TODO - it's confusing to take both ClientRequest and Request.
  createLogFn(
    clientRequest: ClientRequest,
    requestToLog?: Request,
    cohortMembershipToLog?: CohortMembership
  ): () => Promise<void> {
    if (requestToLog === undefined && cohortMembershipToLog === undefined) {
      // If no log records, short-cut.
      return () => Promise.resolve(undefined);
    }
    return async () => {
      try {
        const toCompactMetricsInsertion = this.getToCompactMetricsInsertion(clientRequest);
        const logRequest = newLogRequest(clientRequest);
        if (requestToLog) {
          const copyRequest = {
            ...requestToLog,
            insertion: clientRequest.fullInsertions.map(toCompactMetricsInsertion),
          };
          logRequest.request = [copyRequest];
        }
        if (cohortMembershipToLog) {
          logRequest.cohortMembership = [cohortMembershipToLog];
        }
        await this.metricsTimeoutWrapper(this.metricsClient(logRequest), this.metricsTimeoutMillis);
      } catch (error) {
        this.handleError(error);
      }
      return Promise.resolve(undefined);
    };
  }

  getShouldOptimize = (clientRequest: ClientRequest): boolean => {
    if (clientRequest.shouldOptimize !== undefined) {
      return clientRequest.shouldOptimize;
    }
    return this.defaultRequestValues.shouldOptimize;
  };

  getToCompactDeliveryInsertion = (clientRequest: ClientRequest): InsertionMapFn => {
    if (clientRequest.toCompactDeliveryInsertion !== undefined) {
      return clientRequest.toCompactDeliveryInsertion;
    }
    return this.defaultRequestValues.toCompactDeliveryInsertion;
  };

  getToCompactMetricsInsertion = (clientRequest: ClientRequest): InsertionMapFn => {
    if (clientRequest.toCompactMetricsInsertion !== undefined) {
      return clientRequest.toCompactMetricsInsertion;
    }
    return this.defaultRequestValues.toCompactMetricsInsertion;
  };

  preDeliveryFillInFields = (clientRequest: ClientRequest) => {
    const { request } = clientRequest;
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

const newCohortMembershipToLog = (clientRequest: ClientRequest): CohortMembership | undefined => {
  if (clientRequest.cohortMembershipIfActivated === undefined) {
    return undefined;
  }
  const { request } = clientRequest;
  const cohortMembership = { ...clientRequest.cohortMembershipIfActivated };
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

const newLogRequest = (clientRequest: ClientRequest): LogRequest => {
  const {
    request: { platformId, userInfo, timing },
  } = clientRequest;
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

const checkThatLogIdsNotSet = (clientRequest: ClientRequest): Error | undefined => {
  const { request, fullInsertions } = clientRequest;
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
 * Fills in responseInsertion details using fullInsertions.  It un-compacts
 * the response.
 */
const fillInDetails = (responseInsertions: Insertion[], fullInsertions: Insertion[]): Insertion[] => {
  const contentIdToInputInsertion = fullInsertions.reduce((map: { [contnetId: string]: Insertion }, insertion) => {
    if (insertion.contentId !== undefined) {
      map[insertion.contentId] = insertion;
    }
    return map;
  }, {});

  if (!responseInsertions) {
    return [];
  }
  return responseInsertions?.map((responseInsertion) => {
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
