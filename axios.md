# Using `axios`

`axios` provides an easier setup but other company benchmarks regularly show `node-fetch` provides lower latencies.

```typescript
import axios from 'axios';
import https from 'https';

// promoted-ts-client does not currently support warming up the connection.
const httpsAgent = new https.Agent({
  keepAlive: true,
  // You need to optimize this.
  maxSockets: 50,
});

const apiClient = <Req, Res>(url: string, apiKey: string, timeout: number) => async (request: Req): Promise<Res> => {
  const response = await axios.post(url, request, {
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
      'x-api-key': apiKey,
    },
    decompress: true,
    httpsAgent: httpsAgent,
    timeout: timeout,
  });
  return response.data;
};
```
