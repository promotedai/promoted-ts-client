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

PromotedClient avoids having direct http client dependencies so customers have more options for customization and can keep dependencies smaller.

```typescript
import { logOnError, newPromotedClient, throwOnError } from 'promoted-ts-client';
import { v5 as uuid } from 'uuid';

// See section below.
const apiClient = ...;

// These values will vary depending on whether you are integrating with Promote's dev or prod environment.
const deliveryApi = 'https://....com/...';
const deliveryApiKey = 'LongString1';
const deliveryTimeoutMillis = 250;
const metricsApi = 'https://....com/...';
const metricsApiKey = 'LongString2';
const metricsTimeoutMillis = 3000;

// NextJS example.  For errors, if inDev then throw else log.
const throwError =
  process?.env?.NODE_ENV !== 'production' ||
  (typeof location !== "undefined" && location?.hostname === "localhost");

export const promotedClient = newPromotedClient({
  // TODO - Customize handleError for your server.
  // When developing using Node.js, throwOnError will give a scary unhandled promise warning.
  handleError: throwError ? throwOnError : logOnError,
  deliveryClient: apiClient(deliveryApi, deliveryApiKey, deliveryTimeoutMillis),
  metricsClient: apiClient(metricsApi, metricsApiKey, metricsTimeoutMillis),
  uuid,
  deliveryTimeoutMillis,
  metricsTimeoutMillis,
});
```

For HTTP clients:
- `node-fetch` has good latency but takes a little more work to setup.  Make sure to test out the timeout logic.
- `axios` is a little slower but is easier to setup.
- `got` is harder to setup but provides `HTTP/2` support.

### Using `node-fetch`

`node-fetch` can be slightly faster than `axios`.

```typescript
import fetch from "node-fetch";
import https from "https";

const agent = new https.Agent({
  keepAlive: true,
  // You need to optimize this.
  maxSockets: 50,
});

const apiClient = <Req, Res>(
  url: string,
  apiKey: string,
  timeoutMs: number
) => async (request: Req): Promise<any> => {
  // AbortController was added in node v14.17.0 globally.
  // This can brought in as a normal import too.
  const AbortController = globalThis.AbortController || await import('abort-controller')

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
        "x-api-key": apiKey
      },
      agent,
      signal: controller.signal,
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Promoted ${name} API call failed; response=${responseText}`);
    }
    return responseText;
  } finally {
    clearTimeout(timeout);
  }
};
```

### Using `axios`

[Axios example](axios.md)

### Using `got`

[got example](got.md)

### Optimization - DNS cache

```typescript
// `szmarczak/cacheable-lookup` is owned by the same person as `got`.
import CacheableLookup from "cacheable-lookup";

// https://github.com/szmarczak/cacheable-lookup/blob/master/README.md#api
const cacheable = new CacheableLookup({
    lookup: false,
    // TODO - review other options.
});

cacheable.install(httpsAgent);
```

### Client Configuration Parameters

| Name                        | Type                                                           | Description                                                                                                                                                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deliveryClient`            | ApiClient                                                      | API client to make a POST request to the Delivery API endpoint including the `x-api-key` header, endpoint and header value obtained from Promoted |
| `metricsClient`             | ApiClient                                                      | API client to make a POST request to the Delivery API endpoint including the `x-api-key` header, endpoint and header value obtained from Promoted |
| `performChecks`             | Boolean                                                        | Whether or not to perform detailed input validation, defaults to true but may be disabled for performance |
| `shadowTrafficDeliveryRate` | Number between 0 and 1                                         | % of traffic that gets directed to Delivery API as "shadow traffic". Only applies to cases where Delivery API is not called. Defaults to 0 (no shadow traffic). |
| `blockingShadowTraffic`     | Boolean                                                        | Option to make shadow traffic a blocking (as opposed to background) call to delivery API, defaults to False. |
| `defaultRequestValues`      | BaseRequest                                                    | Default values to use on every request. Only supports `onlyLog` setting. |
| `handleError`               | `(err: Error) => void`                                         | A handler for errors that are encountered.  Can be used to log or throw on error.  See examples in this README for example values. |
| `validationArguments`       | ValidationArguments (Optional)                                 | A config that specifies which SDK-side validations to run. |
| `deliveryTimeoutMillis`     | Number                                                         | Timeout on the Delivery API call. Defaults to 250. |
| `metricsTimeoutMillis`      | Number                                                         | Timeout on the Metrics API call. Defaults to 3000. |
| `shouldApplyTreatment`      | `(cohortMembership: CohortMembership \| undefined) => boolean` | Called during delivery, accepts an experiment and returns a Boolean indicating whether the request should be considered part of the control group (false) or in the treatment arm of an experiment (true). If not set, the default behavior of checking the experiement `arm` is applied. |
| `maxRequestInsertions`      | Number                                                         | Maximum number of request insertions that will be passed to Delivery API on a single request (any more will be truncated by the SDK). Defaults to 1000. |

