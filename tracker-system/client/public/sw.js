// IT Asset Tracker — offline cache for stock checks.
// Strategy: stale-while-revalidate on /api/inventory* read endpoints, network-only for mutations.

const CACHE = "its-stock-v2";
const STOCK_PATHS = [/^\/api\/inventory(\/|$|\?)/, /^\/api\/categories$/, /^\/api\/suppliers$/];

self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;  // mutations bypass cache (must be online)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!STOCK_PATHS.some((re) => re.test(url.pathname + url.search))) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const networkPromise = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await networkPromise) || new Response(JSON.stringify({ offline: true, items: [] }),
      { headers: { "Content-Type": "application/json" } });
  })());
});
