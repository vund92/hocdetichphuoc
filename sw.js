// The web version's service worker: keeps the whole app (pages, code, data, fonts) in the browser so it opens and works
// offline, and answers the downloaded reading voices ("giọng đọc mẫu", put in the "ingolit-voice" cache by packs.js)
// from the cache, ranges included (some browsers ask for a part of an audio file).
// scripts/build-web.mjs fills in VERSION and FILES.
const VERSION = "1.20.1-a750609e";
const FILES = ["./","app.js","apple-touch-icon.png","audio/ipa/251-2d0.mp3","audio/ipa/252.mp3","audio/ipa/254-2d0.mp3","audio/ipa/259.mp3","audio/ipa/25c-2d0.mp3","audio/ipa/26a.mp3","audio/ipa/28a.mp3","audio/ipa/28c.mp3","audio/ipa/65.mp3","audio/ipa/69-2d0.mp3","audio/ipa/75-2d0.mp3","audio/ipa/README.md","audio/ipa/e6.mp3","data/extra.json","data/grammar.json","data/vocab.json","favicon.png","fonts/be-vietnam-pro-latin-400-italic.woff2","fonts/be-vietnam-pro-latin-400-normal.woff2","fonts/be-vietnam-pro-latin-500-normal.woff2","fonts/be-vietnam-pro-latin-600-normal.woff2","fonts/be-vietnam-pro-latin-700-normal.woff2","fonts/be-vietnam-pro-latin-ext-400-normal.woff2","fonts/be-vietnam-pro-latin-ext-500-normal.woff2","fonts/be-vietnam-pro-latin-ext-600-normal.woff2","fonts/be-vietnam-pro-latin-ext-700-normal.woff2","fonts/be-vietnam-pro-vietnamese-400-italic.woff2","fonts/be-vietnam-pro-vietnamese-400-normal.woff2","fonts/be-vietnam-pro-vietnamese-500-normal.woff2","fonts/be-vietnam-pro-vietnamese-600-normal.woff2","fonts/be-vietnam-pro-vietnamese-700-normal.woff2","fonts/noto-sans-latin-400-normal.woff2","fonts/noto-sans-latin-ext-400-normal.woff2","icon-192.png","icon-512.png","manifest.webmanifest","styles.css"];
const APP = `ingolit-app-${VERSION}`;
const VOICE = "ingolit-voice";
const VOICE_BASE = "https://raw.githubusercontent.com/vund92/in-go-lit-audio/main/read/";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ingolit-app-") && k !== APP).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/** A cached response, or the part of it asked for in a Range header. */
async function answer(req, res) {
  const range = req.headers.get("range");
  if (!range) return res;
  const blob = await res.blob(); const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? +m[1] : 0; const end = m[2] ? Math.min(+m[2], blob.size - 1) : blob.size - 1;
  return new Response(blob.slice(start, end + 1), { status: 206, headers: {
    "Content-Type": res.headers.get("Content-Type") || "audio/ogg", "Content-Range": `bytes ${start}-${end}/${blob.size}`,
    "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.url.startsWith(VOICE_BASE)) {
    // a downloaded voice: from the cache; not downloaded: the network, as usual
    e.respondWith(caches.open(VOICE).then((c) => c.match(url.origin + url.pathname)).then((hit) => (hit ? answer(req, hit) : fetch(req))));
    return;
  }
  if (url.origin !== location.origin) return;
  // the app: from the cache first (works offline); pages fall back to the app's start page
  e.respondWith(caches.open(APP).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match("./") : null);
    return hit || fetch(req);
  }));
});
