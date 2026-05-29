const CACHE = 'bus-countdown-v4';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './tfl.js',
  './favourites.js',
  './map.js',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never cache TfL API calls — always fetch fresh
  if (e.request.url.includes('api.tfl.gov.uk')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).catch(() => {
        if (e.request.mode === 'navigate') {
          return new Response('<p>No internet connection.</p>', { headers: { 'Content-Type': 'text/html' } });
        }
      });
    })
  );
});
