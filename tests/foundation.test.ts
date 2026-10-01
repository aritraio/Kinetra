import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import { describe, expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app';
import { readEnvironment } from '../apps/api/src/env';
import type { AppRouter } from '../apps/api/src/router';
import { readWebEnvironment } from '../apps/web/src/env';
import { consumeStream } from '../apps/web/src/stream';
import { echoMessage } from '../packages/domain/src/index';
import { checkSource } from '../scripts/check-boundaries';
import { scanText } from '../scripts/scan-web';

const app = createApp(readEnvironment({ NODE_ENV: 'test' }));
const rpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost/api/trpc',
      headers: { Authorization: 'Bearer test-transport-only' },
      fetch: async (input, init) => app.fetch(new Request(input, init as RequestInit)),
    }),
  ],
});

describe('typed contract boundary', () => {
  it('roundtrips validated input through the actual fetch adapter', async () => {
    expect(await rpc.echo.query({ message: '  hello  ' })).toEqual({
      message: 'hello',
      protocolVersion: 1,
    });
    expect(await rpc.transport.query()).toEqual({ hasBearerHeader: true, authenticated: false });
  });
  it('rejects invalid input and unknown client keys', async () => {
    await expect(rpc.echo.query({ message: '' })).rejects.toBeInstanceOf(TRPCClientError);
    expect(() => echoMessage({ message: 'hello', apiKey: 'bad' })).toThrow();
    expect(() => echoMessage({ message: 123 })).toThrow();
  });
  it('keeps real generation routes disabled', async () => {
    expect((await app.request('/api/plans/generate', { method: 'POST' })).status).toBe(401);
    expect((await app.request('/api/stream/coach', { method: 'POST' })).status).toBe(401);
  });
  it('allows only the configured browser origin', async () => {
    const response = await app.request('/api/health', {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(response.headers.get('access-control-allow-origin')).not.toBe(
      'https://untrusted.example',
    );
  });
});

describe('environment validation', () => {
  it('boots locally without secrets and fails closed outside development', () => {
    expect(readEnvironment({}).PORT).toBe(3001);
    expect(() =>
      readEnvironment({ KINETRA_ENV: 'preview', WEB_ORIGIN: 'https://preview.example' }),
    ).toThrow('Missing API environment');
    expect(() => readEnvironment({ NODE_ENV: 'production' })).toThrow('KINETRA_ENV');
  });
  it('reports variable names without private values', () => {
    expect(() => readEnvironment({ PORT: 'private-sentinel' })).toThrow(
      'Invalid API environment: PORT',
    );
    expect(() => readWebEnvironment({ VITE_API_BASE_URL: 'javascript:private-sentinel' })).toThrow(
      'Invalid web environment: VITE_API_BASE_URL',
    );
  });
});

function chunkedResponse(content: string, chunkSize = 1) {
  const bytes = new TextEncoder().encode(content);
  let cursor = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (cursor >= bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(cursor, cursor + chunkSize));
        cursor += chunkSize;
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}
describe('SSE protocol', () => {
  it('consumes the finite Hono stream and validates terminal state', async () => {
    const types: string[] = [];
    await consumeStream(await app.request('/api/stream/foundation'), (event) =>
      types.push(event.type),
    );
    expect(types).toEqual(['started', 'text_delta', 'text_delta', 'text_delta', 'done']);
  });
  it('handles Unicode and CRLF framing split across arbitrary byte chunks', async () => {
    let text = '';
    await consumeStream(
      chunkedResponse(
        'data: {"type":"text_delta","text":"café 💪"}\r\n\r\ndata: {"type":"done"}\r\n\r\n',
      ),
      (event) => {
        if (event.type === 'text_delta') text += event.text;
      },
    );
    expect(text).toBe('café 💪');
  });
  it('rejects truncated or malformed streams', async () => {
    await expect(
      consumeStream(chunkedResponse('data: {"type":"text_delta","text":"partial"}\n\n'), () => {}),
    ).rejects.toThrow('before completion');
    await expect(
      consumeStream(chunkedResponse('data: {"type":"unknown"}\n\n'), () => {}),
    ).rejects.toThrow();
  });
});

describe('build safety gates', () => {
  it('rejects runtime server imports, dynamic loads and relative escapes', () => {
    for (const code of [
      "import { appRouter } from '@kinetra/api/router';",
      "await import('@kinetra/db');",
      "import '../../../api/src/env';",
    ]) {
      expect(checkSource('apps/web/src/client.ts', code)).not.toEqual([]);
    }
    expect(
      checkSource(
        'apps/web/src/client.ts',
        "import type { AppRouter } from '@kinetra/api/router';",
      ),
    ).toEqual([]);
    expect(checkSource('packages/domain/src/index.ts', "import React from 'react';")).not.toEqual(
      [],
    );
  });
  it('detects a seeded server secret in browser output', () => {
    expect(scanText('const secret = "kinetra-build-sentinel-private"')).toEqual([
      'kinetra-build-sentinel-private',
    ]);
    expect(scanText('public fixture')).toEqual([]);
  });
});
