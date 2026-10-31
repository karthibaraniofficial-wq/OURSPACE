import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseApp, getFirebaseFirestore } from './firebase';

export async function requestNotificationPermissionAndGetToken(userId: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Notifications not supported in this environment');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    const messaging: Messaging = getMessaging(getFirebaseApp());
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    const token = await getToken(messaging, { vapidKey });
    if (token) {
      // Store token in Firestore users/{uid}/devices/{token}
      const db = getFirebaseFirestore();
      const deviceRef = doc(db, `users/${userId}/devices`, token.substring(0, 20));
      await setDoc(deviceRef, {
        pushToken: token,
        deviceType: 'web',
        lastSeenAt: serverTimestamp(),
      });
    }

    return token;
  } catch (err) {
    console.warn('Failed to obtain FCM token:', err);
    return null;
  }
}

export function onForegroundFirebaseMessage(callback: (payload: unknown) => void) {
  if (typeof window === 'undefined' || !('Notification' in window)) return () => {};
  try {
    const messaging = getMessaging(getFirebaseApp());
    return onMessage(messaging, callback);
  } catch (err) {
    console.warn('FCM messaging listener not initialized:', err);
    return () => {};
  }
}
