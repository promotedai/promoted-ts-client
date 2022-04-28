# Using `got`

[got](https://github.com/sindresorhus/got#comparison) has some great benefits (HTTP/2) over other HTTP clients if your server can support it:
- Supports HTTP/2.  Requires NodeJS `>=15.10.0`.
- Only supports ESM (not CJS).  There is a `got-cjs`.  Promoted has not performed security checks on that package.
- Other libraries with http clients and global http settings can break `got`.

```typescript
import got from "got";

const apiClient = <Req, Res>(
  urlString: string,
  apiKey: string,
  timeout: number
) => async (requestBody: Req): Promise<Res> => {
  return got.post(
    urlString,
    {
      json: requestBody,
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
        "x-api-key": apiKey
      },
      // http2 needs Nodejs 15.10.0 and above.
      http2: true,
      timeout: {
        request: timeout
      }
    }
  ).json();
};
```
