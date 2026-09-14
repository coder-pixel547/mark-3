const CACHE_NAME = 'swarify-shell-v8.0';
const APP_SHELL = [
  '/',
  '/static/styles.css',
  '/static/manifest.json',
  '/static/icons/icon.svg'
];

// Install: Cache critical app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up obsolete caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy dispatcher
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: NEVER intercept or cache audio streams (/api/stream/*)
  if (url.pathname.startsWith('/api/stream')) {
    return;
  }

  // Scripts and API endpoints: Network-first to always run latest verified code
  if (url.pathname.includes('app.js') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.pathname.includes('app.js')) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell & static assets: Cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch update in background for next reload (stale-while-revalidate for shell)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
