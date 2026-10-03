import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../apps/api/src/router';
import { consumeStream } from '../apps/web/src/stream';

const PREVIEW_PORT = 4173;
const API_PORT = 3001;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}/api`;

async function isPortOpen(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(url)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function main() {
  console.log('--- Starting Preview & Deployment Spike Verification ---');

  let apiProc: ChildProcess | null = null;
  let previewProc: ChildProcess | null = null;

  try {
    // 1. Ensure API is running
    const apiRunning = await isPortOpen(`${API_URL}/health`);
    if (!apiRunning) {
      console.log('Spawning API server on port 3001...');
      apiProc = spawn('node', ['--import', 'tsx', 'apps/api/src/dev.ts'], {
        stdio: 'pipe',
        env: { ...process.env, PORT: '3001', NODE_ENV: 'production', KINETRA_ENV: 'development' },
      });
      await waitForServer(`${API_URL}/health`);
    } else {
      console.log('Reusing active API server on port 3001');
    }

    // 2. Spawn Vite preview server
    console.log('Spawning Vite preview server on port 4173...');
    previewProc = spawn('pnpm', ['--filter', '@kinetra/web', 'preview'], {
      stdio: 'pipe',
    });
    await waitForServer(PREVIEW_URL);

    // 3. Verify Preview CSP and Security Headers (P2-06)
    console.log('Verifying Preview CSP and security headers...');
    const indexRes = await fetch(PREVIEW_URL);
    assert.equal(indexRes.status, 200, 'Preview index returned 200');

    const csp = indexRes.headers.get('content-security-policy') ?? '';
    assert.ok(csp.includes("default-src 'none'"), 'CSP contains default-src none');
    assert.ok(csp.includes("script-src 'self'"), 'CSP contains script-src self');
    assert.ok(
      !csp.includes("script-src 'self' 'unsafe-inline'"),
      'Preview CSP strictly excludes unsafe-inline scripts',
    );
    assert.ok(
      !csp.includes("style-src 'self' 'unsafe-inline'"),
      'Preview CSP strictly excludes unsafe-inline styles',
    );
    assert.ok(csp.includes("object-src 'none'"), 'CSP contains object-src none');
    assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP contains frame-ancestors none');
    assert.ok(csp.includes("form-action 'self'"), 'CSP contains form-action self');
    assert.ok(csp.includes("connect-src 'self'"), 'CSP contains connect-src self');

    const referrer = indexRes.headers.get('referrer-policy');
    assert.equal(referrer, 'no-referrer', 'Referrer-Policy is no-referrer');

    // 4. Verify Typed tRPC transport and auth headers through preview proxy (P1-04)
    console.log('Verifying typed tRPC transport through preview proxy...');
    const client = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${PREVIEW_URL}/api/trpc`,
          headers: { Authorization: 'Bearer preview-spike-token' },
        }),
      ],
    });

    const echoRes = await client.echo.query({ message: '  preview spike test  ' });
    assert.equal(echoRes.message, 'preview spike test');
    assert.equal(echoRes.protocolVersion, 1);

    const transportRes = await client.transport.query();
    assert.deepEqual(transportRes, { hasBearerHeader: true, authenticated: false });

    // 5. Verify Unsafe Payload (XSS) Handling (P2-06)
    console.log('Verifying safe handling of unsafe XSS payloads...');
    const xssPayload = '<img src=x onerror=alert(1)><script>alert("xss")</script>';
    const xssRes = await client.echo.query({ message: xssPayload });
    assert.equal(xssRes.message, xssPayload, 'Payload is safely echoed as plain text');

    // 6. Verify Dedicated SSE Stream & Event Framing (P1-04)
    console.log('Verifying dedicated SSE stream event framing...');
    const streamRes = await fetch(`${PREVIEW_URL}/api/stream/foundation`, {
      signal: AbortSignal.timeout(5000),
    });
    assert.ok(streamRes.ok, 'SSE response is OK');
    assert.ok(
      streamRes.headers.get('content-type')?.includes('text/event-stream'),
      'Content-type is text/event-stream',
    );

    const receivedEvents: string[] = [];
    let receivedText = '';
    await consumeStream(streamRes, (event) => {
      receivedEvents.push(event.type);
      if (event.type === 'text_delta') receivedText += event.text;
    });

    assert.deepEqual(
      receivedEvents,
      ['started', 'text_delta', 'text_delta', 'text_delta', 'done'],
      'SSE stream delivers complete framed lifecycle',
    );
    assert.ok(receivedText.includes('Foundation ready.'), 'SSE stream delivers complete text');

    // 7. Verify Stream Cancellation via AbortController (P1-04)
    console.log('Verifying client stream cancellation via AbortController...');
    const abortController = new AbortController();
    const cancellableRes = await fetch(`${PREVIEW_URL}/api/stream/foundation`, {
      signal: abortController.signal,
    });
    let abortedEarly = false;
    await assert.rejects(
      consumeStream(cancellableRes, (event) => {
        if (event.type === 'started') {
          abortedEarly = true;
          abortController.abort();
        }
      }),
      (err: Error) => err.name === 'AbortError' || err.message.includes('aborted'),
    );
    assert.ok(abortedEarly, 'Cancellation triggered on started event');

    // 8. Verify Hosting Timeout Behavior (P1-04)
    console.log('Verifying hosting timeout behavior via AbortSignal.timeout...');
    const timeoutRes = await fetch(`${PREVIEW_URL}/api/stream/foundation`, {
      signal: AbortSignal.timeout(150),
    });
    let timedOut = false;
    await assert.rejects(
      consumeStream(timeoutRes, () => {
        // Stream emits events at ~100ms intervals, so 150ms should trigger timeout
      }),
      (err: Error) => {
        timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
        return true;
      },
    );
    assert.ok(timedOut, 'Stream aborted on timeout constraint');

    console.log(' All Preview & Deployment Spike verifications passed successfully!');
  } finally {
    if (previewProc) {
      previewProc.kill('SIGTERM');
    }
    if (apiProc) {
      apiProc.kill('SIGTERM');
    }
  }
}

void main();
