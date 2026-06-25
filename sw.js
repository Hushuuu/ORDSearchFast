const CACHE_NAME = 'v=260625008'; // 💡 每次更新 CSS/JS 檔案時，手動將這裡改成 v2, v3... 即可
// 快取清單：保持乾淨的路徑
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
  '/js/shared/app-shared.js',
  '/js/shared/wc-navbar.js',
  '/css/styles.css',
  '/css/tom-select.css',
];

// 1. 安裝階段 (Install)：將資源寫入快取
self.addEventListener('install', event => {
  // 💡 關鍵 1：一旦下載完畢，立刻跳過等待，強制上線取代舊的 SW
  self.skipWaiting(); 

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('正在快取靜態資源...');
      const cachePromises = ASSETS_TO_CACHE.map(url => {
        const cleanUrl = url === '/' ? '/index.html' : url;
        const requestUrl = `${cleanUrl}?busting=${Date.now()}`; 
        
        return fetch(requestUrl)
          .then(response => {
            if (!response.ok) {
              throw new TypeError(`下載失敗: ${url} (狀態碼 ${response.status})`);
            }
            return cache.put(url, response);
          })
          .catch(err => {
            console.error(`無法快取資源: ${url}`, err);
          });
      });
      return Promise.all(cachePromises);
    })
  );
});

// 2. 激活階段 (Activate)：清理舊版本的快取
self.addEventListener('activate', event => {
  // 💡 關鍵 2：讓新的 SW 立刻控制目前所有打開的網頁分頁
  event.waitUntil(self.clients.claim()); 

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
    // 💡 修正：加入 { ignoreSearch: true }
    // 這樣當網頁請求 /css/styles.css?v=260625008 時，會自動忽略 ? 後面，完美比對到快取裡的 /css/styles.css
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      // 如果快取有，就用快取；沒有就走網路請求
      return cachedResponse || fetch(event.request);
    })
  );
});