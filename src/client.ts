import { ApiClient } from './api-client';
import { PropertiesMapFn, RequiredBaseRequest } from './base-request';
import { PromotedClientArguments } from './client-args';
import { ClientResponse } from './client-response';
import { DeliveryRequest } from './delivery-request';
import { InsertionPageType } from './insertion-page-type';
import { MetricsRequest } from './metrics-request';
import { Sampler, SamplerImpl } from './sampler';
import { timeoutWrapper } from './timeout';
import type { ErrorHandler } from './error-handler';
import type { Insertion, Request, Response } from './types/delivery';
import type { CohortMembership, LogRequest, LogResponse } from './types/event';
import { Pager } from './pager';
import { ExecutionServer } from './execution-server';

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

  /**
   * Indicates whether this is client is performing actions or not.
   */
  enabled: boolean;
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
  private pager: Pager;

  constructor() {
    this.pager = new Pager();
  }

  public prepareForLogging(metricsRequest: MetricsRequest): ClientResponse {
    const { request, fullInsertion } = metricsRequest;
    const responseInsertions = this.pager.applyPaging(fullInsertion, metricsRequest.insertionPageType, request?.paging);
    return {
      log: () => Promise.resolve(undefined),
      insertion: responseInsertions,
      executionServer: ExecutionServer.SDK,
    };
  }

  public async deliver(deliveryRequest: DeliveryRequest): Promise<ClientResponse> {
    const { request, fullInsertion } = deliveryRequest;
    const responseInsertions = this.pager.applyPaging(
      fullInsertion,
      deliveryRequest.insertionPageType,
      request?.paging
    );
    return Promise.resolve({
      log: () => Promise.resolve(undefined),
      insertion: responseInsertions,
      executionServer: ExecutionServer.SDK,
    });
  }

  // Returns whether or not the client is taking actions at this time.
  public get enabled() {
    // The no-op client is never enabled.
    return false;
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
  private pager: Pager;

  // For testing.
  private nowMillis: () => number;
  private deliveryTimeoutWrapper: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;
  private metricsTimeoutWrapper: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;

  // TODO - how to handle timeout?

  /**
   * @params {DeliveryClientArguments} args The arguments for the logger.
   */
  public constructor(args: PromotedClientArguments) {
    this.pager = new Pager();
    this.deliveryClient = args.deliveryClient;
    this.metricsClient = args.metricsClient;
    this.performChecks = args.performChecks ?? true;

    this.shadowTrafficDeliveryPercent = args.shadowTrafficDeliveryPercent ?? 0;
    if (this.shadowTrafficDeliveryPercent < 0 || this.shadowTrafficDeliveryPercent > 1) {
      throw new RangeError('shadowTrafficDeliveryPercent must be between 0 and 1');
    }

    this.sampler = args.sampler ?? new SamplerImpl();
    const { defaultRequestValues: { onlyLog, toCompactDeliveryProperties, toCompactMetricsProperties } = {} } = args;
    this.defaultRequestValues = {
      onlyLog: onlyLog === undefined ? false : onlyLog,
      toCompactDeliveryProperties:
        toCompactDeliveryProperties === undefined ? (properties) => properties : toCompactDeliveryProperties,
      toCompactMetricsProperties:
        toCompactMetricsProperties === undefined ? (properties) => properties : toCompactMetricsProperties,
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

  // Returns whether or not the client is taking actions at this time.
  public get enabled() {
    // The "live" client is always enabled.
    return true;
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

      if (this.shadowTrafficDeliveryPercent > 0 && metricsRequest.insertionPageType != InsertionPageType.Unpaged) {
        this.handleError(new Error('Insertions must be unpaged when shadow traffic is on'));
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
    const responseInsertions = this.pager.applyPaging(fullInsertion, metricsRequest.insertionPageType, request?.paging);

    if (request !== undefined) {
      this.addMissingRequestId(request);
      this.addMissingIdsOnInsertions(request, responseInsertions);
    }

    const logRequest = this.createLogRequest(metricsRequest, responseInsertions, request);
    return {
      log: this.createLogFn(logRequest),
      insertion: responseInsertions,
      clientRequestId: request ? request.clientRequestId : undefined,
      logRequest,
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

      // Delivery requires unpaged insertions.
      if (deliveryRequest.insertionPageType === InsertionPageType.PrePaged) {
        this.handleError(new Error('Delivery expects unpaged insertions'));
      }
    }

    // Delivery requests should always use unpaged insertions.
    deliveryRequest.insertionPageType = InsertionPageType.Unpaged;

    this.preDeliveryFillInFields(deliveryRequest);
    const onlyLog = deliveryRequest.onlyLog ?? this.defaultRequestValues.onlyLog;

    // TODO - if response only passes back IDs that are passed in, then we can
    // return just IDs back.

    // We default to returning the input insertions with all the original details (i.e. properties).
    let responseInsertions: Insertion[] | undefined = undefined;
    // If defined, log the CohortMembership to Metrics API.
    let cohortMembershipToLog: CohortMembership | undefined = undefined;

    let insertionsFromPromoted = false;
    if (!onlyLog) {
      try {
        cohortMembershipToLog = newCohortMembershipToLog(deliveryRequest);
        if (this.shouldApplyTreatment(cohortMembershipToLog)) {
          const toCompactDeliveryRequestInsertion = toCompactInsertionFn(
            deliveryRequest.toCompactDeliveryProperties ?? this.defaultRequestValues.toCompactDeliveryProperties
          );
          const singleRequest = {
            ...deliveryRequest.request,
            insertion: deliveryRequest.fullInsertion.map(toCompactDeliveryRequestInsertion),
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
      // Insertions from Promoted are paged on the API side.
      // If we did not call the API for any reason, apply the expected
      // paging to the full insertions here.
      // If you update this, update the no-op version too.
      requestToLog = deliveryRequest.request;
      const { fullInsertion } = deliveryRequest;
      responseInsertions = this.pager.applyPaging(
        fullInsertion,
        deliveryRequest.insertionPageType,
        requestToLog?.paging
      );
    }

    responseInsertions = responseInsertions || [];
    if (requestToLog !== undefined) {
      this.addMissingRequestId(requestToLog);
      this.addMissingIdsOnInsertions(requestToLog, responseInsertions);
    }

    const logRequest = this.createLogRequest(deliveryRequest, responseInsertions, requestToLog, cohortMembershipToLog);
    return {
      log: this.createLogFn(logRequest),
      insertion: responseInsertions,
      executionServer: insertionsFromPromoted ? ExecutionServer.API : ExecutionServer.SDK,
      clientRequestId: deliveryRequest.request.clientRequestId,
      logRequest,
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
    // Swallow errors.
    this.deliveryClient(singleRequest)
      .then(() => {
        /* do nothing */
      })
      .catch(this.handleError);
  }

  /**
   * On-demand creation of a LogRequest suitable for sending to the metrics client.
   * @returns a function to create a LogRequest on demand.
   */
  private createLogRequest(
    sdkRequest: DeliveryRequest | MetricsRequest,
    responseInsertions: Insertion[],
    requestToLog?: Request,
    cohortMembershipToLog?: CohortMembership
  ): LogRequest | undefined {
    if (requestToLog === undefined && cohortMembershipToLog === undefined) {
      return undefined;
    }

    const logRequest: LogRequest = {};
    const toCompactMetricsResponseInsertion = toCompactInsertionFn(
      sdkRequest.toCompactMetricsProperties ?? this.defaultRequestValues.toCompactMetricsProperties
    );
    if (requestToLog) {
      logRequest.request = [this.createLogRequestRequestToLog(requestToLog)];
      // These are responseInsertions.  We're not renaming the field right now.
      logRequest.insertion = responseInsertions.map(toCompactMetricsResponseInsertion);
    }
    if (cohortMembershipToLog) {
      logRequest.cohortMembership = [cohortMembershipToLog];
    }

    const {
      request: { platformId, userInfo, timing },
    } = sdkRequest;
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
  }

  /**
   * Creates a function that can be used after sending the response.
   */
  private createLogFn(logRequest: LogRequest | undefined): () => Promise<void> {
    return async () => {
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

    if (!request.clientRequestId) {
      request.clientRequestId = this.uuid();
    }
  };

  /**
   * Called after potential Delivery.  Fill in fields
   */
  private addMissingRequestId = (logRequest: Request) => {
    if (!logRequest.requestId) {
      logRequest.requestId = this.uuid();
    }
  };

  private addMissingIdsOnInsertions = (request: Request, responseInsertions: Insertion[]) => {
    // platformId, userInfo and timing are copied onto LogRequest.
    const { sessionId, viewId, requestId } = request;
    responseInsertions.forEach((responseInsertion) => {
      if (!responseInsertion.insertionId) {
        responseInsertion.insertionId = this.uuid();
      }
      if (sessionId) {
        responseInsertion.sessionId = sessionId;
      }
      if (viewId) {
        responseInsertion.viewId = viewId;
      }
      if (requestId) {
        responseInsertion.requestId = requestId;
      }
    });
  };
}

const toCompactInsertionFn = (compactFn: PropertiesMapFn) => (fullInsertion: Insertion) =>
  compactPropertiesOnFullInsertion(fullInsertion, compactFn);

const compactPropertiesOnFullInsertion = (fullInsertion: Insertion, compactFn: PropertiesMapFn) => {
  const { properties } = fullInsertion;
  if (!properties) {
    return fullInsertion;
  }
  const newProperties = compactFn(properties);
  // If the same memory reference, do not copy.
  if (newProperties === properties) {
    return fullInsertion;
  }
  const copy = {
    ...fullInsertion,
  };
  if (newProperties) {
    copy.properties = newProperties;
  } else {
    delete copy['properties'];
  }
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
  const contentIdToInputInsertion = fullInsertion.reduce((map: { [contentId: string]: Insertion }, insertion) => {
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
