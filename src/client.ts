import { ApiClient } from './api-client';
import { RequiredBaseRequest } from './base-request';
import { PromotedClientArguments } from './client-args';
import { ClientResponse } from './client-response';
import { DeliveryRequest } from './delivery-request';
import { Sampler, SamplerImpl } from './sampler';
import { timeoutWrapper } from './timeout';
import type { ErrorHandler } from './error-handler';
import type { DeliveryLog, Insertion, Request, Response } from './types/delivery';
import type { CohortMembership, LogRequest } from './types/event';
import { Pager } from './pager';
import { ExecutionServer } from './execution-server';
import { Validator, validateResponse } from './validator';

// Version number that semver will generate for the package.
// Must be manually maintained.
export const SERVER_VERSION = 'ts.13.1.0';

/**
 * Design-wise
 *
 * Constructor vs method argument
 * - If a value varies based on the specific request, put it as an argument
 * to the method.
 */

const DEFAULT_DELIVERY_TIMEOUT_MILLIS = 250;
const DEFAULT_METRICS_TIMEOUT_MILLIS = 3000;

const DEFAULT_MAX_REQUEST_INSERTIONS = 1000;

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
   * Used to call Delivery API or Metrics API.  Takes the inputted list of Content and
   * ranks it.  Supports running conditionally.
   */
  deliver(deliveryRequest: DeliveryRequest): Promise<ClientResponse>;

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

  public async deliver(deliveryRequest: DeliveryRequest): Promise<ClientResponse> {
    const { request } = deliveryRequest;
    const responseInsertions = this.pager.applyPaging(
      request.insertion ?? [],
      deliveryRequest.retrievalInsertionOffset,
      request?.paging,
    );
    return Promise.resolve({
      log: () => Promise.resolve(undefined),
      responseInsertions,
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
  private deliveryClient: ApiClient<Request, any>;
  private metricsClient: ApiClient<LogRequest, any>;
  private performChecks: boolean;
  private shadowTrafficDeliveryRate: number;
  private blockingShadowTraffic: boolean;
  private defaultRequestValues: RequiredBaseRequest;
  private handleError: ErrorHandler;
  private validator: Validator;
  private uuid: () => string;
  private deliveryTimeoutMillis: number;
  private metricsTimeoutMillis: number;
  private shouldApplyTreatment: (cohortMembership: CohortMembership | undefined) => boolean;
  private sampler: Sampler;
  private pager: Pager;
  private maxRequestInsertions: number;

  // For testing.
  private nowMillis: () => number;
  // The built in Axios timeout is just response timeout.
  private deliveryTimeoutWrapper: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;
  private metricsTimeoutWrapper: <T>(promise: Promise<T>, timeoutMillis: number) => Promise<T>;

  // TODO - how to handle timeout?

  /**
   * @params {DeliveryClientArguments} args The arguments for Promoted client creation.
   */
  public constructor(args: PromotedClientArguments) {
    this.pager = new Pager();
    this.deliveryClient = args.deliveryClient;
    this.metricsClient = args.metricsClient;
    this.performChecks = args.performChecks ?? true;
    this.maxRequestInsertions = args.maxRequestInsertions ?? DEFAULT_MAX_REQUEST_INSERTIONS;

    this.shadowTrafficDeliveryRate = args.shadowTrafficDeliveryRate ?? 0;
    if (this.shadowTrafficDeliveryRate < 0 || this.shadowTrafficDeliveryRate > 1) {
      throw new RangeError('shadowTrafficDeliveryRate must be between 0 and 1');
    }
    this.blockingShadowTraffic = args.blockingShadowTraffic ?? false;

    this.sampler = args.sampler ?? new SamplerImpl();
    const { defaultRequestValues: { onlyLog } = {} } = args;
    this.defaultRequestValues = {
      onlyLog: onlyLog === undefined ? false : onlyLog,
    };
    this.handleError = args.handleError;
    this.validator = new Validator(args.validatorArguments ?? {});
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

  /**
   * Used to optimize a list of content.  This function modifies deliveryRequest.
   */
  public async deliver(deliveryRequest: DeliveryRequest): Promise<ClientResponse> {
    let { onlyLog, request } = deliveryRequest;
    onlyLog = onlyLog ?? this.defaultRequestValues.onlyLog;
    if (this.performChecks) {
      const validationErrors = this.validator.validate(deliveryRequest);
      if (validationErrors) {
        for (const error of validationErrors) {
          this.handleError(error);
        }
      }
    }
    request = this.fillInRequestFields(request);

    // TODO - if response only passes back IDs that are passed in, then we can
    // return just IDs back.

    // We default to returning the input insertions with all the original details (i.e. properties).
    let responseInsertions: Insertion[] = [];
    // If defined, log the CohortMembership to Metrics API.
    let cohortMembershipToLog: CohortMembership | undefined = undefined;

    // Set to empty to simplify some of the checks.
    if (!request.insertion) {
      request.insertion = [];
    }

    // Trim any request insertions over the maximum allowed.
    if (request.insertion.length > this.maxRequestInsertions) {
      console.warn('Exceeded max request insertions, trimming');
      request.insertion = request.insertion.slice(0, this.maxRequestInsertions);
    }

    let attemptedDeliveryApi = false;
    let insertionsFromDeliveryApi = false;
    if (!onlyLog) {
      try {
        cohortMembershipToLog = deliveryRequest.experiment;
        if (this.shouldApplyTreatment(cohortMembershipToLog)) {
          const singleRequest: Request = {
            ...request,
            clientInfo: {
              trafficType: TrafficType_PRODUCTION,
              clientType: ClientType_PLATFORM_SERVER,
              // Expand `request.clientInfo` after so we can use client-specified trafficType or clientType.
              ...request.clientInfo,
            },
          };

          attemptedDeliveryApi = true;
          const response = await this.callDelivery(singleRequest);
          insertionsFromDeliveryApi = true;
          responseInsertions = response.insertion;
        }
      } catch (error) {
        this.handleRequestError(error, 'delivery', request.clientRequestId);
      }
    }
    if (!attemptedDeliveryApi && this.shouldSendAsShadowTraffic()) {
      if (this.blockingShadowTraffic) {
        await this.deliverBlockingShadowTraffic(request);
      } else {
        this.deliverNonBlockingShadowTraffic(request);
      }
    }
    // If defined, log the Request to Metrics API.
    let deliveryLogToLog: DeliveryLog | undefined = undefined;
    if (!insertionsFromDeliveryApi) {
      const requestId = this.uuid();
      const requestToLog = {
        ...request,
        requestId,
      };
      // Insertions from Promoted are paged on the API side.
      // If we did not call the API for any reason, apply the expected
      // paging to the full insertions here.
      // If you update this, update the no-op version too.
      responseInsertions = this.pager.applyPaging(
        request.insertion,
        deliveryRequest.retrievalInsertionOffset,
        request.paging,
      );
      addInsertionIds(responseInsertions, this.uuid);
      const responseToLog = {
        requestId,
        insertion: responseInsertions,
        // TODO - implement SDK paging info.
        pagingInfo: {},
      };
      deliveryLogToLog = this.createSdkDeliveryLog(requestToLog, responseToLog);
    }

    const logRequest = this.createLogRequest(request, deliveryLogToLog, cohortMembershipToLog);
    return {
      log: this.createLogFn(logRequest, request.clientRequestId),
      responseInsertions,
      executionServer: insertionsFromDeliveryApi ? ExecutionServer.API : ExecutionServer.SDK,
      clientRequestId: request.clientRequestId,
      logRequest,
    };
  }

  /**
   * Applies logic to determine whether or not this request should be forwarded
   * to Delivery API as shadow traffic.
   * @returns true if we should forward, false otherwise.
   */
  private shouldSendAsShadowTraffic = () =>
    this.shadowTrafficDeliveryRate && this.sampler.sampleRandom(this.shadowTrafficDeliveryRate);

  /** Calls Delivery API and validates the response. */
  private callDelivery = async (request: Request): Promise<Response> => {
    return validateResponse(
      await this.deliveryTimeoutWrapper(this.deliveryClient(request), this.deliveryTimeoutMillis),
    );
  };

  /**
   * Creates a non-blocking shadow traffic request to delivery.
   * @param request the underlying request.
   */
  private deliverNonBlockingShadowTraffic = (request: Request) => {
    // Do not await on the Promise.
    this.deliverBlockingShadowTraffic(request);
  };

  /**
   * Creates a blocking shadow traffic request to delivery.
   * @param request the underlying request.
   */
  private deliverBlockingShadowTraffic = async (request: Request): Promise<void> => {
    const singleRequest: Request = {
      ...request,
      clientInfo: {
        trafficType: TrafficType_SHADOW,
        clientType: ClientType_PLATFORM_SERVER,
        // Expand `request.clientInfo` after so we can use client-specified trafficType or clientType.
        ...request.clientInfo,
      },
    };
    // Swallow errors.
    return this.callDelivery(singleRequest)
      .then(() => {
        /* do nothing */
      })
      .catch((error) => this.handleRequestError(error, 'shadow delivery', request.clientRequestId));
  };

  /**
   * On-demand creation of a LogRequest suitable for sending to the metrics client.
   * @param request used to get common fields from.
   * @returns a function to create a LogRequest on demand.
   */
  private createLogRequest(
    request: Request,
    deliveryLogToLog?: DeliveryLog,
    cohortMembershipToLog?: CohortMembership,
  ): LogRequest | undefined {
    if (deliveryLogToLog === undefined && cohortMembershipToLog === undefined) {
      return undefined;
    }

    const logRequest = createBaseLogRequest(request);
    if (deliveryLogToLog) {
      logRequest.deliveryLog = [deliveryLogToLog];
      if (deliveryLogToLog.request) {
        // Remove DeliveryLog.request common fields to optimize the size of the request.
        deleteCommonFields(deliveryLogToLog.request);
      }
    }
    if (cohortMembershipToLog) {
      logRequest.cohortMembership = [cohortMembershipToLog];
      // Ignore any common fields set on CohortMembership.
    }

    logRequest.clientInfo = {
      clientType: ClientType_PLATFORM_SERVER,
      trafficType: TrafficType_PRODUCTION,
      // Expand `request.clientInfo` after so we can use client-specified trafficType or clientType.
      ...logRequest.clientInfo,
    };

    // TODO - strip redundant fields off of child records.

    return logRequest;
  }

  private createSdkDeliveryLog(request: Request, response: Response): DeliveryLog {
    return {
      request,
      response,
      execution: {
        executionServer: ExecutionServer.SDK,
        serverVersion: SERVER_VERSION,
      },
    };
  }

  /**
   * Creates a function that can be used after sending the response.
   */
  private createLogFn(logRequest: LogRequest | undefined, clientRequestId: string | undefined): () => Promise<void> {
    return async () => {
      if (logRequest === undefined) {
        // If no log records, short-cut.
        return Promise.resolve(undefined);
      }

      try {
        await this.metricsTimeoutWrapper(this.metricsClient(logRequest), this.metricsTimeoutMillis);
      } catch (error) {
        this.handleRequestError(error, 'metrics', clientRequestId);
      }
      return Promise.resolve(undefined);
    };
  }

  private fillInRequestFields = (request: Request): Request => {
    // Create a copy so we do not modify the input.
    const timing = { ...request.timing };
    request = {
      ...request,
      timing,
    };
    if (!timing.clientLogTimestamp) {
      timing.clientLogTimestamp = this.nowMillis();
    }
    if (!request.clientRequestId) {
      request.clientRequestId = this.uuid();
    }
    return request;
  };

  // The wrapped Error loses the original stack trace.
  private handleRequestError = (error: Error, method: string, clientRequestId: string | undefined) => {
    const message = error.message ?? error.toString();
    this.handleError(new Error(`${message}; ${method}, clientRequestId=${clientRequestId}`));
  };
}

const addInsertionIds = (responseInsertions: Insertion[], uuid: () => string) => {
  responseInsertions.forEach((insertion) => (insertion.insertionId = uuid()));
};

/**
 * Default function for 'shouldApplyTreatment'.
 */
const defaultShouldApplyTreatment = (cohortMembership: CohortMembership) => {
  const arm = cohortMembership?.arm;
  return arm === undefined || arm !== 'CONTROL';
};

const createBaseLogRequest = (request: Request): LogRequest => {
  const { platformId, userInfo, timing, clientInfo } = request;
  return {
    platformId,
    userInfo,
    timing,
    clientInfo,
  };
};

const deleteCommonFields = (request: Request) => {
  delete request['platformId'];
  delete request['userInfo'];
  delete request['timing'];
  delete request['clientInfo'];
};
