# promoted-ts-client

A Typescript Client to contact Promoted APIs.

## Creating a PromotedClient

We recommend creating a PromotedClient in a separate file so (1) it can be shared between files and (2) hides some of the configuration.

PromotedClient avoids having direct dependencies to certain implementation details so we can support customization and keep the binary small.

promotedClient.js
```
import { logOnError, newPromotedClient, throwOnError } from 'promoted-ts-client';
import { v5 as uuid } from 'uuid';
import axios from 'axios';

const axiosApiClient = <Req, Res>(url: string, apiKey: string, timeout: number) => (request: Req): Promise<Res> =>
  axios.post(
    url,
    request,
    {
      headers: {
        "x-api-key": apiKey,
      },
      timeout: 3000,
    });

// These values will vary depending on dev vs prod.
const deliveryApi = 'https://....com/...';
const deliveryApiKey = 'AbCSomeRLongString1';
const deliveryTimeoutMillis = 250;
const metricsApi = 'https://....com/...';
const metricsApiKey = 'AbCSomeRLongString2';
const metricsTimeoutMillis = 3000;

// NextJS example.  Throw in dev.  Console log in prod.
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
      insertion: products.map(product => ({
        contentId: product.id,
        properties: {
          struct: {
            product,
          },
        },
      })),
    },
  });
  // Change the result Product list to use the values in the returned Insertions.
  sendSuccessToClient(res, {
    products: response.insertion.map(insertion => insertion.properties.struct),
  });
  await response.finishAfterResponse();
}
```

There are a bunch of additional options.

# When modifying this library.

## Features

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

1. Run `npm run updatelink`.
4. Go to client directory and run `npm link promoted-ts-client`.

When you update `promoted-ts-client`, run `npm run updatelink`.

When you want to undo, run `npm run unlink` in this directory and `npm unlink promoted-ts-client` in the client directory.

## Deploy

We use a GitHub action that runs semantic-release to determine how to update versions.  Just do a normal code review and this should work.  Depending on the message prefixes (e.g. `feat: `, `fix: `, `clean: `, `docs: `), it'll update the version appropriately.

# Resources

The base of this repository is a combination of the following repos:
- https://github.com/DenysVuika/react-lib
- https://github.com/Alexandrshy/como-north and https://dev.to/alexandrshy/creating-a-template-repository-in-github-1d05
