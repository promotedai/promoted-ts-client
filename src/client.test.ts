import { copyAndRemoveProperties, DefaultLogRequest, log, newPromotedClient, noopFn, throwOnError } from '.';
import type { PromotedClientArguments } from '.';
import type { Insertion, Request } from './types/delivery';
import { NoopPromotedClient } from './client';

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
      });
      expect(response.insertion).toEqual(toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]));
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
      });
      expect(response.insertion).toEqual(toInsertions([newProduct('3')]));
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
      });
      expect(response.insertion).toEqual(toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]));
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
      });
      expect(response.insertion).toEqual(toInsertions([newProduct('3')]));
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
      });
      expect(response.insertion).toEqual(toInsertions([newProduct('3')]));
      await response.log();
    });
  });
});

describe('deliver', () => {
  it('simple good case', async () => {
    const deliveryClient = jest.fn((request) => {
      expect(request).toEqual({
        ...newBaseRequest(),
        timing: {
          clientLogTimestamp: 12345678,
        },
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
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    const logRequest = response.createLogRequest();
    expect(logRequest).toBeDefined();

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
            insertionId: 'uuid1',
            requestId: 'uuid0',
            position: 0,
          }),
          toInsertion(newProduct('2'), {
            insertionId: 'uuid2',
            requestId: 'uuid0',
            position: 1,
          }),
          toInsertion(newProduct('1'), {
            insertionId: 'uuid3',
            requestId: 'uuid0',
            position: 2,
          }),
        ],
        request: [
          {
            ...newLogRequestRequest(),
            requestId: 'uuid0',
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
      });
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid1',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
        }),
      ]);

      expect(response.createLogRequest()).toEqual(expectedLogReq);

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
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);

      expect(response.createLogRequest()).toEqual(expectedLogReq);

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
          toInsertion(newProduct('3'), { insertionId: 'uuid1', requestId: 'uuid0', position: 0 }),
          toInsertion(newProduct('2'), { insertionId: 'uuid2', requestId: 'uuid0', position: 1 }),
          toInsertion(newProduct('1'), { insertionId: 'uuid3', requestId: 'uuid0', position: 2 }),
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
            requestId: 'uuid0',
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
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid1',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
        }),
      ]);

      expect(response.createLogRequest()).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();

      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });
  });

  describe('toCompact', () => {
    it('toCompactMetricsInsertion arm=CONTROL', async () => {
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
          toInsertionOnlyContentId(newProduct('3'), {
            position: 0,
          }),
          toInsertionOnlyContentId(newProduct('2'), {
            position: 1,
          }),
          toInsertionOnlyContentId(newProduct('1'), {
            position: 2,
          }),
        ],
        request: [
          {
            ...newLogRequestRequest(),
            requestId: 'uuid0',
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
        toCompactMetricsInsertion: (insertion) => ({
          contentId: insertion.contentId,
        }),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'CONTROL',
        },
      });
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid1',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
        }),
      ]);

      expect(response.createLogRequest()).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    it('toCompactMetricsInsertion arm=CONTROL defaultRequestValues', async () => {
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
          toInsertionOnlyContentId(newProduct('3'), {
            position: 0,
          }),
          toInsertionOnlyContentId(newProduct('2'), {
            position: 1,
          }),
          toInsertionOnlyContentId(newProduct('1'), {
            position: 2,
          }),
        ],
        request: [
          {
            ...newLogRequestRequest(),
            requestId: 'uuid0',
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
      });
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid1',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
        }),
      ]);

      expect(response.createLogRequest()).toEqual(expectedLogReq);

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

      expect(response.createLogRequest()).toEqual(expectedLogReq);

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
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);

      expect(response.createLogRequest()).toEqual(expectedLogReq);

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
          insertionId: 'uuid1',
          requestId: 'uuid0',
          position: 0,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid0',
          paging: {
            size: 1,
          },
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
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid1',
        requestId: 'uuid0',
      }),
    ]);

    expect(response.createLogRequest()).toEqual(expectedLogReq);

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
          insertionId: 'uuid1',
          requestId: 'uuid0',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
          position: 2,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid0',
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
      onlyLog: true,
      request: newBaseRequest(),
      fullInsertion: toInsertions(products),
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid1',
        requestId: 'uuid0',
      }),
      toInsertion(newProduct('2'), {
        insertionId: 'uuid2',
        requestId: 'uuid0',
      }),
      toInsertion(newProduct('1'), {
        insertionId: 'uuid3',
        requestId: 'uuid0',
      }),
    ]);

    expect(response.createLogRequest()).toEqual(expectedLogReq);

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
          insertionId: 'uuid1',
          requestId: 'uuid0',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
          position: 2,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          platformId: 1,
          requestId: 'uuid0',
          timing: {
            clientLogTimestamp: 87654321,
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
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid1',
        requestId: 'uuid0',
      }),
      toInsertion(newProduct('2'), {
        insertionId: 'uuid2',
        requestId: 'uuid0',
      }),
      toInsertion(newProduct('1'), {
        insertionId: 'uuid3',
        requestId: 'uuid0',
      }),
    ]);

    expect(response.createLogRequest()).toEqual(expectedLogReq);

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
            insertionId: 'uuid1',
            requestId: 'uuid0',
            position: 0,
          }),
          toInsertion(newProduct('2'), {
            insertionId: 'uuid2',
            requestId: 'uuid0',
            position: 1,
          }),
          toInsertion(newProduct('1'), {
            insertionId: 'uuid3',
            requestId: 'uuid0',
            position: 2,
          }),
        ],
        request: [
          {
            ...newLogRequestRequest(),
            requestId: 'uuid0',
            timing: {
              clientLogTimestamp: 12345678,
            },
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
        handleError: (error) => {
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
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('3'), {
          insertionId: 'uuid1',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
        }),
      ]);

      expect(response.createLogRequest()).toEqual(expectedLogReq);

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

      let numErrors = 0;
      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        metricsTimeoutWrapper: () => Promise.reject(new Error('timeout')),
        handleError: (error) => {
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
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);

      expect(response.createLogRequest()).toEqual(expectedLogReq);

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });
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
        })
      ).rejects.toEqual(new Error('Insertion.insertionId should not be set'));
    });

    it('Insertion.contentId', async () => {
      const promotedClient = newFakePromotedClient({});
      await expect(
        promotedClient.deliver({
          request: newBaseRequest(),
          fullInsertion: [{}, toInsertion(newProduct('2')), toInsertion(newProduct('1'))],
        })
      ).rejects.toEqual(new Error('Insertion.contentId should be set'));
    });
  });
});

