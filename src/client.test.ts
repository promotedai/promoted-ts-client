import { copyAndRemoveProperties, log, newPromotedClient, noopFn, NoopPromotedClient, throwOnError } from '.';
import type { Insertion, Request } from './types/delivery';
import { ClientType_PLATFORM_SERVER, TrafficType_PRODUCTION, TrafficType_SHADOW } from './client';
import { PromotedClientArguments } from './client-args';
import { InsertionPageType } from './insertion-page-type';
import { DeliveryRequest } from './delivery-request';
import { MetricsRequest } from './metrics-request';

const fakeUuidGenerator = () => {
  let i = 0;
  return () => {
    const value = 'uuid' + i;
    i++;
    return value;
  };
};

interface Product {
  id: string;
  title: string;
  url: string;
}

const newProduct = (id: string): Product => ({
  id: `product${id}`,
  title: `Product ${id}`,
  url: `www.mymarket.com/p/${id}`,
});

const toInsertions = (products: Product[]): Insertion[] => products.map(toInsertionWithNoExtraFields);

// Response insertions should always have position assigned.
const toResponseInsertions = (products: Product[]): Insertion[] =>
  products.map((product, idx) => {
    return toInsertion(product, { position: idx });
  });

// An interface for setting optional fields.
interface InsertionFields {
  insertionId?: string;
  requestId?: string;
  viewId?: string;
  sessionId?: string;
  position?: number;
}

const toInsertionWithNoExtraFields = (product: Product): Insertion => toInsertion(product);

const toInsertion = (product: Product, extraFields: InsertionFields = {}): Insertion => ({
  ...toInsertionOnlyContentId(product, extraFields),
  properties: {
    struct: {
      product,
    },
  },
});

const toInsertionOnlyContentId = (product: Product, extraFields: InsertionFields = {}): Insertion => ({
  ...extraFields,
  contentId: product.id.toString(),
});

// Creates a new request.
const newBaseRequest = (): Partial<Request> => ({
  userInfo: {
    logUserId: 'logUserId1',
  },
  useCase: 'FEED',
  // TODO - sessionId: .
  // TODO - viewId: .
  properties: {
    struct: {
      query: 'fakequery',
    },
  },
});

// Creates a  new request passed through the LogRequest, for which the client will strip userInfo.
const newLogRequestRequest = (): Partial<Request> => ({
  useCase: 'FEED',
  properties: {
    struct: {
      query: 'fakequery',
    },
  },
});

const newFakePromotedClient = (overrideArgs: Partial<PromotedClientArguments>) => {
  const deliveryClient =
    overrideArgs.deliveryClient === undefined
      ? jest.fn(failFunction('Delivery should not be called in CONTROL'))
      : overrideArgs.deliveryClient;
  const metricsClient =
    overrideArgs.metricsClient === undefined
      ? jest.fn(failFunction('Metrics should not be called in CONTROL'))
      : overrideArgs.metricsClient;

  return newPromotedClient({
    defaultRequestValues: {
      onlyLog: false,
    },
    deliveryClient,
    metricsClient,
    handleError: throwOnError,
    uuid: fakeUuidGenerator(),
    nowMillis: () => 12345678,
    ...overrideArgs,
  });
};

const failFunction = (errorMessage: string) => () => {
  throw errorMessage;
};

describe('factory enabled', () => {
  it('creates a non-enabled client', () => {
    const promotedClient = newFakePromotedClient({
      enabled: false,
      deliveryClient: jest.fn(failFunction('Delivery should not be called')),
      metricsClient: jest.fn(failFunction('Metrics should not be called')),
    });
    expect(promotedClient.enabled).toBeFalsy();
    expect(promotedClient.constructor.name).toEqual('NoopPromotedClient');
  });

  it('creates an enabled client', () => {
    const promotedClient = newFakePromotedClient({
      enabled: true,
      deliveryClient: jest.fn(failFunction('Delivery should not be called')),
      metricsClient: jest.fn(failFunction('Metrics should not be called')),
    });
    expect(promotedClient.enabled).toBeTruthy();
    expect(promotedClient.constructor.name).toEqual('PromotedClientImpl');
  });
});

