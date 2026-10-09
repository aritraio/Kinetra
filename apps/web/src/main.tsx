import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountPanel } from './account';
import { rpc } from './client';
import { DemoHeader, type NavigationTab } from './components/DemoHeader';
import { webEnvironment } from './env';
import { MeasureView } from './features/MeasureView';
import { OnboardingView } from './features/OnboardingView';
import { PlanView } from './features/PlanView';
import { ProgressView } from './features/ProgressView';
import { TodayView } from './features/TodayView';
import { RepositoryProvider } from './repositories';
import { consumeStream } from './stream';
import { ThemeProvider } from './theme';
import './styles.css';

function FoundationPanel() {
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
    <div className="foundation-panel">
      <section className="hero-section">
        <p className="eyebrow">DEVELOPER & AUDITOR FOUNDATION</p>
        <h1>System Diagnostics</h1>
        <p className="intro">
          Verify typed tRPC transport, local SSE streaming, and local Supabase authentication.
        </p>
      </section>

      <section className="instrument card">
        <div className="card-header">
          <h2>API RPC Connection</h2>
          <span className="badge">Transport Check</span>
        </div>
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

      <section className="instrument card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h2>Stream Transport</h2>
          <span className="badge">SSE Verification</span>
        </div>
        <p>This is a fixed synthetic response. It uses no AI provider or account data.</p>
        <p role="status">
          Status: <strong>{status}</strong>
        </p>
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

      <div style={{ marginTop: '20px' }}>
        <AccountPanel />
      </div>
    </div>
  );
}

function KinetraApp() {
  // Read initial query params if present (?demo=marcus&tab=plan)
  const query = new URLSearchParams(window.location.search);
  const initialTab = (query.get('tab') as NavigationTab) || 'today';
  const initialPersona = query.get('demo') === 'marcus' ? 'marcus' : 'maya';

  const [activeTab, setActiveTab] = useState<NavigationTab>(initialTab);
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null);

  // Register service worker and listen for updates
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          if (registration.waiting) {
            setSwWaiting(registration.waiting);
          }
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setSwWaiting(newWorker);
                }
              });
            }
          });
        })
        .catch(() => {
          // Service worker unavailable or blocked
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const handleUpdateApp = () => {
    if (swWaiting) {
      swWaiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <RepositoryProvider initialPersona={initialPersona}>
      <main>
        {swWaiting && (
          <div
            className="sw-update-banner"
            role="alert"
            style={{
              background: 'var(--surface-secondary, #1e2230)',
              borderBottom: '1px solid var(--border)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--text-xs)',
              gap: '12px',
            }}
          >
            <span>
              <strong>Update available:</strong> A new version of Kinetra is ready. Your pending
              outbox logs will be preserved.
            </span>
            <button
              type="button"
              className="sync-action-btn"
              style={{ fontWeight: 600, padding: '4px 12px' }}
              onClick={handleUpdateApp}
            >
              Update Now
            </button>
          </div>
        )}

        <DemoHeader activeTab={activeTab} onSelectTab={setActiveTab} />

        {activeTab === 'today' && <TodayView onNavigateToPlan={() => setActiveTab('plan')} />}
        {activeTab === 'measure' && <MeasureView />}
        {activeTab === 'plan' && <PlanView />}
        {activeTab === 'progress' && <ProgressView />}
        {activeTab === 'onboarding' && (
          <OnboardingView
            onComplete={() => setActiveTab('today')}
            onCancel={() => setActiveTab('today')}
          />
        )}
        {activeTab === 'foundation' && <FoundationPanel />}

        <footer>
          Verified identity · English baseline (en-US / en-GB supported) · Local synthetic
          development · AI and photo collection disabled · Domain contracts active
        </footer>
      </main>
    </RepositoryProvider>
  );
}

const rootRoute = createRootRoute();
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: KinetraApp,
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
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </QueryClientProvider>,
);
