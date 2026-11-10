// Paraules · Xoriguer · funcionament sense connexió (el solitari funciona sense internet)
// IMPORTANT: totes les apps Xoriguer comparteixen l'origen xorigu3r.github.io.
// Aquest fitxer NOMÉS toca les memòries cau que comencen per "paraules-".
const VERSION = "paraules-v1.1";
const APP = [
  "./", "index.html", "motor.js", "firebase-config.js", "manifest.webmanifest",
  "img/logo.jpg", "img/icona.png", "img/icona-512.png", "img/apple-touch-icon.png", "img/deco.png", "img/fusta.jpg",
  "dades/ca.dawg", "dades/es.dawg",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("paraules-") && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Firebase (gstatic) no el toquem
  if (!url.pathname.startsWith(new URL("./", self.registration.scope).pathname)) return;

  // Pàgina i codi: primer internet (per rebre les versions noves); sense connexió, la còpia guardada
  if (req.mode === "navigate" || /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/")) {
    e.respondWith(
      fetch(req).then(res => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
    );
    return;
  }
  if (url.pathname.includes("/dades/lemes/")) return;     // índex de definicions: només amb connexió, no ocupa la memòria cau
  // Imatges i diccionaris: primer la còpia guardada
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
    return res;
  })));
});
