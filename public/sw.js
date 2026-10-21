// Bump this version whenever caching behaviour changes so old caches are purged.
const CACHE_NAME = 'caragasense-v2';
const STATIC_ASSETS = ['/manifest.json', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Activate the new worker immediately instead of waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Never cache HTML pages or Next.js build output — stale HTML paired with
  // fresh JS bundles causes React hydration mismatches.
  // Use network-first for navigations, falling back to cache only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) {
    return; // let the browser handle it normally
  }

  // Cache-first for the small set of static assets.
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