## Data Types

### ApiClient

Wrapper for API clients used to make Delivery and Metrics API calls to Promoted.  Return either the response as a JSON string or parsed object.

```typescript
export interface ApiClient<Req> {
  (request: Req): Promise<any>;
}
```

---

### ValidationArguments

Configures the SDK-side validator.
Field Name | Type | Optional? | Description
---------- | ---- | --------- | -----------
`validateLogUserIdSet` | Boolean | Yes | If set to false, skips this validation check.  Otherwise, runs the validation check.

---

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
`referrer` | String | Yes | Request referrer

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
`request` | Request | No | The underlying request for content. Request insertions need to be set on `request`.
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

| Method    | Input           | Output         | Description                                                                                                                                                                                                                                       |
| --------- | --------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deliver` | DeliveryRequest | ClientResponse | Can be used to (1) `onlyLog` Requests to Metrics API or (2) call Delivery API. Supports calling as shadow traffic, as an experiment or 100% launched. Clients must call `ClientResponse.log()` after calling `deliever` to log remaining records. |

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
/**
 * @param userInfo { userId, logUserId, isInternalUser }
 * @return Product[].  This code will set `Product.insertionId`.
 */
async function callPromoted(
    products: Product[],
    userInfo: UserInfo): Promise<Product[]> {
  const responsePromise = promotedClient.deliver({
    // onlyLog: true - if you want to only log to Promoted.
    request: {
      userInfo,
      useCase: 'FEED',
      // TODO - add `query` for the search query.
      properties: {
        struct: {
          // TODO - Add user, request and context features.
          // TODO - Add request filters.  The properties are used to generate a paging key that is used for caching.
        }
      },
      insertion: products.map((product, retrievalRank) => ({
        contentId: product.id,
        retrievalRank,
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
      map[product.id] = {...product};
      return map;
  }, {});
  const clientResponse = await responsePromise;
  // Do not block.  Log asynchronously.
  clientResponse.log().catch(handleError);
  // Also adds `insertionId` field to the product.
  return toContents<Product>(
      clientResponse.responseInsertions,
      productIdToProduct
  );
}
```

## Logging only

You can use `deliver` but add a `onlyLog: true` property.

## Pagination

When calling `deliver` with `onlyLog=false`, we expect that you will pass an unpaged (complete) list of insertions, and the SDK assumes this to be the case. To help you catch this scenario, the SDK will call handleError in the pre-paged case if performChecks is turned on.

When calling `deliver` with `onlyLog=true` and shadow traffic turned on, we also expect an unpaged list of insertions, since in this case we are simulating delivery.

When you want to send a different server-side page of Request Insertions, you'll want to set `insertionStart`.

### `insertionStart`

Clients can send a subset of all request insertions to Promoted on `request.insertion`.  The `insertionStart` specifies the start index of the array `request.insertion` in the list of all request insertions.

