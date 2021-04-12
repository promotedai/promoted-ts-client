# promoted-ts-client

A Typescript Client to contact Promoted APIs.  This is primarily intended to be used when logging `Request`s and `Insertion`s on a Node.js server.

Client logging libraries:
- [promoted-ts-client](https://github.com/promotedai/promoted-ts-client) - for logging `Request`s and `Insertion`s from your server.
- [promoted-snowplow-logger](https://github.com/promotedai/promoted-snowplow-logger) - for logging events from a browser.
- [ios-metrics-sdk](https://github.com/promotedai/ios-metrics-sdk) - for iOS logging.

## Creating a PromotedClient

We recommend creating a PromotedClient in a separate file so it can be reused.

PromotedClient avoids having direct dependencies so customer's have more options for customization and can keep dependencies smaller.

promotedClient.js
```
import { logOnError, newPromotedClient, throwOnError } from 'promoted-ts-client';
import { v5 as uuid } from 'uuid';
import axios from 'axios';

// Client can choose their preferred RPC client.
const axiosApiClient = <Req, Res>(url: string, apiKey: string, timeout: number) => (request: Req): Promise<Res> =>
  axios.post(
    url,
    request,
    {
      headers: {
        "x-api-key": apiKey,
      },
      timeout,
    });

// These values will vary depending on dev vs prod.
const deliveryApi = 'https://....com/...';
const deliveryApiKey = 'AbCSomeRLongString1';
const deliveryTimeoutMillis = 250;
const metricsApi = 'https://....com/...';
const metricsApiKey = 'AbCSomeRLongString2';
const metricsTimeoutMillis = 3000;

// NextJS example.  For errors, if inDev then throw else log.
const throwError =
  process?.env?.NODE_ENV !== 'production' ||
  (typeof location !== "undefined" && location?.hostname === "localhost");

export const promotedClient = newPromotedClient({
  handleError: throwError ? throwOnError : logOnError;
  deliveryClient: axiosApiClient(deliveryApi, deliveryApiKey, deliveryTimeoutMillis),
  metricsClient: axiosApiClient(metricsApi, metricsApiKey, metricsTimeoutMillis),
  uuid,
  deliveryTimeoutMillis,
  metricsTimeoutMillis,
});
```

## Calling our Delivery API

Let's say the previous code looks like this:
```
static async getProducts(req: any, res: Response) {
  const products = ...; // Logic to get products from DB, apply filtering, etc.
  sendSuccessToClient(res, { products });
}
```

We would modify to something like this:
```
static async getProducts(req: any, res: Response) {
  const products = ...;
  const response = await promotedClient.deliver({
    request: {
      userInfo: {
        logUserId: req.logUserId,
      },
      useCase: 'FEED',
      sessionId: req.sessionId,
      viewId: req.viewId,
    },
    fullInsertions: products.map(product => ({
      // Must be filled in.
      contentId: product.id,
      // You can set custom properties here.
      properties: {
        struct: {
          product,
        },
      },
    })),
  });
  // Change the result Product list to use the values in the returned Insertions.
  sendSuccessToClient(res, {
    products: response.insertion.map(insertion => insertion.properties.struct.product),
  });
  await response.log();
}
```

There are other optional options.

| Argument | Type | Default Value | Description |
| --- | --- | --- | --- |
| `onlyLog` | `boolean` | `false` | Can be used to conditionally disable deliver per request |
| `toCompactDeliveryInsertion` | `Insertion => Insertion` | Returns the argument | Can be used to strip out fields being passed into Delivery API |
| `toCompactMetricsInsertion` | `Insertion => Insertion` | Returns the argument | Can be used to strip out fields being passed into Metrics API |

## Logging only

There are two ways of doing this with `PromotedClient`:
1. You can use `deliver` but add a `shouldOptimize: false` property.
2. You can use `prepareForLogging` method call instead.  The `prepareForLogging` signature is similar to `deliver` and should be integrated the same way.

# Improving this library

## Tech used

Uses
- [TypeScript](https://www.typescriptlang.org/) support
- [React](https://reactjs.org/) support
- [ESLint](https://eslint.org/) (with [React](https://reactjs.org/) and [Prettier](https://prettier.io/))
- Unit tests ([Jest](https://jestjs.io/) and [Testing Library](https://testing-library.com/))
- Minified output with [Terser](https://terser.org/)
- Bundle size validation with [size-limit](https://github.com/ai/size-limit)
- Flexible builds with [Rollup](https://www.rollupjs.org/)
- [CHANGELOG.md](https://keepachangelog.com/en/1.0.0/) template

## Scripts

- Run most commands: `npm run finish`
- Build the project: `npm run build`
  - Validate output bundle size with `npm run size`
- Lint the project: `npm run lint`
- Run unit tests: `npm test` or `npm test`

## When developing locally

If you want to test local changes in an actual deployment, use `npm link`.

1. Make sure your npm uses the same version as the client directory.
1. Run `npm run updatelink`.
1. Go to client directory and run `npm link promoted-ts-client`.

When you update `promoted-ts-client`, run `npm run updatelink`.

When you want to undo, run `npm run unlink` in this directory and `npm unlink promoted-ts-client` in the client directory.

## Deploy

We use a GitHub action that runs semantic-release to determine how to update versions.  Just do a normal code review and this should work.  Depending on the message prefixes (e.g. `feat: `, `fix: `, `clean: `, `docs: `), it'll update the version appropriately.

# Resources

The base of this repository is a combination of the following repos:
- https://github.com/DenysVuika/react-lib
- https://github.com/Alexandrshy/como-north and https://dev.to/alexandrshy/creating-a-template-repository-in-github-1d05
