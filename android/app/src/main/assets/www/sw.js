// Stale-while-revalidate app-shell cache. Deliberately doesn't hardcode a
// file list to pre-cache — this app grows new js modules constantly, and a
// hardcoded manifest would silently go stale. Instead, every successful GET
// response is cached opportunistically as the app is used, and cache is
// served immediately when present (falling back to it if the network fails,
// which is what makes the app usable offline after a first visit).
//
// Bump CACHE_NAME when the caching *strategy* itself changes, so old
// installs clear out their previous cache on activate.
const CACHE_NAME = "atomic-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(["./", "./index.html", "./css/styles.css", "./js/main.js", "./manifest.webmanifest"]))
      .catch(() => {
        // Best-effort pre-cache — a failure here shouldn't block install.
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
