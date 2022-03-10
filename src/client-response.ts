import { ExecutionServer } from './execution-server';
import { Insertion } from './types/delivery';
import { LogRequest } from './types/event';

/**
 * A shared response for Metrics or Delivery API.  Makes it easy to swap
 * out either method.
 *
 * Has two main uses:
 * 1) return a modified list of Insertions.
 * 2) clients must call the log method after they send their content back
 * to the client.  They call either `ClientResponse.log` or the `log` helper
 * method (which hides the Promise).
 */
export interface ClientResponse {
  /**
   * Sends the log records to Metrics API.
   * Clients need to call this one of the log methods, preferrably after they
   * send the response to their UI/apps.
   */
  log: () => Promise<void>;

  /**
   * A LogRequest suitable for calling the metrics client.
   * Undefined means we do not need any follow up logging
   */
  logRequest?: LogRequest;

  /**
   * A list of the response Insertions.  This list may be truncated
   * based on paging parameters, i.e. if Deliver is called with more
   * items than any optionally provided Paging.size parameter on the
   * request, at most page size insertions will be forwarded on.
   */
  responseInsertions: Insertion[];

  /**
   * Where the response insertions  were generated (i.e. by the API or
   * locally in the SDK). Undefined on prepareForLogging responses.
   */
  executionServer?: ExecutionServer;

  /**
   * The client request id, for tracking purposes.
   */
  clientRequestId?: string;
}
