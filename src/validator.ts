import { DeliveryRequest } from './delivery-request';
import { InsertionPageType } from './insertion-page-type';

/**
 * Validator helps with validation and debugging of delivery requests.
 * It is only called when client.performChecks is true.
 */
export class Validator {
  private onlyLog: boolean;
  private shadowTrafficEnabled: boolean;

  constructor(onlyLog: boolean, shadowTrafficEnabled: boolean) {
    this.onlyLog = onlyLog;
    this.shadowTrafficEnabled = shadowTrafficEnabled;
  }

  validate(deliveryRequest: DeliveryRequest): Error[] {
    const errors: Error[] = [];

    const error = validateIds(deliveryRequest);
    if (error) {
      errors.push(error);
    }

    // Delivery requires unpaged insertions.
    if (deliveryRequest.insertionPageType === InsertionPageType.PrePaged) {
      if (!this.onlyLog) {
        errors.push(new Error('Delivery expects unpaged insertions'));
      } else if (this.shadowTrafficEnabled) {
        errors.push(new Error('Insertions must be unpaged when shadow traffic is on'));
      }
    }

    return errors;
  }
}

const validateIds = (deliveryRequest: DeliveryRequest): Error | undefined => {
  const { experiment, request } = deliveryRequest;
  if (request.requestId) {
    return new Error('Request.requestId should not be set');
  }

  if (!request.userInfo) {
    return new Error('Request.userInfo should be set');
  }

  if (!request.userInfo.logUserId) {
    return new Error('Request.userInfo.logUserId should be set');
  }

  const { insertion } = request;
  for (const ins of insertion ?? []) {
    if (ins.requestId) {
      return new Error('Insertion.requestId should not be set');
    }
    if (ins.insertionId) {
      return new Error('Insertion.insertionId should not be set');
    }
    if (!ins.contentId) {
      return new Error('Insertion.contentId should be set');
    }
  }
  if (experiment) {
    // TODO - change the types to limit this.
    if (experiment.platformId) {
      return new Error('Experiment.platformId should not be set');
    }
    if (experiment.userInfo) {
      return new Error('Experiment.userInfo should not be set');
    }
    if (experiment.timing) {
      return new Error('Experiment.timing should not be set');
    }
  }
  return undefined;
};
