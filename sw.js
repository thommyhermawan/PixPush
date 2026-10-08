// PixPush service worker: offline app shell, network-first for updates.
const CACHE = 'pixpush-v1.0.1';
const SHELL = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'privacy.html',
  'js/config.js', 'js/core.js', 'js/push.js', 'js/wall.js', 'js/app.js',
  'fonts/PixelifySans.woff', 'fonts/Nunito.woff', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isPeer = url.hostname === 'unpkg.com';
  if(!sameOrigin && !isPeer) return; // ads and signalling go straight to network
  e.respondWith(
    fetch(req).then(res => {
      if(res && (res.ok || res.type === 'opaque')){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
