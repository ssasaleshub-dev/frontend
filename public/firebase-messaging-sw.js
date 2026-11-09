// Scripts for firebase and firebase messaging in Web Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyA620dxJm4OogLpWi3v3A3kXil-8vMOyQg",
  authDomain: "ssa-sales-hub.firebaseapp.com",
  projectId: "ssa-sales-hub",
  storageBucket: "ssa-sales-hub.firebasestorage.app",
  messagingSenderId: "701029569745",
  appId: "1:701029569745:android:a6cc3a97fbe3cd8c46a1f0"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message: ', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || 'SSA Sales Hub';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: payload.data || {},
      tag: payload.data?.type === 'CHAT' ? 'chat-message' : 'crm-notification',
      renotify: true,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Firebase init error:', e);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data?.route || (event.notification.data?.type === 'CHAT' ? '/chat' : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(route);
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(route);
      }
    })
  );
});