describe('metrics', () => {
  it('good case', async () => {
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
          insertionId: 'uuid1',
          requestId: 'uuid0',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
          position: 2,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid0',
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
    const response = promotedClient.prepareForLogging({
      request: newBaseRequest(),
      fullInsertion: toInsertions(products),
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid1',
        requestId: 'uuid0',
      }),
      toInsertion(newProduct('2'), {
        insertionId: 'uuid2',
        requestId: 'uuid0',
      }),
      toInsertion(newProduct('1'), {
        insertionId: 'uuid3',
        requestId: 'uuid0',
      }),
    ]);

    expect(response.createLogRequest()).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
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
      insertion: [
        toInsertion(newProduct('3'), {
          insertionId: 'uuid1',
          requestId: 'uuid0',
          position: 0,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid0',
          paging: {
            size: 1,
          },
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
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
        },
      },
      fullInsertion: toInsertions(products),
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid1',
        requestId: 'uuid0',
      }),
    ]);

    expect(response.createLogRequest()).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('non-zero page offset', async () => {
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
          insertionId: 'uuid1',
          requestId: 'uuid0',
          position: 100,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid0',
          paging: {
            size: 1,
            offset: 100,
          },
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
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
          offset: 100,
        },
      },
      fullInsertion: toInsertions(products),
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid1',
        requestId: 'uuid0',
      }),
    ]);

    expect(response.createLogRequest()).toEqual(expectedLogReq);

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('extra fields', async () => {
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
          insertionId: 'uuid1',
          requestId: 'uuid0',
          sessionId: 'uuid10',
          viewId: 'uuid11',
          position: 0,
        }),
        toInsertion(newProduct('2'), {
          insertionId: 'uuid2',
          requestId: 'uuid0',
          sessionId: 'uuid10',
          viewId: 'uuid11',
          position: 1,
        }),
        toInsertion(newProduct('1'), {
          insertionId: 'uuid3',
          requestId: 'uuid0',
          sessionId: 'uuid10',
          viewId: 'uuid11',
          position: 2,
        }),
      ],
      request: [
        {
          ...newLogRequestRequest(),
          requestId: 'uuid0',
          sessionId: 'uuid10',
          viewId: 'uuid11',
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
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        sessionId: 'uuid10',
        viewId: 'uuid11',
      },
      fullInsertion: toInsertions(products),
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertion(newProduct('3'), {
        insertionId: 'uuid1',
        requestId: 'uuid0',
        sessionId: 'uuid10',
        viewId: 'uuid11',
      }),
      toInsertion(newProduct('2'), {
        insertionId: 'uuid2',
        requestId: 'uuid0',
        sessionId: 'uuid10',
        viewId: 'uuid11',
      }),
      toInsertion(newProduct('1'), {
        insertionId: 'uuid3',
        requestId: 'uuid0',
        sessionId: 'uuid10',
        viewId: 'uuid11',
      }),
    ]);

    expect(response.createLogRequest()).toEqual(expectedLogReq);

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
        })
      ).toThrow(new Error('Request.requestId should not be set'));
    });
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
      createLogRequest: () => new DefaultLogRequest(),
    });
  });

  it('noopFn helper', async () => {
    // To increase code coverage.
    noopFn();
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
      });
      const logReq = (await resp).createLogRequest();
      expect(logReq).not.toBeNull();

      const resp2 = client.prepareForLogging({
        request: {
          ...newBaseRequest(),
        },
        fullInsertion: [],
      });
      const logReq2 = (await resp2).createLogRequest();
      expect(logReq2).not.toBeNull();
    });
  });
});
