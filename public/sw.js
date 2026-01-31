// Minimal service worker for PWA installation support
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install Event processing');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating Service Worker...');
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through fetch listener (required for PWA)
    event.respondWith(fetch(event.request));
});
