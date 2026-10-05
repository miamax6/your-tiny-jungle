/* Réseau d'abord, cache en repli.
   GitHub Pages sert une copie pendant ~10 minutes après un envoi :
   un service worker « cache d'abord » y figerait une version
   périmée pour des jours. D'où le réseau d'abord, systématiquement
   revalidé, et un cache qui ne sert qu'hors ligne. */
const CACHE = "ytj-v3";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest",
                "./icons/icon-192.png", "./icons/icon-512.png",
                "./icons/maskable-192.png", "./icons/maskable-512.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  /* L'API GitHub ne doit jamais être mise en cache : une réponse
     figée ferait croire que les données distantes n'ont pas bougé. */
  if (new URL(req.url).hostname === "api.github.com") return;
  e.respondWith(
    fetch(new Request(req, { cache: "no-cache" }))
      .then(r => {
        if (r && r.ok && new URL(req.url).origin === location.origin){
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
