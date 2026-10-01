import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { rpc } from './client';
import { webEnvironment } from './env';
import { consumeStream } from './stream';
import './styles.css';
import { AccountPanel } from './account';

function Foundation() {
  const echo = useQuery({
    queryKey: ['foundation'],
    queryFn: () => rpc.echo.query({ message: 'Kinetra is connected.' }),
    retry: false,
  });
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Ready');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function startStream() {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setText('');
    setStatus('Streaming');
    try {
      const response = await fetch(`${webEnvironment.VITE_API_BASE_URL}/stream/foundation`, {
        signal: active.signal,
      });
      await consumeStream(response, (event) => {
        if (active.signal.aborted) return;
        if (event.type === 'text_delta') setText((value) => value + event.text);
        if (event.type === 'done') setStatus('Complete');
      });
    } catch {
      if (controller.current === active)
        setStatus(active.signal.aborted ? 'Cancelled' : 'Stream failed. Start again to retry.');
    }
  }
  return (
    <main>
      <header>
        <span className="wordmark">KINETRA</span>
        <span className="phase">PHASE 02 / SECURITY</span>
      </header>
      <section>
        <p className="eyebrow">A clear starting point</p>
        <h1>
          Build on something
          <br />
          you can verify.
        </h1>
        <p className="intro">
          The typed web and API foundation is ready to inspect. Fitness planning arrives in the next
          phases.
        </p>
      </section>
      <section className="instrument">
        <h2>Connection</h2>
        <p role="status">
          {echo.isPending
            ? 'Connecting…'
            : echo.isError
              ? 'API unavailable. Start both services and retry.'
              : echo.data?.message}
        </p>
        <button type="button" onClick={() => void echo.refetch()}>
          Check connection
        </button>
      </section>
      <section className="instrument">
        <h2>Stream transport</h2>
        <p>This is a fixed synthetic response. It uses no AI provider or account data.</p>
        <p role="status">{status}</p>
        <output>{text || 'Your stream will appear here.'}</output>
        <div className="actions">
          <button
            type="button"
            onClick={() => void startStream()}
            disabled={status === 'Streaming'}
          >
            Start stream
          </button>
          <button
            type="button"
            onClick={() => controller.current?.abort()}
            disabled={status !== 'Streaming'}
          >
            Cancel
          </button>
        </div>
      </section>
      <AccountPanel />
      <footer>
        Verified identity · Local synthetic development · AI and photo collection disabled
      </footer>
    </main>
  );
}
const rootRoute = createRootRoute();
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Foundation,
});
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) });
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
