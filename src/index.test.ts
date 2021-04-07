import { newPromotedClient, throwOnError } from '.';
import type { PromotedClientArguments } from '.';
import type { Insertion, Request } from './types/delivery';

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

const toInsertions = (products: Product[]): Insertion[] => products.map(toInsertion);

const toInsertion = (product: Product): Insertion => ({
  contentId: product.id.toString(),
  properties: {
    struct: {
      product,
    },
  },
});

const toInsertionWithInsertionId = (product: Product, insertionId: string): Insertion => {
  const insertion = toInsertion(product);
  insertion.insertionId = insertionId;
  return insertion;
};

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
      shouldOptimize: true,
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

describe('no-op deliver', () => {
  it('simple good case', async () => {
    const promotedClient = newFakePromotedClient({
      enabled: false,
      deliveryClient: jest.fn(failFunction('Delivery should not be called in CONTROL')),
      metricsClient: jest.fn(failFunction('Metrics should not be called in CONTROL')),
    });
    const products = [newProduct('3'), newProduct('2'), newProduct('1')];
    const response = await promotedClient.deliver({
      request: {
        ...newBaseRequest(),
        insertion: toInsertions(products),
      },
    });
    expect(response.insertion).toEqual(toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]));
    await response.finishAfterResponse();
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
          toInsertionWithInsertionId(newProduct('1'), 'uuid1'),
          toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
          toInsertionWithInsertionId(newProduct('3'), 'uuid3'),
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
      request: {
        ...newBaseRequest(),
        insertion: toInsertions(products),
      },
    });
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertionWithInsertionId(newProduct('1'), 'uuid1'),
      toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
      toInsertionWithInsertionId(newProduct('3'), 'uuid3'),
    ]);
    // Here is where clients will return their response.
    await response.finishAfterResponse();
    expect(deliveryClient.mock.calls.length).toBe(1);
    expect(metricsClient.mock.calls.length).toBe(0);
  });

  describe('using cohorts', () => {
    it('arm=CONTROL', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual({
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
          request: [
            {
              ...newBaseRequest(),
              requestId: 'uuid0',
              timing: {
                clientLogTimestamp: 12345678,
              },
              insertion: [
                toInsertionWithInsertionId(newProduct('3'), 'uuid1'),
                toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
                toInsertionWithInsertionId(newProduct('1'), 'uuid3'),
              ],
            },
          ],
        });
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: {
          ...newBaseRequest(),
          insertion: toInsertions(products),
        },
        cohortMembershipIfActivated: {
          cohortId: 'HOLD_OUT',
          arm: 'CONTROL',
        },
      });
      expect(deliveryClient.mock.calls.length).toBe(0);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertionWithInsertionId(newProduct('3'), 'uuid1'),
        toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
        toInsertionWithInsertionId(newProduct('1'), 'uuid3'),
      ]);
      // Here is where clients will return their response.
      await response.finishAfterResponse();
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
            toInsertionWithInsertionId(newProduct('1'), 'uuid1'),
            toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
            toInsertionWithInsertionId(newProduct('3'), 'uuid3'),
          ],
        });
      });
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual({
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
        });
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
      });

      const response = await promotedClient.deliver({
        request: {
          ...newBaseRequest(),
          insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        },
        cohortMembershipIfActivated: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertionWithInsertionId(newProduct('1'), 'uuid1'),
        toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
        toInsertionWithInsertionId(newProduct('3'), 'uuid3'),
      ]);
      // Here is where clients will return their response.
      await response.finishAfterResponse();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });

    // If Delivery fails and we silently handle it, we log like everything.
    it('arm=TREATMENT - Delivery failed', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual({
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
          request: [
            {
              ...newBaseRequest(),
              timing: {
                clientLogTimestamp: 12345678,
              },
              requestId: 'uuid0',
              insertion: [
                toInsertionWithInsertionId(newProduct('3'), 'uuid1'),
                toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
                toInsertionWithInsertionId(newProduct('1'), 'uuid3'),
              ],
            },
          ],
        });
      });

      const promotedClient = newFakePromotedClient({
        handleError: () => {
          // noop.
        },
        deliveryClient,
        metricsClient,
      });

      const products = [newProduct('3'), newProduct('2'), newProduct('1')];
      const response = await promotedClient.deliver({
        request: {
          ...newBaseRequest(),
          insertion: toInsertions(products),
        },
        cohortMembershipIfActivated: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertionWithInsertionId(newProduct('3'), 'uuid1'),
        toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
        toInsertionWithInsertionId(newProduct('1'), 'uuid3'),
      ]);
      // Here is where clients will return their response.
      await response.finishAfterResponse();
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(1);
    });
  });

  it('arm=CONTROL', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual({
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
        request: [
          {
            ...newBaseRequest(),
            requestId: 'uuid0',
            limit: 1,
            timing: {
              clientLogTimestamp: 12345678,
            },
            insertion: [toInsertionWithInsertionId(newProduct('3'), 'uuid1')],
          },
        ],
      });
    });

    const promotedClient = newFakePromotedClient({
      deliveryClient,
      metricsClient,
    });

    const products = [newProduct('3')];
    const response = await promotedClient.deliver({
      request: {
        ...newBaseRequest(),
        limit: 1,
        insertion: toInsertions(products),
      },
      cohortMembershipIfActivated: {
        cohortId: 'HOLD_OUT',
        arm: 'CONTROL',
      },
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([toInsertionWithInsertionId(newProduct('3'), 'uuid1')]);
    // Here is where clients will return their response.
    await response.finishAfterResponse();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  it('with optional Request fields', async () => {
    const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
    const metricsClient: any = jest.fn((request) => {
      expect(request).toEqual({
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
        request: [
          {
            ...newBaseRequest(),
            platformId: 1,
            requestId: 'uuid0',
            timing: {
              clientLogTimestamp: 87654321,
            },
            insertion: [
              toInsertionWithInsertionId(newProduct('3'), 'uuid1'),
              toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
              toInsertionWithInsertionId(newProduct('1'), 'uuid3'),
            ],
          },
        ],
      });
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
        insertion: toInsertions(products),
      },
      cohortMembershipIfActivated: {
        cohortId: 'HOLD_OUT',
        arm: 'CONTROL',
      },
    });
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(0);

    expect(response.insertion).toEqual([
      toInsertionWithInsertionId(newProduct('3'), 'uuid1'),
      toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
      toInsertionWithInsertionId(newProduct('1'), 'uuid3'),
    ]);
    // Here is where clients will return their response.
    await response.finishAfterResponse();
    expect(deliveryClient.mock.calls.length).toBe(0);
    expect(metricsClient.mock.calls.length).toBe(1);
  });

  describe('timeout error', () => {
    // This test does not fully test timeouts.
    // This test mocks out the timeout wrapper and fails before the Delivery
    // API call.
    it('delivery timeout', async () => {
      const deliveryClient: any = jest.fn(failFunction('Delivery should not be called in CONTROL'));
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual({
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
          request: [
            {
              ...newBaseRequest(),
              requestId: 'uuid0',
              limit: 1,
              timing: {
                clientLogTimestamp: 12345678,
              },
              insertion: [toInsertionWithInsertionId(newProduct('3'), 'uuid1')],
            },
          ],
        });
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        deliveryTimeoutWrapper: () => Promise.reject(new Error('timeout')),
        handleError: () => {
          // noop.
        },
      });

      const response = await promotedClient.deliver({
        request: {
          ...newBaseRequest(),
          insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        },
        cohortMembershipIfActivated: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertionWithInsertionId(newProduct('3'), 'uuid1'),
        toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
        toInsertionWithInsertionId(newProduct('1'), 'uuid3'),
      ]);
      // Here is where clients will return their response.
      await response.finishAfterResponse();
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
            toInsertionWithInsertionId(newProduct('1'), 'uuid1'),
            toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
            toInsertionWithInsertionId(newProduct('3'), 'uuid3'),
          ],
        });
      });
      const metricsClient: any = jest.fn((request) => {
        expect(request).toEqual({
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
        });
      });

      const promotedClient = newFakePromotedClient({
        deliveryClient,
        metricsClient,
        metricsTimeoutWrapper: () => Promise.reject(new Error('timeout')),
        handleError: () => {
          // noop.
        },
      });

      const response = await promotedClient.deliver({
        request: {
          ...newBaseRequest(),
          insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
        },
        cohortMembershipIfActivated: {
          cohortId: 'HOLD_OUT',
          arm: 'TREATMENT',
        },
      });
      expect(deliveryClient.mock.calls.length).toBe(1);
      expect(metricsClient.mock.calls.length).toBe(0);

      expect(response.insertion).toEqual([
        toInsertionWithInsertionId(newProduct('1'), 'uuid1'),
        toInsertionWithInsertionId(newProduct('2'), 'uuid2'),
        toInsertionWithInsertionId(newProduct('3'), 'uuid3'),
      ]);
      // Here is where clients will return their response.
      await response.finishAfterResponse();
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
            insertion: toInsertions([newProduct('3'), newProduct('2'), newProduct('1')]),
          },
        })
      ).rejects.toEqual(new Error('Request.requestId should not be set'));
    });

    it('Insertion.requestId', async () => {
      const promotedClient = newFakePromotedClient({});
      await expect(
        promotedClient.deliver({
          request: {
            ...newBaseRequest(),
            insertion: [
              {
                ...toInsertion(newProduct('3')),
                requestId: 'uuid0',
              },
              toInsertion(newProduct('2')),
              toInsertion(newProduct('1')),
            ],
          },
        })
      ).rejects.toEqual(new Error('Insertion.requestId should not be set'));
    });

    it('Insertion.insertionId', async () => {
      const promotedClient = newFakePromotedClient({});
      await expect(
        promotedClient.deliver({
          request: {
            ...newBaseRequest(),
            insertion: [
              {
                ...toInsertion(newProduct('3')),
                insertionId: 'uuid0',
              },
              toInsertion(newProduct('2')),
              toInsertion(newProduct('1')),
            ],
          },
        })
      ).rejects.toEqual(new Error('Insertion.insertionId should not be set'));
    });
  });
});
