// Kinetra Service Worker — Versioned shell caching & offline navigation
const CACHE_NAME = 'kinetra-shell-v1.0.0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate: clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name.startsWith('kinetra-'))
          .map((name) => caches.delete(name)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch: serve app shell, never cache authenticated APIs indiscriminately
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Per ADR 0005 & P6-06: Never cache dynamic API or database endpoints in SW
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/rest') ||
    url.pathname.startsWith('/auth')
  ) {
    return;
  }

  // Navigation requests: Network-first with cache fallback to /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html');
        return cached || new Response('Offline: App shell unavailable', { status: 503 });
      }),
    );
    return;
  }

  // Static assets (CSS, JS, Fonts, Images): Cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidate in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    }),
  );
});

// Listen for message to coordinate activation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
