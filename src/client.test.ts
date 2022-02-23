import { log, newPromotedClient, noopFn, NoopPromotedClient, throwOnError } from '.';
import type { Insertion, Request } from './types/delivery';
import { ClientType_PLATFORM_SERVER, TrafficType_PRODUCTION, TrafficType_SHADOW, SERVER_VERSION } from './client';
import { PromotedClientArguments } from './client-args';
import { InsertionPageType } from './insertion-page-type';
import { DeliveryRequest } from './delivery-request';
import { MetricsRequest } from './metrics-request';
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
  title: string;
  url: string;
}

const TEST_DEVICE: Device = {
  browser: {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
  },
  ipAddress: '127.0.0.1',
};

const newProduct = (id: string): Product => ({
  id: `product${id}`,
  title: `Product ${id}`,
  url: `www.mymarket.com/p/${id}`,
});

// Response insertions should always have position assigned.
const toResponseInsertions = (products: Product[]): Insertion[] =>
  products.map((product, idx) => {
    // TODO - we'll change these to have contentId and position.
    return toFullInsertion(product, { position: idx });
  });

// An interface for setting optional fields.
interface InsertionFields {
  insertionId?: string;
  requestId?: string;
  viewId?: string;
  sessionId?: string;
  position?: number;
}

const toFullInsertions = (products: Product[]): Insertion[] => products.map(singleArgToFullInsertion);

// This helper is only needed because map fails type checks for the 2 arg version.
const singleArgToFullInsertion = (product: Product): Insertion => toFullInsertion(product);

const toFullInsertion = (product: Product, extraFields: InsertionFields = {}): Insertion => ({
  ...toInsertionOnlyContentId(product, extraFields),
  properties: {
    struct: {
      product,
    },
  },
});

const toInsertionsOnlyContentId = (products: Product[]): Insertion[] => products.map(singleArgToInsertionOnlyContentId);

// This helper is only needed because map fails type checks for the 2 arg version.
const singleArgToInsertionOnlyContentId = (product: Product): Insertion => toInsertionOnlyContentId(product);

const toInsertionOnlyContentId = (product: Product, extraFields: InsertionFields = {}): Insertion => ({
  ...extraFields,
  contentId: product.id.toString(),
});

