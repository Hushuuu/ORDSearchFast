// pwa-init.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker 註冊成功！範圍：', reg.scope))
      .catch(err => console.log('Service Worker 註冊失敗：', err));
  });
}