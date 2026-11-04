// SLF Rolodex service worker: makes the app installable and shows a branded screen with no signal.
// It never caches contact data or API calls; everything comes live from the network.
const CACHE = 'slf-rolodex-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, '/icons/icon-192.png'])));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || req.mode !== 'navigate') return; // only page loads; data/API untouched
    const url = new URL(req.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});
