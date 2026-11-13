const CACHE_NAME = 'vuvio-static-v31';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-512-maskable.png',
];

function isCacheable(response, url) {
  if (response.status !== 200) return false;
  const ct = response.headers.get('content-type') || '';
  const path = url.pathname;
  // Don't cache HTML responses for non-HTML requests (SPA 404 fallback poisoning)
  if (path.match(/\.(js|css|woff2?|png|jpg|webp|svg)(\?.*)?$/) && ct.includes('text/html')) return false;
  return true;
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL.map((path) => cache.add(path)));

  const response = await fetch('/', { cache: 'no-store' });
  if (response.status !== 200) return;

  const html = await response.clone().text();
  await cache.put('/', response.clone());
  await cache.put('/index.html', response);

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith('/assets/'));

  await Promise.allSettled(assetPaths.map((path) => cache.add(path)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/videos/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/', copy.clone());
              cache.put('/index.html', copy);
            });
          }
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (isCacheable(response, url)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetched;
    }),
  );
});
