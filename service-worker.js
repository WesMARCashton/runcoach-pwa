const CACHE_NAME = 'runcoach-cache-v1';
// Files to cache for offline use. In addition to the core HTML, CSS and
// JavaScript, include icons and the manifest so the PWA can operate
// without a network connection. Caching the root path ('./') ensures
// relative fetches succeed when offline.
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  // Activate new service worker immediately without waiting for older
  // workers to be terminated. This helps ensure updates are applied
  // promptly and offline caching is available after a single refresh.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all clients as soon as the service worker is activated
  // so that pages start using the cached resources immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});