const CACHE_NAME = 'ord-cache-v1';
// 快取清單：把需要離線瀏覽的資源路徑放進來
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/resource/192x192.png',
  '/resource/512x512.png',
  '/js/app.js',
  '/js/ord_data.js',
  '/js/tom-select.complete.min.js',
  '/js/pages/lookup-page.js',
  '/shared/app-shared.js',
  '/shared/wc-navbar.js',
  '/css/style.css',
  '/css/tom-select.css',
];

// 1. 安裝階段 (Install)：將資源寫入快取
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('正在快取靜態資源...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. 激活階段 (Activate)：清理舊版本的快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('刪除舊快取:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. 攔截請求 (Fetch)：離線時優先使用快取
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 如果快取有，就用快取；沒有就走網路請求
      return cachedResponse || fetch(event.request);
    })
  );
});