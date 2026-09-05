const CACHE_NAME = "stan-v3";
const PRECACHE_URLS = ["/favicon.png", "/pwa-icon-144.png", "/pwa-icon-192.png", "/pwa-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // 타 출처 요청은 캐시하지 않음 (includes는 stan.ai.kr.evil.com 같은 호스트를 통과시켜 엄격 비교 사용)
  if (url.origin !== self.location.origin) return;
  // 카카오/네이버 프록시는 동일 출처 /api/* 경로라 위 검사를 통과한다.
  // cache-first로 받으면 검색·지오코딩·길안내 응답이 영구 고정되므로 제외한다.
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate" || url.pathname === "/manifest.json") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached ?? networkFetch;
    })
  );
});
