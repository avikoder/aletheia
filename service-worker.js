/* ============================================================
   Aletheia — service-worker.js
   Offline-first caching for a fully local PWA.

   Strategy
   --------
   • App shell (own files): cache-first, so the app opens instantly
     and works with no network at all.
   • CDN assets (Tailwind, Lucide, Chart.js, fonts): stale-while-
     revalidate, so they're available offline after first load but
     still update quietly when a connection exists.
   • Navigation requests: serve the cached shell as a fallback.

   Bump CACHE_VERSION whenever shell files change to trigger an
   update + cleanup of old caches.
   ============================================================ */

const CACHE_VERSION = 'aletheia-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Own files that make up the installable app shell.
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/constants.js',
  './js/analysis.js',
  './js/ui.js',
  './js/charts.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// CDN origins we want to cache at runtime.
const RUNTIME_ORIGINS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com',
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/* ---------- install: pre-cache the shell ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // addAll fails the whole install if any file 404s, which is
      // what we want — a broken shell shouldn't be cached.
      cache.addAll(SHELL_ASSETS)
    ).then(() => self.skipWaiting())
  );
});

/* ---------- activate: drop old caches ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---------- helpers ---------- */
function isRuntimeAsset(url) {
  return RUNTIME_ORIGINS.some((origin) => url.startsWith(origin));
}

/* ---------- fetch: route by request type ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET; let the browser deal with the rest.
  if (request.method !== 'GET') return;

  const url = request.url;

  // 1) Navigation requests → cache-first shell, network fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) =>
        cached ||
        fetch(request).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  // 2) CDN runtime assets → stale-while-revalidate.
  if (isRuntimeAsset(url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              // Cache successful + opaque responses (opaque = cross-origin no-cors).
              if (response && (response.ok || response.type === 'opaque')) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached); // offline: fall back to cache
          return cached || network;
        })
      )
    );
    return;
  }

  // 3) Same-origin shell assets → cache-first, then network.
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request)
        .then((response) => {
          // Opportunistically cache new same-origin GETs.
          if (response && response.ok && new URL(url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached)
    )
  );
});

/* ---------- allow the page to trigger an immediate update ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
