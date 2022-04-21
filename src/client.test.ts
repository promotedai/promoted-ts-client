import { log, newPromotedClient, noopFn, NoopPromotedClient, throwOnError } from '.';
import type { Insertion, Request } from './types/delivery';
import { ClientType_PLATFORM_SERVER, TrafficType_PRODUCTION, TrafficType_SHADOW, SERVER_VERSION } from './client';
import { PromotedClientArguments } from './client-args';
import { InsertionPageType } from './insertion-page-type';
import { DeliveryRequest } from './delivery-request';
import { ExecutionServer } from './execution-server';
import { LogRequest } from './types/event';
import { ClientInfo, Device } from './types/common';

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
  // We'll use this as a dynamic value that should passed through on Request Insertions.
  reviews: number;
}

// Response insertions should always have position assigned.
const toResponseInsertion = (contentId: string, insertionId: string, position: number): Insertion => ({
  contentId,
  insertionId,
  position,
});

const toRequestInsertions = (products: Product[]): Insertion[] => products.map(toRequestInsertion);

const toRequestInsertion = (product: Product): Insertion => ({
  contentId: product.id,
  properties: {
    struct: {
      reviews: product.reviews,
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

// ClientInfo with fields that are SDK-managed for production/server traffic.
const DEFAULT_SDK_CLIENT_INFO: ClientInfo = {
  trafficType: TrafficType_PRODUCTION,
  clientType: ClientType_PLATFORM_SERVER,
};

const failFunction = (errorMessage: string) => () => {
  throw errorMessage;
};

const TEST_DEVICE: Device = {
  browser: {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
  },
  ipAddress: '127.0.0.1',
};

const newProduct = (id: string): Product => ({
  id: `product${id}`,
  reviews: 10,
});

// Common test data.

const products3 = (): Product[] => [newProduct('3'), newProduct('2'), newProduct('1')];

// Delivery code path has one less uuid call.
const expectedResponseInsertionsForDelivery = (): Insertion[] => [
  toResponseInsertion('product3', 'uuid1', 0),
  toResponseInsertion('product2', 'uuid2', 1),
  toResponseInsertion('product1', 'uuid3', 2),
];

// Metrics code path has an extra uuid call for requestId.
const expectedResponseInsertionsForMetrics = (): Insertion[] => [
  toResponseInsertion('product3', 'uuid2', 0),
  toResponseInsertion('product2', 'uuid3', 1),
  toResponseInsertion('product1', 'uuid4', 2),
];

// Creates a new request.
const newBaseRequest = (): Partial<Request> => ({
  device: TEST_DEVICE,
  useCase: 'FEED',
  // TODO - sessionId: .
  // TODO - viewId: .
  properties: {
    struct: {
      query: 'fakequery',
    },
  },
});

const request = (): Request => ({
  ...newBaseRequest(),
  userInfo: {
    logUserId: 'logUserId1',
  },
  insertion: toRequestInsertions(products3()),
});

const expectedRequestWithoutCommonFields = (): Request => ({
  ...newBaseRequest(),
  clientRequestId: 'uuid0',
  insertion: toRequestInsertions(products3()),
});

const expectedRequest = (): Request => ({
  ...expectedRequestWithoutCommonFields(),
  userInfo: {
    logUserId: 'logUserId1',
  },
  timing: {
    clientLogTimestamp: 12345678,
  },
  clientInfo: DEFAULT_SDK_CLIENT_INFO,
});

const expectedBaseLogRequest = (): Partial<LogRequest> => ({
  userInfo: {
    logUserId: 'logUserId1',
  },
  timing: {
    clientLogTimestamp: 12345678,
  },
  clientInfo: DEFAULT_SDK_CLIENT_INFO,
});

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
      const response = await promotedClient.deliver({
        request: {
          ...expectedRequest(),
          insertion: toRequestInsertions(products3()),
        },
        insertionPageType: InsertionPageType.Unpaged,
      });

      const expectedRespInsertions = [
        { contentId: 'product3', position: 0 },
        { contentId: 'product2', position: 1 },
        { contentId: 'product1', position: 2 },
      ];
      expect(response.responseInsertions).toEqual(expectedRespInsertions);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toBeUndefined();
      await response.log();
    });

    it('no request insertions', async () => {
      const promotedClient = newFakePromotedClient({
        enabled: false,
        deliveryClient: jest.fn(failFunction('Delivery should not be called in CONTROL')),
        metricsClient: jest.fn(failFunction('Metrics should not be called in CONTROL')),
      });
      const response = await promotedClient.deliver({
        request: {
          ...request(),
          insertion: [],
        },
        insertionPageType: InsertionPageType.Unpaged,
      });

      expect(response.responseInsertions).toEqual([]);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toBeUndefined();
      await response.log();
    });

    it('page size 1', async () => {
      const promotedClient = newFakePromotedClient({
        enabled: false,
        deliveryClient: jest.fn(failFunction('Delivery should not be called in CONTROL')),
        metricsClient: jest.fn(failFunction('Metrics should not be called in CONTROL')),
      });
      const response = await promotedClient.deliver({
        request: {
          ...request(),
          insertion: toRequestInsertions(products3()),
          paging: {
            size: 1,
          },
        },
        insertionPageType: InsertionPageType.Unpaged,
      });

      const expectedRespInsertions = [{ contentId: 'product3', position: 0 }];
      expect(response.responseInsertions).toEqual(expectedRespInsertions);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toBeUndefined();
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

    await promotedClient.deliver({
      request: {
        ...request(),
        insertion: toRequestInsertions(products3()),
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
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

    const deliveryReq: DeliveryRequest = {
      request: {
        ...request(),
        insertion: toRequestInsertions(products3()),
      },
      insertionPageType: InsertionPageType.PrePaged,
    };

    await promotedClient.deliver(deliveryReq);
    expect(deliveryClient.mock.calls.length).toBe(1); // note our precondition checks don't actually throw
    expect(gotError).toBeTruthy();
  });

  it('simple good case', async () => {
    const deliveryClient = jest.fn((request) => {
      expect(request).toEqual(expectedRequest());
      return Promise.resolve({
        insertion: expectedResponseInsertionsForDelivery(),
      });
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const response = await promotedClient.deliver({
      request: request(),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual(expectedResponseInsertionsForDelivery());
    expect(response.executionServer).toEqual(ExecutionServer.API);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);
  });

  it('simple has more than max request insertions', async () => {
    const responseInsertions = [
      toResponseInsertion('product3', 'uuid1', 0),
      toResponseInsertion('product2', 'uuid2', 1),
    ];
    const deliveryClient = jest.fn((request) => {
      expect(request).toEqual({
        ...expectedRequest(),
        insertion: toRequestInsertions([newProduct('3'), newProduct('2')]),
      });
      return Promise.resolve({
        insertion: responseInsertions,
      });
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
      maxRequestInsertions: 2,
    });

    const response = await promotedClient.deliver({
      request: request(),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual(responseInsertions);
    expect(response.executionServer).toEqual(ExecutionServer.API);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);
  });

  it('no request insertions', async () => {
    const deliveryClient = jest.fn((request) => {
      expect(request).toEqual({
        ...expectedRequest(),
        insertion: [],
      });
      return Promise.resolve({
        insertion: [],
      });
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const response = await promotedClient.deliver({
      request: {
        ...request(),
        insertion: [],
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual([]);

    expect(response.executionServer).toEqual(ExecutionServer.API);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);
  });

  describe('using cohorts', () => {
    it('arm=CONTROL', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      const expectedLogReq: LogRequest = {
        ...expectedBaseLogRequest(),
        cohortMembership: [
          {
            arm: 'CONTROL',
            cohortId: 'HOLD_OUT',
          },
        ],
        deliveryLog: [
          {
            request: {
              ...expectedRequestWithoutCommonFields(),
              requestId: 'uuid1',
              clientRequestId: 'uuid0',
              insertion: toRequestInsertions(products3()),
              device: TEST_DEVICE,
            },
            response: {
              insertion: expectedResponseInsertionsForMetrics(),
            },
            execution: {
              executionServer: 2,
              serverVersion: SERVER_VERSION,
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

      const response = await promotedClient.deliver({
        request: {
          ...request(),
          insertion: toRequestInsertions(products3()),
        },
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'CONTROL',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    it('arm=CONTROL sends shadow traffic', async () => {
      // Delivery gets called as shadow traffic in CONTROL.
      const deliveryClient: any = jest.fn((request) => {
        expect(request).toEqual({
          ...expectedRequest(),
          clientInfo: {
            trafficType: TrafficType_SHADOW, // !!!
            clientType: ClientType_PLATFORM_SERVER,
          },
          clientRequestId: 'uuid0',
          insertion: toRequestInsertions(products3()),
        });
        return Promise.resolve({
          // This is ignored since it's shadow traffic.
          insertion: [
            toResponseInsertion('product1', 'uuid4', 0),
            toResponseInsertion('product2', 'uuid5', 1),
            toResponseInsertion('product3', 'uuid6', 2),
          ],
        });
      });
      const expectedLogReq: LogRequest = {
        ...expectedBaseLogRequest(),
        cohortMembership: [
          {
            arm: 'CONTROL',
            cohortId: 'HOLD_OUT',
          },
        ],
        deliveryLog: [
          {
            request: {
              ...expectedRequestWithoutCommonFields(),
              requestId: 'uuid1',
              clientRequestId: 'uuid0',
              insertion: toRequestInsertions(products3()),
              device: TEST_DEVICE,
            },
            response: {
              insertion: expectedResponseInsertionsForMetrics(),
            },
            execution: {
              executionServer: 2,
              serverVersion: SERVER_VERSION,
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
        shadowTrafficDeliveryRate: 1.0,
      });

      const response = await promotedClient.deliver({
        request: request(),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'CONTROL',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    it('arm=TREATMENT', async () => {
      const deliveryClient: any = jest.fn((request) => {
        expect(request).toEqual({
          ...expectedRequest(),
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientInfo: DEFAULT_SDK_CLIENT_INFO,
          clientRequestId: 'uuid0',
          insertion: toRequestInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        });
        return Promise.resolve({
          insertion: expectedResponseInsertionsForDelivery(),
        });
      });
      const expectedLogReq: LogRequest = {
        ...expectedBaseLogRequest(),
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
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
        request: request(),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.responseInsertions).toEqual(expectedResponseInsertionsForDelivery());
      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.API);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    // If Delivery fails and we silently handle it, we log like everything.
    it('arm=TREATMENT - Delivery failed', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      const expectedLogReq: LogRequest = {
        ...expectedBaseLogRequest(),
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
          },
        ],
        deliveryLog: [
          {
            request: {
              ...expectedRequestWithoutCommonFields(),
              requestId: 'uuid1',
              clientRequestId: 'uuid0',
              insertion: toRequestInsertions(products3()),
              device: TEST_DEVICE,
            },
            response: {
              insertion: expectedResponseInsertionsForMetrics(),
            },
            execution: {
              executionServer: 2,
              serverVersion: SERVER_VERSION,
            },
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

      const response = await promotedClient.deliver({
        request: request(),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();

      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });
  });

  it('page size 1', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
    const products = [newProduct('3')];
    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      cohortMembership: [
        {
          arm: 'CONTROL',
          cohortId: 'HOLD_OUT',
        },
      ],
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            paging: {
              size: 1,
            },
            clientRequestId: 'uuid0',
            insertion: toRequestInsertions(products),
            device: TEST_DEVICE,
          },
          response: {
            insertion: [toResponseInsertion('product3', 'uuid2', 0)],
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      request: {
        ...request(),
        insertion: toRequestInsertions(products),
        paging: {
          size: 1,
        },
      },
      experiment: {
        cohortId: 'HOLD_OUT',
        arm: 'CONTROL',
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    // SDK-provided position
    expect(response.responseInsertions).toEqual([toResponseInsertion('product3', 'uuid2', 0)]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(ExecutionServer.SDK);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('onlyLog override', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in onlyLog'));
    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            clientRequestId: 'uuid0',
            insertion: toRequestInsertions(products3()),
            device: TEST_DEVICE,
          },
          response: {
            insertion: expectedResponseInsertionsForMetrics(),
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      onlyLog: true,
      request: {
        ...request(),
        insertion: toRequestInsertions(products3()),
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    // SDK-provided positions
    expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(ExecutionServer.SDK);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('with optional Request fields', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
    const expectedLogReq: LogRequest = {
      platformId: 1,
      ...expectedBaseLogRequest(),
      timing: {
        clientLogTimestamp: 87654321,
      },
      cohortMembership: [
        {
          arm: 'CONTROL',
          cohortId: 'HOLD_OUT',
        },
      ],
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
          },
          response: {
            insertion: expectedResponseInsertionsForMetrics(),
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      request: {
        ...request(),
        platformId: 1,
        timing: {
          clientLogTimestamp: 87654321,
        },
      },
      experiment: {
        cohortId: 'HOLD_OUT',
        arm: 'CONTROL',
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    // SDK-provided positions
    expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(ExecutionServer.SDK);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('response does not have contentId', async () => {
    const deliveryClient = jest.fn((request) => {
      expect(request).toEqual(expectedRequest());
      return Promise.resolve({
        insertion: [
          {
            insertionId: 'uuid1',
            position: 0,
          },
          toResponseInsertion('product2', 'uuid2', 1),
          toResponseInsertion('product3', 'uuid3', 2),
        ],
      });
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const response = await promotedClient.deliver({
      request: request(),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual([
      {
        insertionId: 'uuid1',
        position: 0,
      },
      toResponseInsertion('product2', 'uuid2', 1),
      toResponseInsertion('product3', 'uuid3', 2),
    ]);

    expect(response.executionServer).toEqual(ExecutionServer.API);
    expect(response.clientRequestId).toEqual('uuid0');

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
      const expectedLogReq: LogRequest = {
        ...expectedBaseLogRequest(),
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
          },
        ],
        deliveryLog: [
          {
            request: {
              ...expectedRequestWithoutCommonFields(),
              requestId: 'uuid1',
            },
            response: {
              insertion: expectedResponseInsertionsForMetrics(),
            },
            execution: {
              executionServer: 2,
              serverVersion: SERVER_VERSION,
            },
          },
        ],
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const numExpectedErrors = 1;
      const errors: Error[] = [];
      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        deliveryTimeoutWrapper: () => Promise.reject(new Error('timeout')),
        handleError: (error: Error) => {
          errors.push(error);
          if (errors.length > numExpectedErrors) {
            // Throw early to make errors easier to debug.
            throw error;
          }
        },
      });

      const response = await promotedClient.deliver({
        request: request(),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
      expect(errors.length).toBe(numExpectedErrors);
      expect(errors[0].toString()).toEqual(
        'Error: Delivery should not be called in timeout; delivery, clientRequestId=uuid0'
      );
    });

    // This test does not fully test timeouts.
    // This test mocks out the timeout wrapper and fails before the Metrics API
    // call.
    it('metrics timeout', async () => {
      const deliveryClient: any = jest.fn((request) => {
        expect(request).toEqual({
          ...expectedRequest(),
          timing: {
            clientLogTimestamp: 12345678,
          },
          insertion: toRequestInsertions(products3()),
          clientInfo: DEFAULT_SDK_CLIENT_INFO,
          clientRequestId: 'uuid0',
        });
        return Promise.resolve({
          insertion: expectedResponseInsertionsForMetrics(),
        });
      });

      const expectedLogReq: LogRequest = {
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        clientInfo: DEFAULT_SDK_CLIENT_INFO,
        cohortMembership: [
          {
            arm: 'TREATMENT',
            cohortId: 'HOLD_OUT',
          },
        ],
        // Request is not logged since it's already logged on the server-side.
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const numExpectedErrors = 1;
      const errors: Error[] = [];
      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        metricsTimeoutWrapper: () => Promise.reject(new Error('timeout')),
        handleError: (error: Error) => {
          errors.push(error);
          if (errors.length > numExpectedErrors) {
            // Throw early to make errors easier to debug.
            throw error;
          }
        },
      });

      const deliveryReq: DeliveryRequest = {
        request: request(),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      };
      const response = await promotedClient.deliver(deliveryReq);
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.API);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
      expect(errors.length).toBe(numExpectedErrors);
      expect(errors[0].toString()).toEqual('Error: timeout; metrics, clientRequestId=uuid0');
    });

    it('shadow traffic timeout', async () => {
      // deliveryTimeoutWrapper is rejected instead so there's no need to do anything non-trivial here.
      const deliveryClient: any = jest.fn().mockReturnValue(null);
      const expectedLogReq: LogRequest = {
        ...expectedBaseLogRequest(),
        deliveryLog: [
          {
            request: {
              ...expectedRequestWithoutCommonFields(),
              requestId: 'uuid1',
            },
            response: {
              insertion: expectedResponseInsertionsForMetrics(),
            },
            execution: {
              executionServer: 2,
              serverVersion: SERVER_VERSION,
            },
          },
        ],
      };
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual(expectedLogReq);
      });

      const numExpectedErrors = 1;
      const errors: Error[] = [];
      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        shadowTrafficDeliveryRate: 1.0,
        sampler: {
          sampleRandom: () => true,
        },
        deliveryTimeoutWrapper: () => Promise.reject(new Error('timeout')),
        handleError: (error: Error) => {
          errors.push(error);
          if (errors.length > numExpectedErrors) {
            // Throw early to make errors easier to debug.
            throw error;
          }
        },
      });

      const response = await promotedClient.deliver({
        onlyLog: true,
        request: request(),
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
      expect(errors.length).toBe(numExpectedErrors);
      expect(errors[0].toString()).toEqual('Error: timeout; shadow delivery, clientRequestId=uuid0');
    });
  });

  describe('check input fields should be undefined', () => {
    it('Request.requestId', async () => {
      const promotedClient = newFakePromotedClient({});
      return expect(
        promotedClient.deliver({
          request: {
            ...expectedRequest(),
            requestId: 'uuid0',
          },
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Request.requestId should not be set'));
    });

    it('Insertion.requestId', async () => {
      const promotedClient = newFakePromotedClient({});
      return expect(
        promotedClient.deliver({
          request: {
            ...request(),
            insertion: [
              {
                ...toRequestInsertion(newProduct('3')),
                requestId: 'uuid0',
              },
              toRequestInsertion(newProduct('2')),
              toRequestInsertion(newProduct('1')),
            ],
          },
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Insertion.requestId should not be set'));
    });

    it('Insertion.insertionId', async () => {
      const promotedClient = newFakePromotedClient({});
      return expect(
        promotedClient.deliver({
          request: {
            ...request(),
            insertion: [
              {
                ...toRequestInsertion(newProduct('3')),
                insertionId: 'uuid0',
              },
              toRequestInsertion(newProduct('2')),
              toRequestInsertion(newProduct('1')),
            ],
          },
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Insertion.insertionId should not be set'));
    });

    it('Insertion.contentId', async () => {
      const promotedClient = newFakePromotedClient({});
      return expect(
        promotedClient.deliver({
          request: {
            ...request(),
            insertion: [{}, toRequestInsertion(newProduct('2')), toRequestInsertion(newProduct('1'))],
          },
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Insertion.contentId should be set'));
    });

    it('Experiment.platformId', async () => {
      const promotedClient = newFakePromotedClient({});
      return expect(
        promotedClient.deliver({
          request: request(),
          experiment: {
            platformId: 1,
          },
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Experiment.platformId should not be set'));
    });

    it('Experiment.userInfo', async () => {
      const promotedClient = newFakePromotedClient({});
      return expect(
        promotedClient.deliver({
          request: request(),
          experiment: {
            userInfo: {},
          },
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Experiment.userInfo should not be set'));
    });

    it('Experiment.timing', async () => {
      const promotedClient = newFakePromotedClient({});
      return expect(
        promotedClient.deliver({
          request: request(),
          experiment: {
            timing: {},
          },
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).rejects.toEqual(new Error('Experiment.timing should not be set'));
    });
  });
});

describe('client construction', () => {
  it('does not allow too small shadow traffic percent', async () => {
    expect(() => {
      newFakePromotedClient({
        shadowTrafficDeliveryRate: -0.1,
      });
    }).toThrow('shadowTrafficDeliveryRate must be between 0 and 1');
  });

  it('does not allow too large shadow traffic percent', async () => {
    expect(() => {
      newFakePromotedClient({
        shadowTrafficDeliveryRate: 1.1,
      });
    }).toThrow('shadowTrafficDeliveryRate must be between 0 and 1');
  });
});

describe('deliver with onlyLog=true', () => {
  it('good case', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    // Log request doesn't set position.
    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
          },
          response: {
            insertion: [
              toResponseInsertion('product3', 'uuid2', 0),
              toResponseInsertion('product2', 'uuid3', 1),
              toResponseInsertion('product1', 'uuid4', 2),
            ],
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      onlyLog: true,
      request: request(),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(2);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('no request insertions', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    // Log request doesn't set position.
    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            insertion: [],
          },
          response: {
            insertion: [],
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      onlyLog: true,
      request: {
        ...request(),
        insertion: [],
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual([]);
    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(2);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('page size 1', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            paging: {
              size: 1,
            },
          },
          response: {
            insertion: [toResponseInsertion('product3', 'uuid2', 0)],
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      onlyLog: true,
      request: {
        ...request(),
        paging: {
          size: 1,
        },
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual([toResponseInsertion('product3', 'uuid2', 0)]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(2);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('offsets position starting at the first insertion for prepaged insertions', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            paging: {
              size: 1,
              offset: 100,
            },
          },
          response: {
            insertion: [toResponseInsertion('product3', 'uuid2', 100)],
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      onlyLog: true,
      request: {
        ...request(),
        paging: {
          size: 1,
          offset: 100,
        },
      },
      insertionPageType: InsertionPageType.PrePaged,
    });
    expect(response.responseInsertions).toEqual([toResponseInsertion('product3', 'uuid2', 100)]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(2);
    expect(response.clientRequestId).toEqual('uuid0');
  });

  it('non-zero page offset', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in logging test'));
    // Paging parameters advance to the second insertion.
    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            paging: {
              size: 1,
              offset: 1,
            },
          },
          response: {
            insertion: [toResponseInsertion('product2', 'uuid2', 1)],
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      onlyLog: true,
      request: {
        ...request(),
        paging: {
          size: 1,
          offset: 1,
        },
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual([toResponseInsertion('product2', 'uuid2', 1)]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(2);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('extra fields', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            sessionId: 'uuid10',
            viewId: 'uuid11',
          },
          response: {
            insertion: expectedResponseInsertionsForMetrics(),
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
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

    const response = await promotedClient.deliver({
      onlyLog: true,
      request: {
        ...request(),
        sessionId: 'uuid10',
        viewId: 'uuid11',
      },
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual(expectedResponseInsertionsForMetrics());
    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(2);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });
});

describe('shadow requests', () => {
  async function runShadowRequestSamplingTest(
    samplingReturn: boolean,
    shouldCallDelivery: boolean,
    shadowTrafficDeliveryRate: number
  ) {
    let deliveryClient: any = jest.fn(failFunction('Delivery should not be called when shadow is not selected'));
    const products = [newProduct('3')];
    const requestInsertions = toRequestInsertions(products);
    if (shouldCallDelivery) {
      const expectedDeliveryReq = {
        ...expectedRequest(),
        timing: {
          clientLogTimestamp: 12345678,
        },
        insertion: requestInsertions,
        clientInfo: {
          clientType: ClientType_PLATFORM_SERVER,
          trafficType: TrafficType_SHADOW,
        },
        device: TEST_DEVICE,
        clientRequestId: 'uuid0',
      };
      deliveryClient = jest.fn((request) => {
        expect(request).toEqual(expectedDeliveryReq);
        return Promise.resolve({});
      });
    }

    const expectedLogReq: LogRequest = {
      ...expectedBaseLogRequest(),
      deliveryLog: [
        {
          request: {
            ...expectedRequestWithoutCommonFields(),
            requestId: 'uuid1',
            clientRequestId: 'uuid0',
            insertion: requestInsertions,
            device: TEST_DEVICE,
          },
          response: {
            insertion: [toResponseInsertion('product3', 'uuid2', 0)],
          },
          execution: {
            executionServer: 2,
            serverVersion: SERVER_VERSION,
          },
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
      shadowTrafficDeliveryRate: shadowTrafficDeliveryRate,
      sampler: sampler,
    });

    const deliveryRequest: DeliveryRequest = {
      onlyLog: true,
      request: {
        ...request(),
        insertion: toRequestInsertions(products),
      },
      insertionPageType: InsertionPageType.Unpaged,
    };
    const response = await promotedClient.deliver(deliveryRequest);
    const deliveryCallCount = shouldCallDelivery ? 1 : 0;
    expect(deliveryClient.mock.calls.length).toBe(deliveryCallCount); // here lies the shadow request
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.responseInsertions).toEqual([toResponseInsertion('product3', 'uuid2', 0)]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toEqual(2);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(deliveryCallCount);
    expect(metricsClient.mock.calls.length).toBe(1);
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

  async function runPagingTypeErrorTest(insertionPagingType: InsertionPageType) {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in the error case'));
    const metricsClient: any = jest.fn(failFunction('Metrics should not be called in the error case'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
      shadowTrafficDeliveryRate: 0.5,
      handleError: throwOnError,
      performChecks: true,
    });

    const products = [newProduct('3')];
    return promotedClient.deliver({
      onlyLog: true,
      request: {
        ...request(),
        insertion: toRequestInsertions(products),
      },
      insertionPageType: insertionPagingType,
    });
  }

  it('throws an error with the wrong paging type', async () => {
    return expect(runPagingTypeErrorTest(InsertionPageType.PrePaged)).rejects.toThrow(
      'Insertions must be unpaged when shadow traffic is on'
    );
  });
});

describe('log helper method', () => {
  it('simple', async () => {
    // DanHill: I don't know if there is a good way to test this helper.
    log({
      log: () => Promise.resolve(undefined),
      responseInsertions: expectedResponseInsertionsForDelivery(),
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
      request: request(),
      insertionPageType: InsertionPageType.Unpaged,
    });
    const logReq = (await resp).logRequest;
    expect(logReq).toBeUndefined();

    const resp2 = client.deliver({
      onlyLog: true,
      request: request(),
      insertionPageType: InsertionPageType.Unpaged,
    });
    const logReq2 = (await resp2).logRequest;
    expect(logReq2).toBeUndefined();
  });
});
