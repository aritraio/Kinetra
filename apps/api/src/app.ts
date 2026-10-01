import { generationRequestSchema, protocolVersion, streamEventSchema } from '@kinetra/contracts';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { ApiFailure, reserveBudget, requireLocalWrites, verifyIdentity } from './security';
import { z } from 'zod';
import { secureHeaders } from 'hono/secure-headers';
import { streamSSE } from 'hono/streaming';
import type { ApiEnvironment } from './env';
import { appRouter } from './router';

export function createApp(env: ApiEnvironment, http: typeof fetch = fetch) {
  const app = new Hono();
  app.use('*', secureHeaders({ referrerPolicy: 'no-referrer', xFrameOptions: 'DENY' }));
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Request-Id', crypto.randomUUID());
    if (c.req.header('Origin') && c.req.header('Origin') !== env.WEB_ORIGIN)
      return c.json({ code: 'FORBIDDEN', message: 'Origin denied' }, 403);
    if (
      ['X-API-Key', 'X-Gemini-Key', 'X-Provider-Key', 'X-Model', 'X-Provider-Endpoint'].some(
        (name) => c.req.header(name),
      )
    )
      return c.json(
        { code: 'BAD_REQUEST', message: 'Client provider configuration is not accepted' },
        400,
      );
    await next();
  });
  app.use(
    '/api/*',
    bodyLimit({ maxSize: 16384, onError: (c) => c.json({ code: 'PAYLOAD_TOO_LARGE' }, 413) }),
  );
  app.use(
    '/api/*',
    cors({
      origin: env.WEB_ORIGIN,
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  );
  app.get('/api/health', (c) => c.json({ status: 'ok', phase: 2, environment: env.KINETRA_ENV }));
  app.all('/api/trpc/*', (c) =>
    fetchRequestHandler({
      endpoint: '/api/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: async () => {
        let identity = null;
        let authFailure = null;
        const header = c.req.header('Authorization');
        if (header) {
          try {
            identity = await verifyIdentity(header, env, http);
          } catch (error) {
            authFailure =
              error instanceof ApiFailure
                ? error
                : new ApiFailure('UNAVAILABLE', 'Account service unavailable');
          }
        }
        return {
          hasBearerHeader: /^Bearer \S+$/.test(header ?? ''),
          identity,
          authFailure,
          env,
          requestId: c.res.headers.get('X-Request-Id') ?? crypto.randomUUID(),
          http,
        };
      },
    }),
  );
  // Public, fixed synthetic output. No AI provider, user context, or persistence.
  app.get('/api/stream/foundation', (c) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Accel-Buffering', 'no');
    return streamSSE(c, async (stream) => {
      const send = async (data: unknown) => {
        const event = streamEventSchema.parse(data);
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      };
      await send({ type: 'started', protocolVersion });
      for (const text of ['Typed contracts. ', 'Cancellable streaming. ', 'Foundation ready.']) {
        if (stream.aborted) return;
        await stream.sleep(100);
        if (stream.aborted) return;
        await send({ type: 'text_delta', text });
      }
      if (!stream.aborted) await send({ type: 'done' });
    });
  });
  const protectedDisabled = async (c: import('hono').Context) => {
    if (c.req.method !== 'POST')
      return c.json({ code: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'POST' });
    await verifyIdentity(c.req.header('Authorization'), env, http);
    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      return c.json({ code: 'BAD_REQUEST' }, 400);
    }
    if (!generationRequestSchema.safeParse(input).success)
      return c.json({ code: 'BAD_REQUEST' }, 400);
    return c.json({ code: 'NOT_IMPLEMENTED', message: 'AI generation is not enabled' }, 501);
  };
  app.all('/api/plans/generate', protectedDisabled);
  app.all('/api/stream/coach', protectedDisabled);
  app.all('/api/plans/*', (c) => c.json({ code: 'NOT_FOUND' }, 404));
  app.post('/api/security/quota-probe', async (c) => {
    requireLocalWrites(env);
    const identity = await verifyIdentity(c.req.header('Authorization'), env, http);
    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      return c.json({ code: 'BAD_REQUEST' }, 400);
    }
    if (!z.strictObject({}).safeParse(input).success) return c.json({ code: 'BAD_REQUEST' }, 400);
    return c.json({ lease: await reserveBudget(env, identity, http) });
  });
  app.onError((error, c) => {
    if (error instanceof ApiFailure) {
      const status = {
        UNAUTHENTICATED: 401,
        FORBIDDEN: 403,
        UNAVAILABLE: 503,
        CONFLICT: 409,
        BAD_REQUEST: 400,
        RATE_LIMITED: 429,
      } as const;
      return c.json({ code: error.code, message: error.message }, status[error.code]);
    }
    return c.json({ code: 'INTERNAL_ERROR', message: 'Request failed' }, 500);
  });
  return app;
}
