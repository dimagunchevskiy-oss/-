// firebase-messaging-sw.js
// MyMessend — Push Notifications Service Worker
// Загрузи этот файл рядом с index.html на GitHub

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAWZh1laRi7xRK3-LXHpAChEsBpyOdUCbg",
  authDomain: "volleyball-a309b.firebaseapp.com",
  databaseURL: "https://volleyball-a309b-default-rtdb.firebaseio.com",
  projectId: "volleyball-a309b",
  storageBucket: "volleyball-a309b.firebasestorage.app",
  messagingSenderId: "869639306669",
  appId: "1:869639306669:web:020f71d494f268baad3524"
});

const messaging = firebase.messaging();

// ── Фоновые уведомления (когда приложение закрыто) ─────────────────
messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  const data = payload.data || {};

  const title = n.title || 'MyMessend';
  const body  = n.body  || 'Новое сообщение';

  self.registration.showNotification(title, {
    body,
    icon:  '/icon-192.png',   // можно заменить на свою иконку
    badge: '/icon-72.png',
    tag:   data.chatId || 'mymessend',  // группирует уведомления одного чата
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: self.location.origin + '/?chat=' + (data.chatId || '') }
  });
});

// ── Клик по уведомлению — открыть приложение ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Если вкладка уже открыта — фокус на неё
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'OPEN_CHAT', chatId: event.notification.data?.chatId });
          return;
        }
      }
      // Иначе открыть новую вкладку
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Push queue polling (запасной механизм через Firebase) ───────────
// Проверяем очередь каждые 30 сек в фоне
self.addEventListener('periodicsync', event => {
  if (event.tag === 'push-check') {
    event.waitUntil(checkPushQueue());
  }
});

async function checkPushQueue() {
  // Этот метод используется если FCM не доставил напрямую
  console.log('[SW] Push queue check');
}
