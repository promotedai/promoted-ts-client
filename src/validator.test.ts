import { Validator } from './validator';
import { DeliveryRequest } from './delivery-request';
import { InsertionPageType } from './insertion-page-type';

describe('validator', () => {
  it('errors with prepaged insertions and not only logging', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { userInfo: { logUserId: 'a' } },
      insertionPageType: InsertionPageType.PrePaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Delivery expects unpaged insertions');
  });

  it('errors with prepaged insertions doing shadow traffic', () => {
    const v = new Validator(true, true);
    const req: DeliveryRequest = {
      request: { userInfo: { logUserId: 'a' } },
      insertionPageType: InsertionPageType.PrePaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertions must be unpaged when shadow traffic is on');
  });

  it('allows with prepaged insertions when only logging', () => {
    const v = new Validator(true, false);
    const req: DeliveryRequest = {
      request: { userInfo: { logUserId: 'a' } },
      insertionPageType: InsertionPageType.PrePaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(0);
  });

  it('forces request id to be unset on request', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { requestId: 'aaa', userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Request.requestId should not be set');
  });

  it('forces request id to be unset on insertion', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { insertion: [{ requestId: 'a', contentId: 'zzz' }], userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.requestId should not be set');
  });

  it('forces insertion id to be unset on insertion', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { insertion: [{ insertionId: 'a', contentId: 'zzz' }], userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.insertionId should not be set');
  });

  it('forces content id to be set on insertion', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: '' }], userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.contentId should be set');
  });

  it('accepts a valid insertion on a request', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(0);
  });

  it('forces experiment platform id to not be set', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
      experiment: { platformId: 9 },
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.platformId should not be set');
  });

  it('forces experiment user info to not be set', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
      experiment: { userInfo: { userId: 'aaa' } },
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.userInfo should not be set');
  });

  it('forces experiment timing to not be set', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
      experiment: { timing: { clientLogTimestamp: 333 } },
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.timing should not be set');
  });

  it('allows a valid experiment', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
      experiment: { arm: 'TREATMENT', cohortId: 'aaa' },
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(0);
  });

  it('forces user info to be set on request', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: {},
      insertionPageType: InsertionPageType.Unpaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Request.userInfo should be set');
  });

  it('forces log user id to be set on request user info', () => {
    const v = new Validator(false, false);
    const req: DeliveryRequest = {
      request: { userInfo: { userId: 'aaa' } },
      insertionPageType: InsertionPageType.Unpaged,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Request.userInfo.logUserId should be set');
  });
});
