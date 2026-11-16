// Network first so edits show up right away; falls back to cache when offline.
const CACHE = 'offline-album-v4';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'js/app.js', 'js/db.js', 'js/flipboard.js', 'js/trail.js', 'js/art.js', 'js/stamps.js', 'js/postcard.js', 'js/journey.js', 'js/importer.js', 'js/import-flow.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const cacheable = url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!cacheable) return;
  e.respondWith(fetch(request).then(res => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
    }
    return res;
  }).catch(() => caches.match(request).then(r => r || caches.match('index.html'))));
});
