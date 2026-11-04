// 離線快取：頁面走「先網路、失敗用快取」，照片／地圖／字型走「先快取、沒有再下載並存起來」。
const SHELL = "kyushu-shell-7f9b61f3e8";
const MEDIA = "kyushu-media";
const LIVE = /(^|\.)(jma\.go\.jp|open-meteo\.com)$/;
const SHELL_FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("kyushu-shell-") && k !== SHELL).map(k => caches.delete(k))))
      // 舊版會把天氣預報也存進快取，造成重新整理一直拿到舊資料；這裡清掉
      .then(() => caches.open(MEDIA)).then(c => c.keys().then(ks => Promise.all(ks.filter(r => LIVE.test(new URL(r.url).hostname)).map(r => c.delete(r)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(SHELL).then(c => c.put("index.html", copy)); return res; })
        .catch(() => caches.match("index.html", { ignoreSearch: true }))
    );
    return;
  }

  // 天氣預報要即時，不經過快取
  if (LIVE.test(new URL(req.url).hostname)) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(MEDIA).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
