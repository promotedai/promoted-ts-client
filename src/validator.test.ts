import { validateRequest, validateResponse } from './validator';
import { DeliveryRequest } from './delivery-request';

describe('validator', () => {
  it('forces request id to be unset on request', () => {
    const req: DeliveryRequest = {
      request: { requestId: 'aaa', userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Request.requestId should not be set');
  });

  it('forces request id to be unset on insertion', () => {
    const req: DeliveryRequest = {
      request: { insertion: [{ requestId: 'a', contentId: 'zzz' }], userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.requestId should not be set');
  });

  it('forces insertion id to be unset on insertion', () => {
    const req: DeliveryRequest = {
      request: { insertion: [{ insertionId: 'a', contentId: 'zzz' }], userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.insertionId should not be set');
  });

  it('forces content id to be set on insertion', () => {
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: '' }], userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Insertion.contentId should be set');
  });

  it('accepts a valid insertion on a request', () => {
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(0);
  });

  it('forces experiment platform id to not be set', () => {
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
      experiment: { platformId: 9 },
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.platformId should not be set');
  });

  it('forces experiment user info to not be set', () => {
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
      experiment: { userInfo: { userId: 'aaa' } },
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.userInfo should not be set');
  });

  it('forces experiment timing to not be set', () => {
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
      experiment: { timing: { clientLogTimestamp: 333 } },
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Experiment.timing should not be set');
  });

  it('allows a valid experiment', () => {
    const req: DeliveryRequest = {
      request: { insertion: [{ contentId: 'aaa' }], userInfo: { anonUserId: 'aaa' } },
      retrievalInsertionOffset: 0,
      experiment: { arm: 'TREATMENT', cohortId: 'aaa' },
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(0);
  });

  it('forces user info to be set on request', () => {
    const req: DeliveryRequest = {
      request: {},
      retrievalInsertionOffset: 0,
    };

    const errors = validateRequest(req);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('Request.userInfo should be set');
  });

  describe('paging', () => {
    it('success with offset >= retrievalInsertionOffset', () => {
      const req: DeliveryRequest = {
        request: {
          userInfo: { anonUserId: 'a' },
          paging: {
            offset: 0,
            size: 100,
          },
        },
        retrievalInsertionOffset: 0,
      };

      const errors = validateRequest(req);
      expect(errors.length).toEqual(0);
    });

    it('errors with offset < retrievalInsertionOffset', () => {
      const req: DeliveryRequest = {
        request: {
          userInfo: { anonUserId: 'a' },
          paging: {
            offset: 0,
            size: 100,
          },
        },
        retrievalInsertionOffset: 10,
      };

      const errors = validateRequest(req);
      expect(errors.length).toEqual(1);
      expect(errors[0].message).toEqual(
        'offset(0) should be >= retrievalInsertionOffset(10).  offset should be the global position.',
      );
    });
  });
});

describe('validateResponse', () => {
  it('valid w/o insertion', () => {
    const response = validateResponse({
      requestId: 'uuid1',
    });
    expect(response).toEqual({
      requestId: 'uuid1',
      insertion: [],
      pagingInfo: {},
    });
  });

  it('valid w/ optional fields set', () => {
    const response = validateResponse({
      requestId: 'uuid1',
      insertion: [{ contentId: '1' }],
      pagingInfo: { cursor: 'cursor1' },
    });
    expect(response).toEqual({
      requestId: 'uuid1',
      insertion: [{ contentId: '1' }],
      pagingInfo: { cursor: 'cursor1' },
    });
  });

  it('valid as json', () => {
    const responseInput = {
      requestId: 'uuid1',
      insertion: [{ contentId: '1' }],
      pagingInfo: { cursor: 'cursor1' },
    };
    const response = validateResponse(JSON.stringify(responseInput));
    expect(response).toEqual({
      requestId: 'uuid1',
      insertion: [{ contentId: '1' }],
      pagingInfo: { cursor: 'cursor1' },
    });
  });

  it('empty', () => {
    expect(() => validateResponse({})).toThrow('Invalid Delivery Response.  Expected requestId.');
  });

  it('error json parsing', () => {
    expect(() => validateResponse('not json')).toThrow(`Invalid Delivery Response.  Not valid JSON.`);
  });

  it('error', () => {
    expect(() =>
      validateResponse({
        error: 'some error',
      }),
    ).toThrow(`Invalid Delivery Response.  'error' was encountered.`);
  });

  it('error insertion not an array', () => {
    expect(() =>
      validateResponse({
        requestId: 'uuid1',
        insertion: 'somestring',
      }),
    ).toThrow('Invalid Delivery Response.  Expected insertions as Array.');
  });
});
