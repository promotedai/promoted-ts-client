import { ApiClient } from './api-client';
import { RequiredBaseRequest } from './base-request';
import { PromotedClientArguments } from './client-args';
import { ClientResponse } from './client-response';
import { DeliveryRequest } from './delivery-request';
import { MetricsRequest } from './metrics-request';
import { Sampler, SamplerImpl } from './sampler';
import { timeoutWrapper } from './timeout';
import type { ErrorHandler } from './error-handler';
import type { Insertion, Paging, Request, Response } from './types/delivery';
import type { CohortMembership, LogRequest, LogResponse } from './types/event';

/**
 * Design-wise
 *
 * Constructor vs method argument
 * - If a value varies based on the specific request, put it as an argument
 * to the method.
 */

const DEFAULT_DELIVERY_TIMEOUT_MILLIS = 250;
const DEFAULT_METRICS_TIMEOUT_MILLIS = 3000;

/**
 * Traffic types
 * TODO: Ideally these should come from common.d.ts but that needs a more
 * sophisticated proto translation than what we have now.
 */
export const TrafficType_UNKNOWN_TRAFFIC_TYPE = 0;
export const TrafficType_PRODUCTION = 1;
export const TrafficType_REPLAY = 2;
export const TrafficType_SHADOW = 4;

export const ClientType_UNKNOWN_REQUEST_CLIENT = 0;
export const ClientType_PLATFORM_SERVER = 1;
export const ClientType_PLATFORM_CLIENT = 2;

/**
 * The main interface for our Promoted Client.
 */
export interface PromotedClient {
  /**
   * Used to call Delivery API.  Takes the inputted list of Content and
   * ranks it.  Supports running conditionally.
   */
  deliver(deliveryRequest: DeliveryRequest): Promise<ClientResponse>;

  /**
   * Used to only log Requests and Insertions.
   */
  prepareForLogging(metricsRequest: MetricsRequest): ClientResponse;
}

/**
 * A utilty method for logging and ignoring the response.
 */
export const log = (clientResponse: ClientResponse): void => {
  clientResponse.log().then(noopFn, noopFn);
};

/**
 * Noop function.  Mostly to increase code coverage.
 */
export const noopFn = () => {
  /* no op */
};

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
 * Used when clients want to disable all functionality.
 */
export class NoopPromotedClient implements PromotedClient {
  public prepareForLogging(metricsRequest: MetricsRequest): ClientResponse {
    const { request, fullInsertion } = metricsRequest;
    const insertion = !request?.paging?.size ? fullInsertion : fullInsertion.slice(0, request.paging.size);
    return {
      log: () => Promise.resolve(undefined),
      insertion,
      createLogRequest: () => undefined,
    };
  }

  public async deliver(deliveryRequest: DeliveryRequest): Promise<ClientResponse> {
    const { request, fullInsertion } = deliveryRequest;
    const insertion = !request?.paging?.size ? fullInsertion : fullInsertion.slice(0, request.paging.size);
    return Promise.resolve({
      log: () => Promise.resolve(undefined),
      insertion,
      createLogRequest: () => undefined,
    });
  }
}

/**
 * A PromotedClient implementation that calls Promoted's APIs.
 */
export class PromotedClientImpl implements PromotedClient {
  private deliveryClient: ApiClient<Request, Response>;
  private metricsClient: ApiClient<LogRequest, LogResponse>;
  private performChecks: boolean;
  private shadowTrafficDeliveryPercent: number;
  private defaultRequestValues: RequiredBaseRequest;
  private handleError: ErrorHandler;
  private uuid: () => string;
  private deliveryTimeoutMillis: number;
  private metricsTimeoutMillis: number;
  private shouldApplyTreatment: (cohortMembership: CohortMembership | undefined) => boolean;
  private sampler: Sampler;

  // For testing.
  private nowMillis: () => number;
  private deliveryTimeoutWrapper: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;
  private metricsTimeoutWrapper: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;

  // TODO - how to handle timeout?

