import { Validator } from './validator';
import { DeliveryRequest } from './delivery-request';

describe('validator', () => {
  it('forces request id to be unset on request', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { requestId: 'aaa', userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Request.requestId should not be set');
  });

  it('forces request id to be unset on insertion', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { insertion: [{ requestId: 'a', contentId: 'zzz' }], userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.requestId should not be set');
  });

  it('forces insertion id to be unset on insertion', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { insertion: [{ insertionId: 'a', contentId: 'zzz' }], userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.insertionId should not be set');
  });

  it('forces content id to be set on insertion', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: '' }], userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.contentId should be set');
  });

  it('accepts a valid insertion on a request', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(0);
  });

  it('forces experiment platform id to not be set', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
      experiment: { platformId: 9 },
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.platformId should not be set');
  });

  it('forces experiment user info to not be set', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
      experiment: { userInfo: { userId: 'aaa' } },
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.userInfo should not be set');
  });

  it('forces experiment timing to not be set', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
      experiment: { timing: { clientLogTimestamp: 333 } },
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.timing should not be set');
  });

  it('allows a valid experiment', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { logUserId: 'aaa' } },
      insertionStart: 0,
      experiment: { arm: 'TREATMENT', cohortId: 'aaa' },
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(0);
  });

  it('forces user info to be set on request', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: {},
      insertionStart: 0,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Request.userInfo should be set');
  });

  it('forces log user id to be set on request user info', () => {
    const v = new Validator();
    const req: DeliveryRequest = {
      request: { userInfo: { userId: 'aaa' } },
      insertionStart: 0,
    };

    const errors = v.validate(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Request.userInfo.logUserId should be set');
  });

  describe('paging', () => {
    it('success with offset >= insertionStart', () => {
      const v = new Validator();
      const req: DeliveryRequest = {
        request: {
          userInfo: { logUserId: 'a' },
          paging: {
            offset: 0,
            size: 100,
          },
        },
        insertionStart: 0,
      };

      const errors = v.validate(req);
      expect(errors.length).toEqual(0);
    });

    it('errors with offset < insertionStart', () => {
      const v = new Validator();
      const req: DeliveryRequest = {
        request: {
          userInfo: { logUserId: 'a' },
          paging: {
            offset: 0,
            size: 100,
          },
        },
        insertionStart: 10,
      };

      const errors = v.validate(req);
      expect(errors.length).toEqual(1);
      expect(errors[0].message).toEqual(
        'offset(0) should be >= insertionStart(10).  offset should be the global position.'
      );
    });
  });
});
