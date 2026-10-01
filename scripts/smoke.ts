import assert from 'node:assert/strict';
import type { AppRouter } from '../apps/api/src/router';
import { consumeStream } from '../apps/web/src/stream';
import { createTRPCClient, httpBatchLink } from '@trpc/client';

const base = process.argv[2] ?? 'http://127.0.0.1:3001/api';
const url = new URL(base);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Expected an HTTP API URL');
const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${base}/trpc`,
      headers: { Authorization: 'Bearer synthetic-transport-probe' },
    }),
  ],
});
assert.equal(
  (await client.echo.query({ message: ' transport probe ' })).message,
  'transport probe',
);
assert.deepEqual(await client.transport.query(), { hasBearerHeader: true, authenticated: false });
let text = '';
let done = false;
await consumeStream(
  await fetch(`${base}/stream/foundation`, { signal: AbortSignal.timeout(5000) }),
  (event) => {
    if (event.type === 'text_delta') text += event.text;
    if (event.type === 'done') done = true;
  },
);
assert.ok(done && text.includes('Foundation ready.'));
const controller = new AbortController();
const response = await fetch(`${base}/stream/foundation`, { signal: controller.signal });
await assert.rejects(
  consumeStream(response, (event) => {
    if (event.type === 'started') controller.abort();
  }),
);
console.log('Live typed request, bearer transport, SSE completion and cancellation passed.');