  /**
   * @params {DeliveryClientArguments} args The arguments for the logger.
   */
  public constructor(args: PromotedClientArguments) {
    this.deliveryClient = args.deliveryClient;
    this.metricsClient = args.metricsClient;
    this.performChecks = args.performChecks ?? true;

    this.shadowTrafficDeliveryPercent = args.shadowTrafficDeliveryPercent ?? 0;
    if (this.shadowTrafficDeliveryPercent < 0 || this.shadowTrafficDeliveryPercent > 1) {
      throw new RangeError('shadowTrafficDeliveryPercent must be between 0 and 1');
    }

    this.sampler = args.sampler ?? new SamplerImpl();
    const { defaultRequestValues: { onlyLog, toCompactDeliveryInsertion, toCompactMetricsInsertion } = {} } = args;
    this.defaultRequestValues = {
      onlyLog: onlyLog === undefined ? false : onlyLog,
      toCompactDeliveryInsertion:
        toCompactDeliveryInsertion === undefined ? (insertion) => insertion : toCompactDeliveryInsertion,
      toCompactMetricsInsertion:
        toCompactMetricsInsertion === undefined ? (insertion) => insertion : toCompactMetricsInsertion,
    };
    this.handleError = args.handleError;
    this.uuid = args.uuid;
    this.deliveryTimeoutMillis = args.deliveryTimeoutMillis ?? DEFAULT_DELIVERY_TIMEOUT_MILLIS;
    this.metricsTimeoutMillis = args.metricsTimeoutMillis ?? DEFAULT_METRICS_TIMEOUT_MILLIS;
    this.nowMillis = args.nowMillis ?? (() => Date.now());
    this.shouldApplyTreatment = args.shouldApplyTreatment ?? defaultShouldApplyTreatment;
    this.deliveryTimeoutWrapper = args.deliveryTimeoutWrapper ?? timeoutWrapper;
    this.metricsTimeoutWrapper = args.metricsTimeoutWrapper ?? timeoutWrapper;
  }

  // Instead of reusing `deliver`, we copy/paste most of the functionality here.
  // On a dev setup, Node.js seems to add 0.25 milliseconds of latency for
  // having an extra layer of async/await.
  public prepareForLogging(metricsRequest: MetricsRequest): ClientResponse {
    if (this.performChecks) {
      const error = checkThatLogIdsNotSet(metricsRequest);
      if (error) {
        this.handleError(error);
      }
    }
    this.preDeliveryFillInFields(metricsRequest);

    // Send shadow traffic if necessary.
    if (this.shouldSendAsShadowTraffic()) {
      // Fire and forget.
      this.deliverShadowTraffic(metricsRequest);
    }

    // If defined, log the Request to Metrics API.
    const { fullInsertion, request } = metricsRequest;
    const insertion = !request?.paging?.size ? fullInsertion : fullInsertion.slice(0, request.paging.size);
    if (request !== undefined) {
      this.addMissingRequestId(request);
      this.addMissingIdsOnInsertions(request, insertion);
    }

    const logRequestFn = this.createLogRequestFn(metricsRequest, request);
    return {
      log: this.createLogFn(logRequestFn),
      insertion,
      createLogRequest: logRequestFn,
    };
  }

