/* NOEON TOEFL service worker: the app shell works offline; data and audio always come from the network.
   Bump VERSION to drop old caches. Only same-origin GET requests are touched; API calls (other origin) never are. */
const VERSION = 'v4';
const SHELL = 'shell-' + VERSION, ASSETS = 'assets-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['./', './manifest.webmanifest', './icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;
  if (r.headers.has('range') || /\/audio\//.test(u.pathname)) return;      // audio: leave Range requests to the browser
  if (r.mode === 'navigate') {                                              // page: network, but a slow network falls back to the cached shell after 2.5 s
    e.respondWith((async () => {
      const cache = await caches.open(SHELL), cached = await cache.match('./');
      const net = fetch(r).then(res => { if (res.ok && !res.redirected && res.type === 'basic') cache.put('./', res.clone()); return res; });
      if (!cached) return net.catch(() => Response.error());
      return Promise.race([net, new Promise(ok => setTimeout(() => ok(cached), 2500))]).catch(() => cached);
    })());
    return;
  }
  if (/\/assets\//.test(u.pathname) || /\/icons\//.test(u.pathname)) {      // hashed build files: cache first
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(ASSETS).then(c => c.put(r, cp)); } return res; })));
  }
});
