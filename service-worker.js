// service-worker.js
const CACHE_NAME = 'tg-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.webmanifest',
  // agrega aquí iconos y demás archivos estáticos si querés precachearlos
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Network-first para HTML; cache-first para estáticos
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        // opcional: cache dinámico de estáticos
        if (['style', 'script', 'image', 'font'].includes(req.destination)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