// Creates a new request.
const newBaseRequest = (): Partial<Request> => ({
  userInfo: {
    logUserId: 'logUserId1',
  },
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
  const sendShadowTrafficForControl =
    overrideArgs.sendShadowTrafficForControl == undefined ? false : overrideArgs.sendShadowTrafficForControl;

  return newPromotedClient({
    defaultRequestValues: {
      onlyLog: false,
    },
    deliveryClient,
    metricsClient,
    handleError: throwOnError,
    uuid: fakeUuidGenerator(),
    nowMillis: () => 12345678,
    sendShadowTrafficForControl: sendShadowTrafficForControl, // makes test setup easier to default to off.
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
        fullInsertion: toFullInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });

      const expectedRespInsertions = toResponseInsertions([newProduct('3'), newProduct('2'), newProduct('1')]);
      expect(response.insertion).toEqual(expectedRespInsertions);
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
          ...newBaseRequest(),
        },
        fullInsertion: [],
        insertionPageType: InsertionPageType.Unpaged,
      });

      const expectedRespInsertions = toResponseInsertions([]);
      expect(response.insertion).toEqual(expectedRespInsertions);
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
      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: {
          ...newBaseRequest(),
          paging: {
            size: 1,
          },
        },
        fullInsertion: toFullInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });

      const expectedRespInsertions = [toFullInsertion(newProduct('3'), { position: 0 })];

      expect(response.insertion).toEqual(expectedRespInsertions);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toBeUndefined();
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
        fullInsertion: toFullInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(response.insertion).toEqual(toResponseInsertions([newProduct('3'), newProduct('2'), newProduct('1')]));
      expect(response.executionServer).toBeDefined();
      expect(response.clientRequestId).toBeUndefined();
      await response.log();
    });

    it('no request insertions', async () => {
      const promotedClient = newFakePromotedClient({
        enabled: false,
        deliveryClient: jest.fn(failFunction('Delivery should not be called')),
        metricsClient: jest.fn(failFunction('Metrics should not be called')),
      });
      const response = promotedClient.prepareForLogging({
        request: {
          ...newBaseRequest(),
        },
        fullInsertion: [],
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(response.insertion).toEqual(toResponseInsertions([]));
      expect(response.executionServer).toBeDefined();
      expect(response.clientRequestId).toBeUndefined();
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
        fullInsertion: toFullInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(response.insertion).toEqual(toResponseInsertions([newProduct('3')]));
      expect(response.executionServer).toBeDefined();
      expect(response.clientRequestId).toBeUndefined();
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
        fullInsertion: toFullInsertions(products),
        insertionPageType: InsertionPageType.Unpaged,
      });

      // Paging parameters advance to the second insertion.
      const expectedInsertions = toResponseInsertions([newProduct('2')]);
      expectedInsertions[0].position = 1; // the offset
      expect(response.insertion).toEqual(expectedInsertions);
      expect(response.executionServer).toBeDefined();
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

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const deliveryReq: DeliveryRequest = {
      request: newBaseRequest(),
      insertionPageType: InsertionPageType.Unpaged,
      fullInsertion: toFullInsertions(products),
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
      fullInsertion: toFullInsertions(products),
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
        clientInfo: DEFAULT_SDK_CLIENT_INFO,
        clientRequestId: 'uuid0',
        insertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
      });
      return Promise.resolve({
        insertion: [
          toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
          toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
          toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
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
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
      toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
      toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
    ]);

    expect(response.executionServer).toEqual(ExecutionServer.API);
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);
  });

  it('simple has more than max request insertions', async () => {
    const deliveryClient = jest.fn((request) => {
      expect(request).toEqual({
        ...newBaseRequest(),
        timing: {
          clientLogTimestamp: 12345678,
        },
        clientInfo: DEFAULT_SDK_CLIENT_INFO,
        clientRequestId: 'uuid0',
        insertion: toFullInsertions([newProduct('1'), newProduct('2')]),
      });
      return Promise.resolve({
        insertion: [
          toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
          toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        ],
      });
    });
    const metricsClient = jest.fn(failFunction('All data should be logged in Delivery API'));

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
      maxRequestInsertions: 2,
    });

    const products = [newProduct('1'), newProduct('2'), newProduct('3')];
    const response = await promotedClient.deliver({
      request: newBaseRequest(),
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
      toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
    ]);

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
        ...newBaseRequest(),
        timing: {
          clientLogTimestamp: 12345678,
        },
        clientInfo: DEFAULT_SDK_CLIENT_INFO,
        clientRequestId: 'uuid0',
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
      request: newBaseRequest(),
      fullInsertion: [],
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([]);

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
        userInfo: {
          logUserId: 'logUserId1',
        },
        timing: {
          clientLogTimestamp: 12345678,
        },
        clientInfo: DEFAULT_SDK_CLIENT_INFO,
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
        deliveryLog: [
          {
            request: {
              ...newLogRequestRequest(),
              requestId: 'uuid1',
              clientRequestId: 'uuid0',
              device: TEST_DEVICE,
              timing: {
                clientLogTimestamp: 12345678,
              },
            },
            response: {
              insertion: [
                toFullInsertion(newProduct('3'), {
                  insertionId: 'uuid2',
                  requestId: 'uuid1',
                  position: 0,
                }),
                toFullInsertion(newProduct('2'), {
                  insertionId: 'uuid3',
                  requestId: 'uuid1',
                  position: 1,
                }),
                toFullInsertion(newProduct('1'), {
                  insertionId: 'uuid4',
                  requestId: 'uuid1',
                  position: 2,
                }),
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

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toFullInsertions(products),
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
        toFullInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toFullInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toFullInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    const controlSendsShadowTraffic = async (compactInsertions: boolean) => {
      // Delivery gets called as shadow traffic in CONTROL.
      const deliveryClient: any = jest.fn((request) => {
        const products = [newProduct('3'), newProduct('2'), newProduct('1')];
        const requestInsertions = compactInsertions ? toInsertionsOnlyContentId(products) : toFullInsertions(products);
        expect(request).toEqual({
          ...newBaseRequest(),
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientInfo: {
            trafficType: TrafficType_SHADOW, // !!!
            clientType: ClientType_PLATFORM_SERVER,
          },
          clientRequestId: 'uuid0',
          insertion: requestInsertions,
        });
        return Promise.resolve({
          insertion: [
            toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
            toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
            toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
          ],
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
        deliveryLog: [
          {
            request: {
              ...newLogRequestRequest(),
              requestId: 'uuid1',
              clientRequestId: 'uuid0',
              device: TEST_DEVICE,
              timing: {
                clientLogTimestamp: 12345678,
              },
            },
            response: {
              insertion: [
                toFullInsertion(newProduct('3'), {
                  insertionId: 'uuid2',
                  requestId: 'uuid1',
                  position: 0,
                }),
                toFullInsertion(newProduct('2'), {
                  insertionId: 'uuid3',
                  requestId: 'uuid1',
                  position: 1,
                }),
                toFullInsertion(newProduct('1'), {
                  insertionId: 'uuid4',
                  requestId: 'uuid1',
                  position: 2,
                }),
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
        sendShadowTrafficForControl: true,
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const deliveryRequest: DeliveryRequest = {
        request: newBaseRequest(),
        fullInsertion: toFullInsertions(products),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'CONTROL',
        },
        insertionPageType: InsertionPageType.Unpaged,
      };
      if (compactInsertions) {
        // Clear out the properties.
        deliveryRequest.toCompactDeliveryProperties = () => undefined;
      }
      const response = await promotedClient.deliver(deliveryRequest);
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      // SDK-provided positions
      expect(response.insertion).toEqual([
        toFullInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toFullInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toFullInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    };

    it('arm=CONTROL sends shadow traffic', async () => {
      return controlSendsShadowTraffic(false);
    });

    it('arm=CONTROL sends shadow traffic w/ compact', async () => {
      return controlSendsShadowTraffic(true);
    });

    it('arm=TREATMENT', async () => {
      const deliveryClient: any = jest.fn((request) => {
        expect(request).toEqual({
          ...newBaseRequest(),
          timing: {
            clientLogTimestamp: 12345678,
          },
          clientInfo: DEFAULT_SDK_CLIENT_INFO,
          clientRequestId: 'uuid0',
          insertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        });
        return Promise.resolve({
          insertion: [
            toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
            toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
            toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
          ],
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
        fullInsertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);

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
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        deliveryLog: [
          {
            request: {
              ...newLogRequestRequest(),
              timing: {
                clientLogTimestamp: 12345678,
              },
              requestId: 'uuid1',
              clientRequestId: 'uuid0',
              device: TEST_DEVICE,
            },
            response: {
              insertion: [
                toFullInsertion(newProduct('3'), { insertionId: 'uuid2', requestId: 'uuid1', position: 0 }),
                toFullInsertion(newProduct('2'), { insertionId: 'uuid3', requestId: 'uuid1', position: 1 }),
                toFullInsertion(newProduct('1'), { insertionId: 'uuid4', requestId: 'uuid1', position: 2 }),
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
        handleError: () => {
          // silently handle error in deliver.
        },
        deliveryClient,
        metricsClient,
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toFullInsertions(products),
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
        toFullInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toFullInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toFullInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

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
        deliveryLog: [
          {
            request: {
              ...newLogRequestRequest(),
              requestId: 'uuid1',
              timing: {
                clientLogTimestamp: 12345678,
              },
              clientRequestId: 'uuid0',
              device: TEST_DEVICE,
            },
            response: {
              insertion: [
                {
                  contentId: 'product3',
                  insertionId: 'uuid2',
                  position: 0,
                  requestId: 'uuid1',
                },
                {
                  contentId: 'product2',
                  insertionId: 'uuid3',
                  position: 1,
                  requestId: 'uuid1',
                },
                {
                  contentId: 'product1',
                  insertionId: 'uuid4',
                  position: 2,
                  requestId: 'uuid1',
                },
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

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toFullInsertions(products),
        toCompactMetricsProperties: () => undefined,
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
        toFullInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toFullInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toFullInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    it('toCompactMetricsInsertion arm=CONTROL defaultRequestValues', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      // Should not have position set due to the custom compact function we're testing with.
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
        deliveryLog: [
          {
            request: {
              ...newLogRequestRequest(),
              requestId: 'uuid1',
              timing: {
                clientLogTimestamp: 12345678,
              },
              clientRequestId: 'uuid0',
              device: TEST_DEVICE,
            },
            response: {
              insertion: [
                {
                  insertionId: 'uuid2',
                  contentId: 'product3',
                  requestId: 'uuid1',
                  position: 0,
                },
                {
                  insertionId: 'uuid3',
                  contentId: 'product2',
                  requestId: 'uuid1',
                  position: 1,
                },
                {
                  insertionId: 'uuid4',
                  contentId: 'product1',
                  requestId: 'uuid1',
                  position: 2,
                },
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
        defaultRequestValues: {
          toCompactMetricsProperties: () => undefined,
        },
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toFullInsertions(products),
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
        toFullInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toFullInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toFullInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

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
          clientInfo: DEFAULT_SDK_CLIENT_INFO,
          clientRequestId: 'uuid0',
        });
        return Promise.resolve({
          insertion: [
            toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
            toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
            toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
          ],
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
        fullInsertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        toCompactDeliveryProperties: () => undefined,
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);
      expect(response.executionServer).toEqual(ExecutionServer.API);
      expect(response.clientRequestId).toEqual('uuid0');

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
          clientInfo: DEFAULT_SDK_CLIENT_INFO,
          clientRequestId: 'uuid0',
        });
        return Promise.resolve({
          insertion: [
            toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
            toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
            toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
          ],
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
          toCompactDeliveryProperties: () => undefined,
        },
      });

      const response = await promotedClient.deliver({
        request: newBaseRequest(),
        fullInsertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        experiment: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
        insertionPageType: InsertionPageType.Unpaged,
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toFullInsertion(newProduct('1'), { insertionId: 'uuid1' }),
        toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.API);
      expect(response.clientRequestId).toEqual('uuid0');

      // Here is where clients will return their response.
      await response.log();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });
  });

  it('page size 1', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
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
      deliveryLog: [
        {
          request: {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            paging: {
              size: 1,
            },
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('3'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                position: 0,
              }),
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

    const products = [newProduct('3')];
    const response = await promotedClient.deliver({
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
        },
      },
      fullInsertion: toFullInsertions(products),
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
      toFullInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
    ]);

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
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
      deliveryLog: [
        {
          request: {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('3'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                position: 0,
              }),
              toFullInsertion(newProduct('2'), {
                insertionId: 'uuid3',
                requestId: 'uuid1',
                position: 1,
              }),
              toFullInsertion(newProduct('1'), {
                insertionId: 'uuid4',
                requestId: 'uuid1',
                position: 2,
              }),
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

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = await promotedClient.deliver({
      onlyLog: true,
      request: newBaseRequest(),
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    // SDK-provided positions
    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
      toFullInsertion(newProduct('2'), {
        insertionId: 'uuid3',
        requestId: 'uuid1',
        position: 1,
      }),
      toFullInsertion(newProduct('1'), {
        insertionId: 'uuid4',
        requestId: 'uuid1',
        position: 2,
      }),
    ]);

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
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 87654321,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
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
      deliveryLog: [
        {
          request: {
            ...newLogRequestRequest(),
            platformId: 1,
            requestId: 'uuid1',
            timing: {
              clientLogTimestamp: 87654321,
            },
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('3'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                position: 0,
              }),
              toFullInsertion(newProduct('2'), {
                insertionId: 'uuid3',
                requestId: 'uuid1',
                position: 1,
              }),
              toFullInsertion(newProduct('1'), {
                insertionId: 'uuid4',
                requestId: 'uuid1',
                position: 2,
              }),
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

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = await promotedClient.deliver({
      request: {
        ...newBaseRequest(),
        platformId: 1,
        timing: {
          clientLogTimestamp: 87654321,
        },
      },
      fullInsertion: toFullInsertions(products),
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
      toFullInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
      toFullInsertion(newProduct('2'), {
        insertionId: 'uuid3',
        requestId: 'uuid1',
        position: 1,
      }),
      toFullInsertion(newProduct('1'), {
        insertionId: 'uuid4',
        requestId: 'uuid1',
        position: 2,
      }),
    ]);

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
      expect(request).toEqual({
        ...newBaseRequest(),
        timing: {
          clientLogTimestamp: 12345678,
        },
        insertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        clientInfo: DEFAULT_SDK_CLIENT_INFO,
        clientRequestId: 'uuid0',
      });
      return Promise.resolve({
        insertion: [
          {
            insertionId: 'uuid1',
          },
          toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
          toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
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
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      {
        insertionId: 'uuid1',
      },
      toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
      toFullInsertion(newProduct('3'), { insertionId: 'uuid3' }),
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
            timing: {
              clientLogTimestamp: 12345678,
            },
            userInfo: {
              logUserId: 'logUserId1',
            },
          },
        ],
        deliveryLog: [
          {
            request: {
              ...newLogRequestRequest(),
              requestId: 'uuid1',
              timing: {
                clientLogTimestamp: 12345678,
              },
              clientRequestId: 'uuid0',
              device: TEST_DEVICE,
            },
            response: {
              insertion: [
                toFullInsertion(newProduct('3'), {
                  insertionId: 'uuid2',
                  requestId: 'uuid1',
                  position: 0,
                }),
                toFullInsertion(newProduct('2'), {
                  insertionId: 'uuid3',
                  requestId: 'uuid1',
                  position: 1,
                }),
                toFullInsertion(newProduct('1'), {
                  insertionId: 'uuid4',
                  requestId: 'uuid1',
                  position: 2,
                }),
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
        fullInsertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
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
        toFullInsertion(newProduct('3'), {
          insertionId: 'uuid2',
          requestId: 'uuid1',
          position: 0,
        }),
        toFullInsertion(newProduct('2'), {
          insertionId: 'uuid3',
          requestId: 'uuid1',
          position: 1,
        }),
        toFullInsertion(newProduct('1'), {
          insertionId: 'uuid4',
          requestId: 'uuid1',
          position: 2,
        }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.SDK);
      expect(response.clientRequestId).toEqual('uuid0');

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
          insertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          clientInfo: DEFAULT_SDK_CLIENT_INFO,
          clientRequestId: 'uuid0',
        });
        return Promise.resolve({
          insertion: [
            toFullInsertion(newProduct('1'), { insertionId: 'uuid2' }),
            toFullInsertion(newProduct('2'), { insertionId: 'uuid3' }),
            toFullInsertion(newProduct('3'), { insertionId: 'uuid4' }),
          ],
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
        fullInsertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
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
        toFullInsertion(newProduct('1'), { insertionId: 'uuid2' }),
        toFullInsertion(newProduct('2'), { insertionId: 'uuid3' }),
        toFullInsertion(newProduct('3'), { insertionId: 'uuid4' }),
      ]);

      expect(response.logRequest).toEqual(expectedLogReq);
      expect(response.executionServer).toEqual(ExecutionServer.API);
      expect(response.clientRequestId).toEqual('uuid0');

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
          fullInsertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
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
            insertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          },
          fullInsertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
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
              ...toFullInsertion(newProduct('3')),
              requestId: 'uuid0',
            },
            toFullInsertion(newProduct('2')),
            toFullInsertion(newProduct('1')),
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
              ...toFullInsertion(newProduct('3')),
              insertionId: 'uuid0',
            },
            toFullInsertion(newProduct('2')),
            toFullInsertion(newProduct('1')),
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
          fullInsertion: [{}, toFullInsertion(newProduct('2')), toFullInsertion(newProduct('1'))],
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
    const expectedLogReq: LogRequest = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
      deliveryLog: [
        {
          request: {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('3'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                position: 0,
              }),
              toFullInsertion(newProduct('2'), {
                insertionId: 'uuid3',
                requestId: 'uuid1',
                position: 1,
              }),
              toFullInsertion(newProduct('1'), {
                insertionId: 'uuid4',
                requestId: 'uuid1',
                position: 2,
              }),
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

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = promotedClient.prepareForLogging({
      request: newBaseRequest(),
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
      toFullInsertion(newProduct('2'), {
        insertionId: 'uuid3',
        requestId: 'uuid1',
        position: 1,
      }),
      toFullInsertion(newProduct('1'), {
        insertionId: 'uuid4',
        requestId: 'uuid1',
        position: 2,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toBeUndefined();
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
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
      deliveryLog: [
        {
          request: {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
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

    const response = promotedClient.prepareForLogging({
      request: newBaseRequest(),
      fullInsertion: [],
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([]);
    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toBeUndefined();
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('page size 1', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    const expectedLogReq: LogRequest = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
      deliveryLog: [
        {
          request: {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            paging: {
              size: 1,
            },
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('3'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                position: 0,
              }),
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

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
        },
      },
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toBeUndefined();
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('offsets position starting at the first insertion for prepaged insertions', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    // Logging only doesn't set position.
    const expectedLogReq: LogRequest = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
      deliveryLog: [
        {
          request: {
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
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('3'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                position: 100,
              }),
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

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const metricsRequest: MetricsRequest = {
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
          offset: 100,
        },
      },
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.PrePaged,
    };

    const response = promotedClient.prepareForLogging(metricsRequest);
    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 100, // the offset
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toBeUndefined();
    expect(response.clientRequestId).toEqual('uuid0');
  });

  it('non-zero page offset', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in logging test'));
    // Paging parameters advance to the second insertion.
    const expectedLogReq: LogRequest = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
      deliveryLog: [
        {
          request: {
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
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('2'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                position: 1, // the offset
              }),
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

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        paging: {
          size: 1,
          offset: 1,
        },
      },
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('2'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 1, // the offset
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toBeUndefined();
    expect(response.clientRequestId).toEqual('uuid0');

    // Here is where clients will return their response.
    await response.log();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('extra fields', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called when logging only'));
    const expectedLogReq: LogRequest = {
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
      deliveryLog: [
        {
          request: {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            sessionId: 'uuid10',
            viewId: 'uuid11',
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('3'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                sessionId: 'uuid10',
                viewId: 'uuid11',
                position: 0,
              }),
              toFullInsertion(newProduct('2'), {
                insertionId: 'uuid3',
                requestId: 'uuid1',
                sessionId: 'uuid10',
                viewId: 'uuid11',
                position: 1,
              }),
              toFullInsertion(newProduct('1'), {
                insertionId: 'uuid4',
                requestId: 'uuid1',
                sessionId: 'uuid10',
                viewId: 'uuid11',
                position: 2,
              }),
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

    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = promotedClient.prepareForLogging({
      request: {
        ...newBaseRequest(),
        sessionId: 'uuid10',
        viewId: 'uuid11',
      },
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        sessionId: 'uuid10',
        viewId: 'uuid11',
        position: 0,
      }),
      toFullInsertion(newProduct('2'), {
        insertionId: 'uuid3',
        requestId: 'uuid1',
        sessionId: 'uuid10',
        viewId: 'uuid11',
        position: 1,
      }),
      toFullInsertion(newProduct('1'), {
        insertionId: 'uuid4',
        requestId: 'uuid1',
        sessionId: 'uuid10',
        viewId: 'uuid11',
        position: 2,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toBeUndefined();
    expect(response.clientRequestId).toEqual('uuid0');

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
          fullInsertion: toFullInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          insertionPageType: InsertionPageType.Unpaged,
        })
      ).toThrow(new Error('Request.requestId should not be set'));
    });
  });
});

describe('shadow requests in prepareForLogging', () => {
  async function runShadowRequestSamplingTest(
    samplingReturn: boolean,
    shouldCallDelivery: boolean,
    shadowTrafficDeliveryPercent: number,
    compactInsertions: boolean
  ) {
    let deliveryClient: any = jest.fn(failFunction('Delivery should not be called when shadow is not selected'));
    if (shouldCallDelivery) {
      const products = [newProduct('3')];
      const requestInsertions = compactInsertions ? toInsertionsOnlyContentId(products) : toFullInsertions(products);
      const expectedDeliveryReq = {
        ...newBaseRequest(),
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
      userInfo: {
        logUserId: 'logUserId1',
      },
      timing: {
        clientLogTimestamp: 12345678,
      },
      clientInfo: DEFAULT_SDK_CLIENT_INFO,
      deliveryLog: [
        {
          request: {
            ...newLogRequestRequest(),
            requestId: 'uuid1',
            timing: {
              clientLogTimestamp: 12345678,
            },
            clientInfo: DEFAULT_SDK_CLIENT_INFO,
            clientRequestId: 'uuid0',
            device: TEST_DEVICE,
          },
          response: {
            insertion: [
              toFullInsertion(newProduct('3'), {
                insertionId: 'uuid2',
                requestId: 'uuid1',
                position: 0,
              }),
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
    const metricsRequest: MetricsRequest = {
      request: {
        ...newBaseRequest(),
        clientInfo: DEFAULT_SDK_CLIENT_INFO,
      },
      fullInsertion: toFullInsertions(products),
      insertionPageType: InsertionPageType.Unpaged,
    };
    if (compactInsertions) {
      // Clear out the properties.
      metricsRequest.toCompactDeliveryProperties = () => undefined;
    }
    const response = promotedClient.prepareForLogging(metricsRequest);
    const deliveryCallCount = shouldCallDelivery ? 1 : 0;
    expect(deliveryClient.mock.calls.length).toBe(deliveryCallCount); // here lies the shadow request
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toFullInsertion(newProduct('3'), {
        insertionId: 'uuid2',
        requestId: 'uuid1',
        position: 0,
      }),
    ]);

    expect(response.logRequest).toEqual(expectedLogReq);
    expect(response.executionServer).toBeUndefined();
    expect(response.clientRequestId).toEqual('uuid0');

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
        clientInfo: DEFAULT_SDK_CLIENT_INFO,
      },
      fullInsertion: toFullInsertions(products),
      insertionPageType: insertionPagingType,
    });
  }

  it('makes a shadow request', async () => {
    await runShadowRequestSamplingTest(true, true, 0.5, false);
  });

  it('does not make a shadow request - not sampled in', async () => {
    await runShadowRequestSamplingTest(false, false, 0.5, false);
  });

  it('does not make a shadow request - sampling not turned on', async () => {
    await runShadowRequestSamplingTest(true, false, 0, false);
  });

  it('makes a shadow request w/ compact insertion properties', async () => {
    await runShadowRequestSamplingTest(true, true, 0.5, true);
  });

  it('throws an error with the wrong paging type', async () => {
    expect(() => runPagingTypeErrorTest(InsertionPageType.PrePaged)).toThrow(
      'Insertions must be unpaged when shadow traffic is on'
    );
  });
});

describe('log helper method', () => {
  it('simple', async () => {
    // DanHill: I don't know if there is a good way to test this helper.
    log({
      log: () => Promise.resolve(undefined),
      insertion: [
        toFullInsertion(newProduct('3'), { insertionId: 'uuid1' }),
        toFullInsertion(newProduct('2'), { insertionId: 'uuid2' }),
        toFullInsertion(newProduct('1'), { insertionId: 'uuid3' }),
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
