// As-Built Collection service worker — offline app shell.
const CACHE = "asbuilt-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./rw-admin.js",
  "./exceljs.min.js",
  "./reserve-template.xlsx",
  "./leaflet/leaflet.js",
  "./leaflet/leaflet.css",
  "./leaflet/images/layers.png",
  "./leaflet/images/layers-2x.png",
  "./leaflet/images/marker-icon.png",
  "./leaflet/images/marker-icon-2x.png",
  "./leaflet/images/marker-shadow.png"
];
const TILE_CACHE = "asbuilt-tiles-v1";
const isTile = (u) => /arcgisonline\.com|tile\.openstreetmap\.org/.test(u);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Map tiles: cache-first from the tile cache; fetch and store when online (cache-on-view).
// App shell: cache-first, network fallback.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  if (isTile(url)) {
    e.respondWith(
      caches.open(TILE_CACHE).then((c) =>
        c.match(e.request).then((hit) =>
          hit || fetch(e.request).then((res) => { c.put(e.request, res.clone()); return res; })
                    .catch(() => hit)
        )
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
