// ==============================================================================
// OURSPACE — Firebase Cloud Messaging (FCM) Service Worker
// Enables Background Notifications, Remote Push Alerts & Call Signaling
// ==============================================================================

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Initialize Firebase inside the Service Worker
// Parameters are read from query string or configured for production
const urlParams = new URL(location).searchParams;
const firebaseConfig = {
  apiKey: urlParams.get('apiKey') || 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6',
  authDomain: urlParams.get('authDomain') || 'ourspace-app.firebaseapp.com',
  projectId: urlParams.get('projectId') || 'ourspace-app',
  storageBucket: urlParams.get('storageBucket') || 'ourspace-app.appspot.com',
  messagingSenderId: urlParams.get('messagingSenderId') || '123456789012',
  appId: urlParams.get('appId') || '1:123456789012:web:abcdef1234567890abcdef',
};

if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// Handle Background Push Notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM Service Worker] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'OURSPACE';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New message in your sanctuary.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.type || 'chat_message',
    renotify: true,
    data: {
      url: payload.data?.click_action || payload.data?.url || '/dashboard/chat',
      spaceId: payload.data?.spaceId,
      messageId: payload.data?.messageId,
    },
    actions: [
      { action: 'open', title: 'Open Sanctuary' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle Notification Clicks & Deep Linking
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/dashboard/chat';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a sanctuary window is already open, focus it
      for (let client of windowClients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
