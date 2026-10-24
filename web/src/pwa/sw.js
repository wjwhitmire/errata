// Service worker: caches the app shell only (this page, its icons, fonts, manifest and the text
// engine file) so the app opens offline. It never caches or sees reports, letters or files, which
// live encrypted in IndexedDB, and never touches requests to any other host.
const CACHE = "app-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-maskable.svg", "./icon-192.png", "./icon-512.png",
  "./icon-maskable-512.png", "./fonts/literata-latin-standard-normal.woff2", "./fonts/literata-latin-standard-italic.woff2",
  "./fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2", "./fonts/atkinson-hyperlegible-next-latin-wght-italic.woff2", "./fonts/sono-latin-full-normal.woff2"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  const path = "./" + url.pathname.split("/").pop();
  const isShell = SHELL.includes(path) || url.pathname.endsWith("/") || url.pathname.includes("/fonts/");
  if (!isShell) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok && r.type === "basic") { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); }
      return r;
    }).catch(() => caches.match("./index.html")));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
  }
});
