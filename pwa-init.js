// pwa-init.js
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js')
//       .then(reg => console.log('Service Worker 註冊成功！範圍：', reg.scope))
//       .catch(err => console.log('Service Worker 註冊失敗：', err));
//   });
// }

// if ('serviceWorker' in navigator) {
//   // 1. 註冊你的 Service Worker
//   navigator.serviceWorker.register('/sw.js')
//     .then(reg => console.log('SW 註冊成功'))
//     .catch(err => console.error('SW 註冊失敗', err));

//   // 💡 關鍵 3：監聽 SW 控制權的轉移
//   // 當新的 SW 在背景執行了 skipWaiting() 和 claim() 成功接管時，會觸發此事件
//   let refreshing = false;
//   navigator.serviceWorker.addEventListener('controllerchange', () => {
//     if (refreshing) return; // 防止重複觸發
//     refreshing = true;
    
//     // 方案 A：直接幫使用者暴力重新整理網頁（最省事，使用者會看到網頁自己閃一下變成新版）
//     //window.location.reload();

//     // 方案 B：優雅一點，彈出提示確認再重新整理（體驗較好）
//     if (confirm('網站已發布全新版本，是否立即更新？')) {
//       window.location.reload();
//     }
    
//   });
// }

if ('serviceWorker' in navigator) {
  // 💡 改成等網頁完全載入、靜態資源都處理完後，才在背景默默註冊 SW
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=260625006')
      .then(reg => console.log('SW 註冊成功'))
      .catch(err => console.error('SW 註冊失敗', err));
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    if (confirm('網站已發布新版本，是否立即更新？')) {
      window.location.reload();
    }
  });
}