describe('no-op', () => {
  describe('deliver', () => {
    it('good case', async () => {
      const promotedClient = newFakePromotedClient({
        enabled: false,
        deliveryClient: jest.fn(failFunction('Delivery should not be called in CONTROL')),
        metricsClient: jest.fn(failFunction('Metrics should not be called in CONTROL')),
      });
      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: {
          ...newBaseRequest(),
        },
        fullInsertion: toInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });

      const expectedRespInsertions = toResponseInsertions([newProduct('3'), newProduct('2'), newProduct('1')]);
      expect(response.insertion).toEqual(expectedRespInsertions);
      await response.log();
    });

    it('page size 1', async () => {
      const promotedClient = newFakePromotedClient({
        enabled: false,
        deliveryClient: jest.fn(failFunction('Delivery should not be called in CONTROL')),
        metricsClient: jest.fn(failFunction('Metrics should not be called in CONTROL')),
      });
      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: {
          ...newBaseRequest(),
          paging: {
            size: 1,
          },
        },
        fullInsertion: toInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });

      const expectedRespInsertions = [toInsertion(newProduct('3'), { position: 0 })];

      expect(response.insertion).toEqual(expectedRespInsertions);
      await response.log();
    });
  });

  describe('metrics', () => {
    it('good case', async () => {
      const promotedClient = newFakePromotedClient({
        enabled: false,
        deliveryClient: jest.fn(failFunction('Delivery should not be called')),
        metricsClient: jest.fn(failFunction('Metrics should not be called')),
      });
      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = promotedClient.prepareForLogging({
        request: {
          ...newBaseRequest(),
        },
        fullInsertion: toInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(response.insertion).toEqual(toResponseInsertions([newProduct('3'), newProduct('2'), newProduct('1')]));
      await response.log();
    });

    it('page size 1', async () => {
      const promotedClient = newFakePromotedClient({
        enabled: false,
        deliveryClient: jest.fn(failFunction('Delivery should not be called')),
        metricsClient: jest.fn(failFunction('Metrics should not be called')),
      });
      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = promotedClient.prepareForLogging({
        request: {
          ...newBaseRequest(),
          paging: {
            size: 1,
          },
        },
        fullInsertion: toInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(response.insertion).toEqual(toResponseInsertions([newProduct('3')]));
      await response.log();
    });

    it('non-zero offset', async () => {
      const promotedClient = newFakePromotedClient({
        enabled: false,
        deliveryClient: jest.fn(failFunction('Delivery should not be called')),
        metricsClient: jest.fn(failFunction('Metrics should not be called')),
      });
      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = promotedClient.prepareForLogging({
        request: {
          ...newBaseRequest(),
          paging: {
            size: 1,
            offset: 1,
          },
        },
        fullInsertion: toInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });

      // Paging parameters advance to the second insertion.
      const expectedInsertions = toResponseInsertions([newProduct('2')]);
      expectedInsertions[0].position = 1; // the offset
      expect(response.insertion).toEqual(expectedInsertions);
      await response.log();
    });
  });
});

describe('deliver', () => {
  it('allows you to set unpaged', async () => {
    const deliveryClient = jest.fn(() => {
      return Promise.resolve({});
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));
    let gotError = false;

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
      handleError: () => {
        gotError = true;
      },
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const deliveryReq: DeliveryRequest = {
      request: newBaseRequest(),
      insertionPageType: InsertionPageType.Unpaged,
      fullInsertion: toInsertions(products),
    };

    await promotedClient.deliver(deliveryReq);
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(gotError).toBeFalsy();
  });

  it('errors if you say prepaged', async () => {
    const deliveryClient = jest.fn(() => {
      return Promise.resolve({});
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));
    let gotError = false;

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
      handleError: () => {
        gotError = true;
      },
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const deliveryReq: DeliveryRequest = {
      request: newBaseRequest(),
      insertionPageType: InsertionPageType.PrePaged,
      fullInsertion: toInsertions(products),
    };

    await promotedClient.deliver(deliveryReq);
    expect(deliveryClient.mock.calls.length).toBe(1); // note our precondition checks don't actually throw
    expect(gotError).toBeTruthy();
  });

  it('simple good case', async () => {
    const deliveryClient = jest.fn((request) => {
      expect(request).toEqual({
        ...newBaseRequest(),
        timing: {
          clientLogTimestamp: 12345678,
        },
        clientRequestId: 'uuid0',
        insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
      });
      return Promise.resolve({
        insertion: [
          toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
          toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
          toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
        ],
      });
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = await promotedClient.deliver({
      request: newBaseRequest(),
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
      toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
      toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
    ]);
    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);
  });

  describe('using cohorts', () => {
    it('arm=CONTROL', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        cohortMembership: [
          {
            arm: 'CONTROL',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        insertion: [
          toInsertion(newProduct('3'), {
            insertionId: 'uuid2',
            requestId: 'uuid1',
            position: 0,
          }),
          toInsertion(newProduct('2'), {
            insertionId: 'uuid3',
            requestId: 'uuid1',
            position: 1,
          }),
          toInsertion(newProduct('1'), {
            insertionId: 'uuid4',
            requestId: 'uuid1',
            position: 2,
          }),
        ],
        request: [
          {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            clientRequestId: 'uuid0',
            timing: {
              clientLogTimestamp: 12345678,
            },
          },
        ],
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toInsertions(products),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'CONTROL',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    it('arm=TREATMENT', async () => {
      const deliveryClient: any = jest.fn((request) => {
        expect(request).toEqual({
          ...newBaseRequest(),
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientRequestId: 'uuid0',
          insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        });
        return Promise.resolve({
          insertion: [
            toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
            toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
            toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
          ],
        });
      });
      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        // Request is not logged since it's already logged on the server-side.
      };

      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
      });

      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    // If Delivery fails and we silently handle it, we log like everything.
    it('arm=TREATMENT - Delivery failed', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        insertion: [
          toInsertion(newProduct('3'), { insertionId: 'uuid2', requestId: 'uuid1', position: 0 }),
          toInsertion(newProduct('2'), { insertionId: 'uuid3', requestId: 'uuid1', position: 1 }),
          toInsertion(newProduct('1'), { insertionId: 'uuid4', requestId: 'uuid1', position: 2 }),
        ],
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        request: [
          {
            ...newLogRequestRequest(),
            timing: {
              clientLogTimestamp: 12345678,
            },
            requestId: 'uuid1',
            clientRequestId: 'uuid0',
          },
        ],
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const promotedClient = newFakePromotedClient({
        handleError: () => {
          // silently handle error in deliver.
        },
        deliveryClient,
        metricsClient,
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toInsertions(products),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();

      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });
  });

  describe('toCompact', () => {
    it('toCompactMetricsInsertion arm=CONTROL', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      // Should not have position set due to the custom compact function we're testing with.
      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        cohortMembership: [
          {
            arm: 'CONTROL',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        insertion: [
          toInsertionOnlyContentId(newProduct('3')),
          toInsertionOnlyContentId(newProduct('2')),
          toInsertionOnlyContentId(newProduct('1')),
        ],
        request: [
          {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
          },
        ],
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toInsertions(products),
        toCompactMetricsInsertion: (insertion) => ({
          contentId: insertion.contentId,
        }),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'CONTROL',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    it('toCompactMetricsInsertion arm=CONTROL defaultRequestValues', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      // Should not have position set due to the custom compact function we're testing with.
      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        cohortMembership: [
          {
            arm: 'CONTROL',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        insertion: [
          toInsertionOnlyContentId(newProduct('3')),
          toInsertionOnlyContentId(newProduct('2')),
          toInsertionOnlyContentId(newProduct('1')),
        ],
        request: [
          {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
          },
        ],
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        defaultRequestValues: {
          toCompactMetricsInsertion: (insertion) => ({
            contentId: insertion.contentId,
          }),
        },
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toInsertions(products),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'CONTROL',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    it('toCompactDeliveryInsertions arm=TREATMENT', async () => {
      const deliveryClient: any = jest.fn((request) => {
        expect(request).toEqual({
          ...newBaseRequest(),
          timing: {
            clientLogTimestamp: 12345678,
          },
          insertion: [
            toInsertionOnlyContentId(newProduct('3')),
            toInsertionOnlyContentId(newProduct('2')),
            toInsertionOnlyContentId(newProduct('1')),
          ],
          clientRequestId: 'uuid0',
        });
        return Promise.resolve({
          insertion: [
            toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
            toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
            toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
          ],
        });
      });
      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        // Request is not logged since it's already logged on the server-side.
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
      });

      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        toCompactDeliveryInsertion: (insertion) => ({
          contentId: insertion.contentId,
        }),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);

      // Here is where clients will return their response.
      await response.log();

      expect(response.logRequest).toEqual(expectedLogReq);

      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    it('toCompactDeliveryInsertions arm=TREATMENT defaultRequestValues', async () => {
      const deliveryClient: any = jest.fn((request) => {
        expect(request).toEqual({
          ...newBaseRequest(),
          timing: {
            clientLogTimestamp: 12345678,
          },
          insertion: [
            toInsertionOnlyContentId(newProduct('3')),
            toInsertionOnlyContentId(newProduct('2')),
            toInsertionOnlyContentId(newProduct('1')),
          ],
          clientRequestId: 'uuid0',
        });
        return Promise.resolve({
          insertion: [
            toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
            toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
            toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
          ],
        });
      });
      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        // Request is not logged since it's already logged on the server-side.
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        defaultRequestValues: {
          toCompactDeliveryInsertion: (insertion) => ({
            contentId: insertion.contentId,
          }),
        },
      });

      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });
  });

  it('page size 1', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
    const expectedLogReq = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      cohortMembership: [
        {
          arm: 'CONTROL',
          cohortId: 'HOLD_OUT',
          timing: {
            clientLogTimestamp: 12345678,
          },
          userInfo: {
            logUserId: 'logUserId1',
          },
        },
      ],
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid1',
          paging: {
            size: 1,
          },
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3')];
    const response = await promotedClient.deliver({
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
        },
      },
      fullInsertion: toInsertions(products),
      experiment: {
        cohortId: 'HOLD_OUT',
        arm: 'CONTROL',
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    // SDK-provided position
    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('onlyLog override', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
    const expectedLogReq = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid1',
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = await promotedClient.deliver({
      onlyLog: true,
      request: newBaseRequest(),
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    // SDK-provided positions
    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
      toInsertion(newProduct('2'), {
        insertionId: 'uuid3',
        requestId: 'uuid1',
        position: 1,
      }),
      toInsertion(newProduct('1'), {
        insertionId: 'uuid4',
        requestId: 'uuid1',
        position: 2,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('with optional Request fields', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
    const expectedLogReq = {
      platformId: 1,
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 87654321,
      },
      cohortMembership: [
        {
          platformId: 1,
          arm: 'CONTROL',
          cohortId: 'HOLD_OUT',
          timing: {
            clientLogTimestamp: 87654321,
          },
          userInfo: {
            logUserId: 'logUserId1',
          },
        },
      ],
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          platformId: 1,
          requestId: 'uuid1',
          timing: {
            clientLogTimestamp: 87654321,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = await promotedClient.deliver({
      request: {
        ...newBaseRequest(),
        platformId: 1,
        timing: {
          clientLogTimestamp: 87654321,
        },
      },
      fullInsertion: toInsertions(products),
      experiment: {
        cohortId: 'HOLD_OUT',
        arm: 'CONTROL',
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    // SDK-provided positions
    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
      toInsertion(newProduct('2'), {
        insertionId: 'uuid3',
        requestId: 'uuid1',
        position: 1,
      }),
      toInsertion(newProduct('1'), {
        insertionId: 'uuid4',
        requestId: 'uuid1',
        position: 2,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('response does not have contentId', async () => {
    const deliveryClient = jest.fn((request) => {
      expect(request).toEqual({
        ...newBaseRequest(),
        timing: {
          clientLogTimestamp: 12345678,
        },
        insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        clientRequestId: 'uuid0',
      });
      return Promise.resolve({
        insertion: [
          {
            insertionId: 'uuid1',
          },
          toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
          toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
        ],
      });
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = await promotedClient.deliver({
      request: newBaseRequest(),
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      {
        insertionId: 'uuid1',
      },
      toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
      toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
    ]);
    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);
  });

  describe('timeout error', () => {
    // This test does not fully test timeouts.
    // This test mocks out the timeout wrapper and fails before the Delivery
    // API call.
    it('delivery timeout', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in timeout'));
      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        insertion: [
          toInsertion(newProduct('3'), {
            insertionId: 'uuid2',
            requestId: 'uuid1',
            position: 0,
          }),
          toInsertion(newProduct('2'), {
            insertionId: 'uuid3',
            requestId: 'uuid1',
            position: 1,
          }),
          toInsertion(newProduct('1'), {
            insertionId: 'uuid4',
            requestId: 'uuid1',
            position: 2,
          }),
        ],
        request: [
          {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
          },
        ],
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      let numErrors = 0;
      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        deliveryTimeoutWrapper: () => Promise.reject(new Error('timeout')),
        handleError: (error: Error) => {
          // Skip the first error.
          if (numErrors > 0) {
            throw error;
          }
          numErrors++;
        },
      });

      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    // This test does not fully test timeouts.
    // This test mocks out the timeout wrapper and fails before the Metrics API
    // call.
    it('metrics timeout', async () => {
      const deliveryClient: any = jest.fn((request) => {
        expect(request).toEqual({
          ...newBaseRequest(),
          timing: {
            clientLogTimestamp: 12345678,
          },
          insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          clientRequestId: 'uuid0',
        });
        return Promise.resolve({
          insertion: [
            toInsertion(newProduct('1'), { insertionId: 'uuid2' }),
            toInsertion(newProduct('2'), { insertionId: 'uuid3' }),
            toInsertion(newProduct('3'), { insertionId: 'uuid4' }),
          ],
        });
      });

      const expectedLogReq = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        // Request is not logged since it's already logged on the server-side.
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      let numErrors = 0;
      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        metricsCallWrapper: (promiseFn) => {
          promiseFn();
          return Promise.reject(new Error('timeout'));
        },
        handleError: (error: Error) => {
          // Skip the first error.
          if (numErrors > 0) {
            throw error;
          }
          numErrors++;
        },
      });

      const deliveryReq: DeliveryRequest = {
        request: newBaseRequest(),
        fullInsertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      };
      const response = await promotedClient.deliver(deliveryReq);
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('1'), { insertionId: 'uuid2' }),
        toInsertion(newProduct('2'), { insertionId: 'uuid3' }),
        toInsertion(newProduct('3'), { insertionId: 'uuid4' }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    // TODO -
  });

  describe('check input fields should be undefined', () => {
    it('Request.requestId', async () => {
      const promotedClient = newFakePromotedClient({});
      await expect(
        promotedClient.deliver({
          request: {
            ...newBaseRequest(),
            requestId: 'uuid0',
          },
          fullInsertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Request.requestId should not be set'));
    });

    it('Request.insertion', async () => {
      const promotedClient = newFakePromotedClient({});
      await expect(
        promotedClient.deliver({
          request: {
            ...newBaseRequest(),
            insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          },
          fullInsertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Do not set Request.insertion.  Set fullInsertion.'));
    });

    it('Insertion.requestId', async () => {
      const promotedClient = newFakePromotedClient({});
      await expect(
        promotedClient.deliver({
          request: newBaseRequest(),
          fullInsertion: [
            {
              ...toInsertion(newProduct('3')),
              requestId: 'uuid0',
            },
            toInsertion(newProduct('2')),
            toInsertion(newProduct('1')),
          ],
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Insertion.requestId should not be set'));
    });

    it('Insertion.insertionId', async () => {
      const promotedClient = newFakePromotedClient({});
      await expect(
        promotedClient.deliver({
          request: newBaseRequest(),
          fullInsertion: [
            {
              ...toInsertion(newProduct('3')),
              insertionId: 'uuid0',
            },
            toInsertion(newProduct('2')),
            toInsertion(newProduct('1')),
          ],
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Insertion.insertionId should not be set'));
    });

    it('Insertion.contentId', async () => {
      const promotedClient = newFakePromotedClient({});
      await expect(
        promotedClient.deliver({
          request: newBaseRequest(),
          fullInsertion: [{}, toInsertion(newProduct('2')), toInsertion(newProduct('1'))],
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Insertion.contentId should be set'));
    });
  });
});

describe('client construction', () => {
  it('does not allow too small shadow traffic percent', async () => {
    expect(() => {
      newFakePromotedClient({
        shadowTrafficDeliveryPercent: -0.1,
      });
    }).toThrow('shadowTrafficDeliveryPercent must be between 0 and 1');
  });

  it('does not allow too large shadow traffic percent', async () => {
    expect(() => {
      newFakePromotedClient({
        shadowTrafficDeliveryPercent: 1.1,
      });
    }).toThrow('shadowTrafficDeliveryPercent must be between 0 and 1');
  });
});

describe('metrics', () => {
  it('good case', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    // Log request doesn't set position.
    const expectedLogReq = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid1',
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = promotedClient.prepareForLogging({
      request: newBaseRequest(),
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
      toInsertion(newProduct('2'), {
        insertionId: 'uuid3',
        requestId: 'uuid1',
        position: 1,
      }),
      toInsertion(newProduct('1'), {
        insertionId: 'uuid4',
        requestId: 'uuid1',
        position: 2,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('page size 1', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    const expectedLogReq = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid1',
          paging: {
            size: 1,
          },
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
        },
      },
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('offsets position starting at the first insertion for prepaged insertions', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    // Logging only doesn't set position.
    const expectedLogReq = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 100,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid1',
          paging: {
            size: 1,
            offset: 100,
          },
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const metricsRequest: MetricsRequest = {
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
          offset: 100,
        },
      },
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.PrePaged,
    };

    const response = promotedClient.prepareForLogging(metricsRequest);
    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 100, // the offset
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);
  });

  it('non-zero page offset', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in logging test'));
    // Paging parameters advance to the second insertion.
    const expectedLogReq = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      insertion: [
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 1, // the offset
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid1',
          paging: {
            size: 1,
            offset: 1,
          },
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
          offset: 1,
        },
      },
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('2'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 1, // the offset
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('extra fields', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    const expectedLogReq = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          sessionId: 'uuid10',
          viewId: 'uuid11',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          sessionId: 'uuid10',
          viewId: 'uuid11',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          sessionId: 'uuid10',
          viewId: 'uuid11',
          position: 2,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid1',
          sessionId: 'uuid10',
          viewId: 'uuid11',
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        sessionId: 'uuid10',
        viewId: 'uuid11',
      },
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        sessionId: 'uuid10',
        viewId: 'uuid11',
        position: 0,
      }),
      toInsertion(newProduct('2'), {
        insertionId: 'uuid3',
        requestId: 'uuid1',
        sessionId: 'uuid10',
        viewId: 'uuid11',
        position: 1,
      }),
      toInsertion(newProduct('1'), {
        insertionId: 'uuid4',
        requestId: 'uuid1',
        sessionId: 'uuid10',
        viewId: 'uuid11',
        position: 2,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  // TODO - add test where IDs are passed in.
  describe('check input fields should be undefined', () => {
    it('Request.requestId', async () => {
      const promotedClient = newFakePromotedClient({});
      expect(() =>
        promotedClient.prepareForLogging({
          request: {
            ...newBaseRequest(),
            requestId: 'uuid0',
          },
          fullInsertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).toThrow(new Error('Request.requestId should not be set'));
    });
  });
});

describe('shadow requests', () => {
  async function runShadowRequestSamplingTest(
    samplingReturn: boolean,
    shouldCallDelivery: boolean,
    shadowTrafficDeliveryPercent: number
  ) {
    let deliveryClient: any = jest.fn(failFunction('Delivery should not be called when shadow is not selected'));
    if (shouldCallDelivery) {
      const expectedDeliveryReq = {
        ...newBaseRequest(),
        timing: {
          clientLogTimestamp: 12345678,
        },
        insertion: toInsertions([newProduct('3')]),
        clientInfo: {
          trafficType: TrafficType_SHADOW,
          clientType: ClientType_PLATFORM_SERVER,
        },
        clientRequestId: 'uuid0',
      };
      deliveryClient = jest.fn((request) => {
        expect(request).toEqual(expectedDeliveryReq);
        return Promise.resolve({});
      });
    }

    const expectedLogReq = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid1',
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientInfo: {
            trafficType: TrafficType_PRODUCTION,
            clientType: ClientType_PLATFORM_SERVER,
          },
          clientRequestId: 'uuid0',
        },
      ],
    };
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual(expectedLogReq);
    });

    const sampler = {
      sampleRandom: jest.fn((threshold) => {
        expect(threshold).toEqual(0.5);
        return samplingReturn;
      }),
    };

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
      shadowTrafficDeliveryPercent: shadowTrafficDeliveryPercent,
      sampler: sampler,
    });

    const products = [newProduct('3')];
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        clientInfo: {
          trafficType: TrafficType_PRODUCTION,
          clientType: ClientType_PLATFORM_SERVER,
        },
      },
      fullInsertion: toInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    const deliveryCallCount = shouldCallDelivery ? 1 : 0;
    expect(deliveryClient.mock.calls.length).toBe(deliveryCallCount); // here lies the shadow request
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(deliveryCallCount);
    expect(metricsClient.mock.calls.length).toBe(1);
  }

  function runPagingTypeErrorTest(insertionPagingType: InsertionPageType) {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in the error case'));
    const metricsClient: any = jest.fn(failFunction('Metrics should not be called in the error case'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
      shadowTrafficDeliveryPercent: 0.5,
      handleError: throwOnError,
    });

    const products = [newProduct('3')];
    promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        clientInfo: {
          trafficType: TrafficType_PRODUCTION,
          clientType: ClientType_PLATFORM_SERVER,
        },
      },
      fullInsertion: toInsertions(products),
      insertionPageType: insertionPagingType,
    });
  }

  it('makes a shadow request', async () => {
    await runShadowRequestSamplingTest(true, true, 0.5);
  });

  it('does not make a shadow request - not sampled in', async () => {
    await runShadowRequestSamplingTest(false, false, 0.5);
  });

  it('does not make a shadow request - sampling not turned on', async () => {
    await runShadowRequestSamplingTest(true, false, 0);
  });

  it('throws an error with the wrong paging type', async () => {
    expect(() => runPagingTypeErrorTest(InsertionPageType.PrePaged)).toThrow(
      'Insertions must be unpaged when shadow traffic is on'
    );
  });
});

it('copyAndRemoveProperties', async () => {
  expect(
    copyAndRemoveProperties({
      insertionId: '123',
      properties: {
        struct: {
          fake: 'value',
        },
      },
    })
  ).toEqual({
    insertionId: '123',
  });
});

describe('log helper method', () => {
  it('simple', async () => {
    // DanHill: I don't know if there is a good way to test this helper.
    log({
      log: () => Promise.resolve(undefined),
      insertion: [
        toInsertion(newProduct('3'), { insertionId: 'uuid1' }),
        toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toInsertion(newProduct('1'), { insertionId: 'uuid3' }),
      ],
    });
  });

  it('noopFn helper', async () => {
    // To increase code coverage.
    noopFn();
  });
});

// Tests for the no-op client to ensure code coverage.
describe('noop promoted client', () => {
  it('creates test responses', async () => {
    const client = new NoopPromotedClient();
    const resp = client.deliver({
      request: {
        ...newBaseRequest(),
      },
      fullInsertion: [],
      insertionPageType: InsertionPageType.Unpaged,
    });
    const logReq = (await resp).logRequest;
    expect(logReq).toBeUndefined();

    const resp2 = client.prepareForLogging({
      request: {
        ...newBaseRequest(),
      },
      fullInsertion: [],
      insertionPageType: InsertionPageType.Unpaged,
    });
    const logReq2 = (await resp2).logRequest;
    expect(logReq2).toBeUndefined();
  });
});
