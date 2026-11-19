// Offline play. Pages are fetched from the network first (so a new version shows on the next load) and fall back
// to the cache when offline. Built assets have content hashes in their names, so they are safe to serve from cache.
// It never calls skipWaiting or reloads a page, so a new version cannot interrupt a run in progress.
const CACHE = 'severity1-v2'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./']))) })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
})
const put = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) } return res }
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  const hashed = url.pathname.includes('/assets/')
  e.respondWith(
    hashed
      ? caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res)))
      : fetch(req).then((res) => put(req, res)).catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
  )
})