`request.paging.offset` should be set to the zero-based position in all request insertions (not the relative position in `request.insertion`s).

Examples:
1. If there are 10 items and all 10 items are in `request.insertion`, then insertionStart=0.
2. If there are 10,000 items and the first 500 items are on `request.insertion`, then insertionStart=0.
3. If there are 10,000 items and we want to send items [500,1000) on `request.insertion`, then insertionStart=500.
4. If there are 10,000 items and we want to send the last page [9500,10000) on `request.insertion`, then insertionStart=9500.

This field is required because an incorrect value could result in a bad bug.  If you only send the first X request insertions, then insertionStart=0.

If you are only sending the first X insertions to Promoted, you can set insertionStart=0.

For now, Promoted requires that `insertionStart <= paging.offset`.  This will reduce the chance of errors and allow the SDK to fallback to

Promoted recommends that the block size is a multiple of the page size.  This reduces the chance of page size issues.

Follow [this link](https://docs.promoted.ai/docs/ranking-requests#sending-even-more-request-insertions) for more details.  If you have questions, reach out to Promoted's support team.

### Position

Do not set the insertion `position` field in client code. The SDK and Delivery API will set it when `deliver` is called.

Clients are responsible for setting `retrievalRank`.

If you want to log using paginated data, please review the `# insertionStart` section.


### Experiments

Promoted supports the ability to run Promoted-side experiments. Sometimes it is useful to run an experiment in your where `promoted-ts-client` is integrated (e.g. you want arm assignments to match your own internal experiment arm assignments).

```typescript
// Create a small config indicating the experiment is a 50-50 experiment where 10% of the users are activated.
const experimentConfig = twoArmExperimentConfig5050("promoted-v1", 5, 5);

async function callPromoted(
    products: Product[],
    userInfo: UserInfo): Promise<Insertion[]> {

  // logUserId is the anonymous user id from the request.
  const experimentMembership = twoArmExperimentMembership(userInfo.logUserId, experimentConfig);

  const responsePromise = promotedClient.deliver({
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

  return ...
}
```

Here's an example using custom arm assignment logic (not using `twoArmExperimentConfig5050`).

```typescript
// Or use your own custom experiment memberships (e.g. `getExperimentActivationAndArm`)
// and send Promoted:
// (1) if the user is activated into the experiment and
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

### Advanced example

Here's a more complex example that supports:
- Running an experiment.
- Separate configuration for internal users.
- Also supports skipping the experiment and only logging (or only calling Delivery API)
  through the same method.

```typescript
/**
 * @param userInfo { userId, logUserId, isInternalUser }
 * @param overrideOnlyLog If set, skips the experiment and forces the onlyLog option.
 */
async function callPromoted(
    products: Product[],
    userInfo: UserInfo,
    overrideOnlyLog : boolean | undefined): Promise<Insertion[]> {

  let onlyLog: boolean | undefined = undefined;
  let experiment: CohortMembership | undefined = undefined;
  if (overrideOnlyLog != undefined) {
    onlyLog = overrideOnlyLog;
    // Do not specify experiment when overrideOnlyLog is specified.
  } else if (userInfo.isInternalUser) {
    // Call Promoted Delivery API for internal users.
    onlyLog = false;
    // Keep experiment undefined for internal users.
  } else {
    // Normal external user for a call that should run as an experiment.
    experiment = twoArmExperimentMembership(logUserId, experimentConfig);
  }

  const responsePromise = promotedClient.deliver({
    onlyLog,
    experiment,
    request: {
      userInfo,
      ...
    },
  });

  // Construct the map while the RPC is happening.
  const productIdToProduct = products.reduce((map, product) => {
      map[product.id] = {...product};
      return map;
  }, {});
  const clientResponse = await responsePromise;
  // Do not block.  Log asynchronously.
  clientResponse.log().catch(handleError);
  return toContents<Product>(
      clientResponse.responseInsertions,
      productIdToProduct
  );
}
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