  /**
   * Used to optimize a list of content.  This function modifies deliveryRequest.
   */
  public async deliver(deliveryRequest: DeliveryRequest): Promise<ClientResponse> {
    if (this.performChecks) {
      const error = checkThatLogIdsNotSet(deliveryRequest);
      if (error) {
        this.handleError(error);
      }
    }
    this.preDeliveryFillInFields(deliveryRequest);
    const onlyLog = deliveryRequest.onlyLog ?? this.defaultRequestValues.onlyLog;

    // TODO - if response only passes back IDs that are passed in, then we can
    // return just IDs back.

    // We default to returning the input insertions.
    let responseInsertions: Insertion[] | undefined = undefined;
    // If defined, log the CohortMembership to Metrics API.
    let cohortMembershipToLog: CohortMembership | undefined = undefined;

    // TODO - add deliveryRequestId.

    let insertionsFromPromoted = false;
    if (!onlyLog) {
      try {
        cohortMembershipToLog = newCohortMembershipToLog(deliveryRequest);
        if (this.shouldApplyTreatment(cohortMembershipToLog)) {
          const toCompactDeliveryInsertion =
            deliveryRequest.toCompactDeliveryInsertion ?? this.defaultRequestValues.toCompactDeliveryInsertion;
          const singleRequest = {
            ...deliveryRequest.request,
            insertion: deliveryRequest.fullInsertion.map(toCompactDeliveryInsertion),
          };
          const response = await this.deliveryTimeoutWrapper(
            this.deliveryClient(singleRequest),
            this.deliveryTimeoutMillis
          );
          insertionsFromPromoted = true;
          responseInsertions = fillInDetails(
            response.insertion === undefined ? [] : response.insertion,
            deliveryRequest.fullInsertion
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
      requestToLog = deliveryRequest.request;
      const { fullInsertion } = deliveryRequest;
      responseInsertions = !requestToLog?.paging?.size
        ? fullInsertion
        : fullInsertion.slice(0, requestToLog.paging.size);
    }

    const insertion = responseInsertions === undefined ? [] : responseInsertions;
    if (requestToLog !== undefined) {
      this.addMissingRequestId(requestToLog);
      this.addMissingIdsOnInsertions(requestToLog, insertion);
    }

    const logRequestFn = this.createLogRequestFn(deliveryRequest, requestToLog, cohortMembershipToLog);
    return {
      log: this.createLogFn(logRequestFn),
      insertion,
      createLogRequest: logRequestFn,
    };
  }

  /**
   * Applies logic to determine whether or not this request should be forwarded
   * to Delivery API as shadow traffic.
   * @returns true if we should forward, false otherwise.
   */
  private shouldSendAsShadowTraffic = () =>
    this.shadowTrafficDeliveryPercent && this.sampler.sampleRandom(this.shadowTrafficDeliveryPercent);

  private deliverShadowTraffic(metricsRequest: MetricsRequest) {
    const singleRequest: Request = {
      ...metricsRequest.request,
      insertion: metricsRequest.fullInsertion, // CONSIDER: Whether to copy and/or compact this at some point.
      clientInfo: {
        ...metricsRequest.request.clientInfo,
        trafficType: TrafficType_SHADOW,
      },
    };
    this.deliveryClient(singleRequest);
  }

  /**
   * On-demand creation of a LogRequest suitable for sending to the metrics client.
   * @returns a function to create a LogRequest on demand.
   */
  private createLogRequestFn(
    deliveryRequest: DeliveryRequest,
    requestToLog?: Request,
    cohortMembershipToLog?: CohortMembership
  ): () => LogRequest | undefined {
    return () => {
      if (requestToLog === undefined && cohortMembershipToLog === undefined) {
        return undefined;
      }

      const logRequest: LogRequest = {};
      const toCompactMetricsInsertion =
        deliveryRequest.toCompactMetricsInsertion ?? this.defaultRequestValues.toCompactMetricsInsertion;
      if (requestToLog) {
        logRequest.request = [this.createLogRequestRequestToLog(requestToLog)];
        logRequest.insertion = this.applyPaging(
          deliveryRequest.fullInsertion.map(toCompactMetricsInsertion),
          requestToLog.paging
        );
      }
      if (cohortMembershipToLog) {
        logRequest.cohortMembership = [cohortMembershipToLog];
      }

      const {
        request: { platformId, userInfo, timing },
      } = deliveryRequest;
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
  }

  /**
   * Creates a function that can be used after sending the response.
   */
  private createLogFn(logRequestFn: () => LogRequest | undefined): () => Promise<void> {
    return async () => {
      const logRequest = logRequestFn();
      if (logRequest === undefined) {
        // If no log records, short-cut.
        return Promise.resolve(undefined);
      }

      try {
        await this.metricsTimeoutWrapper(this.metricsClient(logRequest), this.metricsTimeoutMillis);
      } catch (error) {
        this.handleError(error);
      }
      return Promise.resolve(undefined);
    };
  }

  /**
   * Sets the correct position field on each assertion based on paging parameters and takes
   * a page of full insertions (if necessary).
   * @param insertions the full set of insertions
   * @param paging paging info, may be nil
   * @returns the modified page of insertions
   */
  private applyPaging = (insertions: Insertion[], paging?: Paging): Insertion[] => {
    const insertionPage: Insertion[] = [];
    let start = paging?.offset ?? 0;
    let size = paging?.size ?? -1;
    if (size <= 0) {
      size = insertions.length;
    }

    for (const insertion of insertions) {
      if (insertionPage.length >= size) {
        break;
      }
      insertion.position = start;
      insertionPage.push(insertion);
      start++;
    }

    return insertionPage;
  };

  /**
   * Creates a slimmed-down copy of the request for inclusion in a LogRequest.
   * @param requestToLog the request to attach to the log request
   * @returns a copy of the request suitable to be attached to a LogRequest.
   */
  private createLogRequestRequestToLog = (requestToLog: Request): Request => {
    const copyRequest = {
      ...requestToLog,
    };

    // Clear the field in case it is set.
    delete copyRequest['insertion'];

    // Clear the userInfo since we already copied it to the LogRequest.
    delete copyRequest['userInfo'];

    return copyRequest;
  };

  private preDeliveryFillInFields = (deliveryRequest: DeliveryRequest | MetricsRequest) => {
    const { request } = deliveryRequest;
    let { timing } = request;
    if (!timing) {
      timing = {};
      request.timing = timing;
    }
    if (!timing.clientLogTimestamp) {
      timing.clientLogTimestamp = this.nowMillis();
    }
    // TODO - fill in deliveryRequestId.
  };

  /**
   * Called after potential Delivery.  Fill in fields
   */
  private addMissingRequestId = (logRequest: Request) => {
    if (!logRequest.requestId) {
      logRequest.requestId = this.uuid();
    }
  };

  private addMissingIdsOnInsertions = (request: Request, insertions: Insertion[]) => {
    // platformId, userInfo and timing are copied onto LogRequest.
    const { sessionId, viewId, requestId } = request;
    insertions.forEach((insertion) => {
      if (!insertion.insertionId) {
        insertion.insertionId = this.uuid();
      }
      if (sessionId) {
        insertion.sessionId = sessionId;
      }
      if (viewId) {
        insertion.viewId = viewId;
      }
      if (requestId) {
        insertion.requestId = requestId;
      }
    });
  };
}

/**
 * A common toCompact helper function implementation.
 */
export const copyAndRemoveProperties = (insertion: Insertion) => {
  const copy = { ...insertion };
  delete copy['properties'];
  return copy;
};

/**
 * Default function for 'shouldApplyTreatment'.
 */
const defaultShouldApplyTreatment = (cohortMembership: CohortMembership) => {
  const arm = cohortMembership?.arm;
  return arm === undefined || arm !== 'CONTROL';
};

const newCohortMembershipToLog = (deliveryRequest: DeliveryRequest): CohortMembership | undefined => {
  if (deliveryRequest.experiment === undefined) {
    return undefined;
  }
  const { request } = deliveryRequest;
  const cohortMembership = { ...deliveryRequest.experiment };
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

const checkThatLogIdsNotSet = (deliveryRequest: DeliveryRequest | MetricsRequest): Error | undefined => {
  const { request, fullInsertion } = deliveryRequest;
  if (request.requestId) {
    return new Error('Request.requestId should not be set');
  }
  if (request.insertion) {
    return new Error('Do not set Request.insertion.  Set fullInsertion.');
  }

  for (const insertion of fullInsertion) {
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
 * Fills in responseInsertion details using fullInsertion.  It un-compacts
 * the response.
 */
const fillInDetails = (responseInsertions: Insertion[], fullInsertion: Insertion[]): Insertion[] => {
  const contentIdToInputInsertion = fullInsertion.reduce((map: { [contnetId: string]: Insertion }, insertion) => {
    if (insertion.contentId !== undefined) {
      map[insertion.contentId] = insertion;
    }
    return map;
  }, {});

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
