import { serve } from '@hono/node-server';
import { createApp } from './app';
import { readEnvironment } from './env';
const env = readEnvironment(process.env);
const server = serve(
  { fetch: createApp(env).fetch, port: env.PORT, hostname: '127.0.0.1' },
  (info) => {
    console.log(`Kinetra API: http://127.0.0.1:${info.port}`);
  },
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close());
