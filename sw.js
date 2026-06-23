const CACHE_NAME = 'md-editor-cache-v5';
const ASSETS = [
  '/markdown-editor/',
  '/markdown-editor/index.html',
  '/markdown-editor/guide.html',
  '/markdown-editor/style.css',
  '/markdown-editor/main.js',
  '/markdown-editor/manifest.json',
  '/markdown-editor/icon-192.png',
  '/markdown-editor/icon-512.png'
];

// Install Event - cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('Pre-caching assets failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - network first, fallback to cache
self.addEventListener('fetch', (e) => {
  // Only handle standard HTTP/HTTPS requests and GET method
  if (!e.request.url.startsWith('http') || e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request).then((response) => {
      // If valid network response, cache it
      if (response && response.status === 200) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });
      }
      return response;
    }).catch(() => {
      // Fallback to cache if network fails
      return caches.match(e.request);
    })
  );
});
