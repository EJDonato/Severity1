// Offline play (NFR): cache-first for same-origin GETs, filled on first use. Versioned so a new build starts a fresh cache.
// It never calls skipWaiting or reloads a page, so a new version cannot interrupt a run in progress.
const CACHE = 'severity1-v1'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './favicon.svg']))) })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    }).catch(() => caches.match('./'))),
  )
})
