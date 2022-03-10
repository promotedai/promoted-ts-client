# promoted-ts-client

A Typescript Client to contact Promoted APIs. This is primarily intended to be used when logging `Request`s and `Insertion`s on a Node.js server.

Client logging libraries:

- [promoted-ts-client](https://github.com/promotedai/promoted-ts-client) - for logging `Request`s and `Insertion`s from your server.
- [promoted-snowplow-logger](https://github.com/promotedai/promoted-snowplow-logger) - for logging events from a browser.
- [ios-metrics-sdk](https://github.com/promotedai/ios-metrics-sdk) - for iOS logging.

## Features

- Demonstrates and implements the recommended practices and data types for calling Promoted's Metrics and Delivery APIs.
- Shadow traffic and an only-log option for ramping up a Promoted integration.
- Client-side position assignment and paging when not using results from Delivery API.

## Creating a PromotedClient

We recommend creating a PromotedClient in a separate file so it can be reused.

PromotedClient avoids having direct dependencies so customers have more options for customization and can keep dependencies smaller.

### `promotedClient.js`

```typescript
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

// These values will vary depending on whether you are integrating with Promote's dev or prod environment.
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
  // TODO - Customize handleError for your server.
  // When developing using Node.js, throwOnError will give a scary unhandled promise warning.
  handleError: throwError ? throwOnError : logOnError;
  deliveryClient: axiosApiClient(deliveryApi, deliveryApiKey, deliveryTimeoutMillis),
  metricsClient: axiosApiClient(metricsApi, metricsApiKey, metricsTimeoutMillis),
  uuid,
  deliveryTimeoutMillis,
  metricsTimeoutMillis,
});
```

### Client Configuration Parameters

| Name                           | Type                                                           | Description                                                                                                                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deliveryClient`               | ApiClient                                                      | API client to make a POST request to the Delivery API endpoint including the `x-api-key` header, endpoint and header value obtained from Promoted                                                                                                                                         |
| `metricsClient`                | ApiClient                                                      | API client to make a POST request to the Delivery API endpoint including the `x-api-key` header, endpoint and header value obtained from Promoted                                                                                                                                         |
| `performChecks`                | Boolean                                                        | Whether or not to perform detailed input validation, defaults to true but may be disabled for performance                                                                                                                                                                                 |
| `shadowTrafficDeliveryRate`    | Number between 0 and 1                                         | % of traffic that gets directed to Delivery API as "shadow traffic". Only applies to cases where Delivery API is not called. Defaults to 0 (no shadow traffic).                                                                                                                                                               |
| `defaultRequestValues`         | BaseRequest                                                    | Default values to use on every request. Only supports `onlyLog` setting.
| `deliveryTimeoutMillis`        | Number                                                         | Timeout on the Delivery API call. Defaults to 250.                                                                                                                                                                                                                                        |
| `metricsTimeoutMillis`         | Number                                                         | Timeout on the Metrics API call. Defaults to 3000.                                                                                                                                                                                                                                        |
| `shouldApplyTreatment`         | `(cohortMembership: CohortMembership \| undefined) => boolean` | Called during delivery, accepts an experiment and returns a Boolean indicating whether the request should be considered part of the control group (false) or in the treatment arm of an experiment (true). If not set, the default behavior of checking the experiement `arm` is applied. |
| `maxRequestInsertions`         | Number                                                         | Maximum number of request insertions that will be passed to Delivery API on a single request (any more will be truncated by the SDK). Defaults to 1000.                                                                                                                                   |

## Data Types

### ApiClient

Wrapper for API clients used to make Delivery and Metrics API calls to Promoted.

```typescript
export interface ApiClient<Req, Res> {
  (request: Req): Promise<Res>;
}
```

### UserInfo

Basic information about the request user.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`userId` | String | Yes | The platform user id, cleared from Promoted logs.
`logUserId` | String | Yes | A different user id (presumably a UUID) disconnected from the platform user id, good for working with unauthenticated users or implementing right-to-be-forgotten.
`isInternalUser` | Boolean | Yes | If this user is a test user or not, defaults to false.

---

### CohortMembership

Assigns a user to a group. This SDK uses it to assign users to experiment groups. Useful fields for experimentation during the delivery phase.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`userInfo` | UserInfo | Yes | The user info structure.
`cohortId` | String | No | The experiment name.
`arm` | String | No | 'CONTROL' or one of the TREATMENT values ('TREATMENT', 'TREATMENT1', etc.).

---

### Properties

Properties bag. Has the structure:

```typescript
  "struct": {
    "product": {
      "id": "product3",
      "title": "Product 3",
      "url": "www.mymarket.com/p/3"
      // other key-value pairs...
    }
  }
```

---

### Insertion

Content being served at a certain position.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`userInfo` | UserInfo | Yes | The user info structure.
`insertionId` | String | Yes | Generated by the SDK (_do not set_)
`requestId` | String | Yes | Generated by the SDK when needed (_do not set_)
`contentId` | String | No | Identifier for the content to be ranked, must be set.
`retrievalRank` | Number | Yes | Optional original ranking of this content item.
`retrievalScore` | Number | Yes | Optional original quality score of this content item.
`properties` | Properties | Yes | Any additional custom properties to associate. For v1 integrations, it is fine not to fill in all the properties.

---

### Size

User's screen dimensions.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`width` | Integer | No | Screen width
`height` | Integer | No | Screen height

---

### Screen

State of the screen including scaling.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`size` | Size | Yes | Screen size
`scale` | Float | Yes | Current screen scaling factor

---

### ClientHints

Alternative to user-agent strings. See https://raw.githubusercontent.com/snowplow/iglu-central/master/schemas/org.ietf/http_client_hints/jsonschema/1-0-0
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`isMobile` | Boolean | Yes | Mobile flag
`brand` | Array of ClientBrandHint | Yes |
`architecture` | String | Yes |
`model` | String | Yes |
`platform` | String | Yes |
`platformVersion` | String | Yes |
`uaFullVersion` | String | Yes |

---

### ClientBrandHint

See https://raw.githubusercontent.com/snowplow/iglu-central/master/schemas/org.ietf/http_client_hints/jsonschema/1-0-0
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`brand` | String | Yes | Mobile flag
`version` | String | Yes |

---

### Location

Information about the user's location.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`latitude` | Float | No | Location latitude
`longitude` | Float | No | Location longitude
`accuracyInMeters` | Integer | Yes | Location accuracy if available

---

### Browser

Information about the user's browser.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`user_agent` | String | Yes | Browser user agent string
`viewportSize` | Size | Yes | Size of the browser viewport
`clientHints` | ClientHints | Yes | HTTP client hints structure

---

### Device

Information about the user's device.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`deviceType` | one of (`UNKNOWN_DEVICE_TYPE`, `DESKTOP`, `MOBILE`, `TABLET`) | Yes | Type of device
`brand` | String | Yes | "Apple, "google", Samsung", etc.
`manufacturer` | String | Yes | "Apple", "HTC", Motorola", "HUAWEI", etc.
`identifier` | String | Yes | Android: android.os.Build.MODEL; iOS: iPhoneXX,YY, etc.
`screen` | Screen | Yes | Screen dimensions
`ipAddress` | String | Yes | Originating IP address
`location` | Location | Yes | Location information
`browser` | Browser | Yes | Browser information

---

### Paging

Describes a page of insertions
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`size` | Number | Yes | Size of the page being requested
`offset` | Number | Yes | Page offset

---

### Request

A request for content insertions.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`userInfo` | UserInfo | Yes | The user info structure.
`requestId` | String | Yes | Generated by the SDK when needed (_do not set_)
`useCase` | String | Yes | One of the use case enum values or strings, i.e. 'FEED', 'SEARCH', etc.
`properties` | Properties | Yes | Any additional custom properties to associate.
`paging` | Paging | Yes | Paging parameters
`device` | Device | Yes | Device information (as available)

---

### DeliveryRequest

Input to `deliver`, returns ranked insertions for display.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`experiment` | CohortMembership | Yes | A cohort to evaluation in experimentation.
`request` | Request | No | The underlying request for content.  Request insertions need to be set on `request`.
`onlyLog` | Boolean | Yes | Defaults to false. Set to true to log the request as the CONTROL arm of an experiment.

---

### LogRequest

Part of a `ClientResponse`, input to the Promoted Metrics API.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`request` | Request | No | The underlying request for content to log.
`insertion` | [] of Insertion | No | The insertions, which are either the original request insertions or the insertions resulting from a call to `deliver` if such call occurred.

---

### ClientResponse

Output of `deliver` includes the insertions as well as a suitable `LogRequest` for forwarding to Metrics API.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`responseInsertions` | [] of Insertion | No | The insertions, which are from Delivery API (when `deliver` was called, i.e. we weren't either only-log or part of an experiment) or the input insertions (when the other conditions don't hold).
`logRequest` | LogRequest | Yes | A message suitable for logging to Metrics API via a follow-up call to the `log()` method. If a call to `deliver` was made (i.e. the request was not part of the CONTROL arm of an experiment or marked to only log), `:logRequest` will not be set, as you can assume logging was performed on the server-side by Promoted.
`clientRequestId` | String | Yes | Client-generated request id sent to Delivery API and may be useful for logging and debugging. You may fill this in yourself if you have a suitable id, otherwise the SDK will generate one.
`executionServer` | one of 'API' or 'SDK' | Yes | Indicates if response insertions on a delivery request came from the API or the SDK.

---

### PromotedClient

| Method              | Input           | Output         | Description                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | --------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deliver`           | DeliveryRequest | ClientResponse | Can be used to (1) `onlyLog` Requests to Metrics API or (2) call Delivery API.  Supports calling as shadow traffic, as an experiment or 100% launched.  Clients must call `ClientResponse.log()` after calling `deliever` to log remaining records.
---

## Calling the Delivery API

Let's say the previous code looks like this:

```typescript
static async getProducts(req: any, res: Response) {
  const products = ...; // Logic to get products from DB, apply filtering, etc.
  sendSuccessToClient(res, { products });
}
```

We would modify to something like this:

```typescript
static async promotedDeliver(req: any, products: Product[], res: Response) {
  const responsePromise = promotedClient.deliver({
    // onlyLog: true - if you want to only log to Promoted.
    request: {
      userInfo: {
        logUserId: req.logUserId,
      },
      useCase: 'FEED',
      // TODO - add `query` for the search query.
      properties: {
        struct: {
          // TODO - Add user, request and context features.
          // TODO - Add request filters.  The properties are used to generate a paging key that is used for caching.
        }
      },
      insertion: products.map(product => ({
        contentId: product.id,
        properties: {
          struct: {
            // TODO - add user-item features here.
            // Example: "numReviews": product.numReviews,
          },
        },
      })),
    },
  });
  // Construct the map while the RPC is happening.
  const productIdToProduct = products.reduce((map, product) => {
      map[product.id] = product;
      return map;
  }, {});
  const clientResponse = await responsePromise;
  // Do not block.  Log asynchronously.
  clientResponse.log().catch(handleError);
  const responseProducts = toContents<Product>(
      clientResponse.insertion,
      productIdToProduct
  );

  // Change the response Product list to use the values in the returned Insertions.
  sendSuccessToClient(res, {
    products: responseProducts),
  });
}
```

## Logging only

You can use `deliver` but add a `onlyLog: true` property.

## Pagination

- When calling `deliver` with `onlyLog=false`, we expect that you will pass an unpaged (complete) list of insertions, and the SDK assumes this to be the case. To help you catch this scenario, the SDK will call handleError in the pre-paged case if performChecks is turned on.

- When calling `deliver` with `onlyLog=true` and shadow traffic turned on, we also expect an unpaged list of insertions, since in this case we are simulating delivery.

- When calling `deliver` with `onlyLog=true` otherwise, you may choose to pass "pre-paged" or "unpaged" insertions based on the `insertionPageType` field on the `MetricsRequest`.
  - When `insertionPageType` is "unpaged", the `Request.paging.offset` and `Request.paging.size` parameters are used to log a "window" of insertions.
  - When `insertionPageType` is "pre-paged", the SDK will not handle pagination of the insertions that are part of the resulting lot request.

### Position

Do not set the insertion `position` field in client code. The SDK and Delivery API will set it when `deliver` is called.

Clients are responsible for setting `retrievalRank`.

If you want to log using paginated data, you can use `insertionPageType=PrePaged` to log a page of data.  When calling using shadow traffic or blocking to Delivery API, `deliver` needs as many request insertions as can be sent (probably max of 1,000).
### Experiments

Promoted supports the ability to run Promoted-side experiments. Sometimes it is useful to run an experiment in your where `promoted-ts-client` is integrated (e.g. you want arm assignments to match your own internal experiment arm assignments).

```typescript
// Create a small config indicating the experiment is a 50-50 experiment where 10% of the users are activated.
const experimentConfig = twoArmExperimentConfig5050("promoted-v1", 5, 5);

static async getProducts(req: any, res: Response) {
  const products = ...;

  // This gets the anonymous user id from the request.
  const logUserId = getLogUserId(req);
  const experimentMembership = twoArmExperimentMembership(logUserId, experimentConfig);

  const response = await promotedClient.deliver({
    ...
    // If experimentActivated can be false (e.g. only 5% of users get put into an experiment) and
    // you want the non-activated behavior to not call Delivery API, then you need to specify onlyLog to false.
    // This is common during ramp up.  `onlyLog` can be dropped if it's always false.
    //
    // Example:
    // `onlyLog: experimentMembership == undefined`
    experiment: experimentMembership,
    ...
  });
  ...
}
```

Here's an example using custom arm assignment logic (not using `twoArmExperimentConfig5050`).

```typescript
// If you already use an experiment framework, it'll have the ability to return
// (1) if a user is activated into an experiment and
// (2) which arm to perform.
//
// [boolean, boolean]
const [experimentActivated, inTreatment] = getExperimentActivationAndArm(experimentName, logUserId);

// Only log if the user is activated into the experiment.
const experimentMembership = experimentActivated
  ? {
      cohortId: experimentName,
      arm: inTreatment ? 'TREATMENT' : 'CONTROL',
    }
  : null;
```

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

Based on the anticipated semantic-version, update the `SERVER_VERSION` constant in `client.ts`.

We use a GitHub action that runs semantic-release to determine how to update versions. Just do a normal code review and this should work. Depending on the message prefixes (e.g. `feat: `, `fix: `, `clean: `, `docs: `), it'll update the version appropriately.

# Resources

The base of this repository is a combination of the following repos:
- https://github.com/DenysVuika/react-lib
- https://github.com/Alexandrshy/como-north and https://dev.to/alexandrshy/creating-a-template-repository-in-github-1d05
