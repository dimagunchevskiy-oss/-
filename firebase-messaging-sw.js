// firebase-messaging-sw.js — MyMessend Service Worker
// Размести рядом с index.html на GitHub Pages

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAWZh1laRi7xRK3-LXHpAChEsBpyOdUCbg",
  authDomain: "volleyball-a309b.firebaseapp.com",
  databaseURL: "https://volleyball-a309b-default-rtdb.firebaseio.com",
  projectId: "volleyball-a309b",
  storageBucket: "volleyball-a309b.firebasestorage.app",
  messagingSenderId: "869639306669",
  appId: "1:869639306669:web:020f71d494f268baad3524"
};

firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();

// ── Фоновые FCM уведомления (приложение закрыто/свёрнуто) ──────────
messaging.onBackgroundMessage(payload => {
  const n   = payload.notification || {};
  const data = payload.data || {};
  const chatId = data.chatId || '';
  const tag    = 'chat_' + chatId;

  self.registration.showNotification(n.title || 'MyMessend', {
    body:     n.body  || 'Новое сообщение',
    icon:     '/icon-192.png',
    badge:    '/icon-72.png',
    tag,
    renotify: true,
    vibrate:  [100, 50, 100],
    data:     { chatId, url: self.location.origin + '/-/' }
  });
});

// ── Клик по уведомлению ──────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const chatId = event.notification.data?.chatId || '';
  const url    = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.hostname)) {
          client.focus();
          if (chatId) client.postMessage({ type: 'OPEN_CHAT', chatId });
          return;
        }
      }
      return clients.openWindow(url + (chatId ? '?chat=' + chatId : ''));
    })
  );
});

// ── RTDB polling — запасной механизм когда FCM не доставил ──────────
// Проверяем notifications/{user} каждые 25 сек через fetch
self.addEventListener('message', event => {
  if (event.data?.type === 'SET_USER') {
    self._username = event.data.username;
  }
});

async function pollNotifications() {
  if (!self._username) return;
  const url = `${FIREBASE_CONFIG.databaseURL}/notifications/${self._username}.json?orderBy="read"&equalTo=false&limitToLast=5`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (!data) return;

    // Group by sender
    const bySender = {};
    Object.entries(data).forEach(([id, n]) => {
      if (n.type === 'message' || n.type === 'coins_transfer' || n.type === 'gift') {
        const key = n.from || 'unknown';
        if (!bySender[key]) bySender[key] = { count: 0, name: n.fromName || key, last: n };
        bySender[key].count++;
      }
    });

    for (const [sender, info] of Object.entries(bySender)) {
      const tag   = 'rtdb_' + sender;
      const title = info.count > 1 ? `${info.name} (${info.count} сообщений)` : info.name;
      const body  = info.last.text || info.last.amount ? `+${info.last.amount} Mycoins` : 'Новое сообщение';
      await self.registration.showNotification(title, {
        body, icon: '/icon-192.png', badge: '/icon-72.png',
        tag, renotify: true, data: { chatId: info.last.chatId || '' }
      });
    }
  } catch(e) {}
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'push-check') event.waitUntil(pollNotifications());
});
