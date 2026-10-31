import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseFirestore, isFirebaseConfigured } from './firebase';
import type { Profile } from '@ourspace/types';

export async function registerWithFirebase(
  email: string,
  pass: string,
  displayName: string
): Promise<{ user: User | null; error?: string }> {
  try {
    const auth = getFirebaseAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    // Update Auth profile
    await updateProfile(user, { displayName });

    // Create user document in Firestore users/{uid}
    const db = getFirebaseFirestore();
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      id: user.uid,
      displayName,
      email: user.email,
      photoURL: null,
      bio: 'Just joined OurSpace',
      statusMessage: 'Connected and online ❤️',
      anniversaryDate: null,
      accentColor: '#f43f5e',
      themeMode: 'light',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { user };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return { user: null, error: message };
  }
}

export async function loginWithFirebase(
  email: string,
  pass: string
): Promise<{ user: User | null; error?: string }> {
  try {
    const auth = getFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    return { user: userCredential.user };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return { user: null, error: message };
  }
}

export async function logoutFromFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export async function resetFirebasePassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Password reset failed';
    return { success: false, error: message };
  }
}

export async function updateFirebaseProfile(
  user: User,
  updates: { displayName?: string; photoURL?: string | null }
): Promise<void> {
  await updateProfile(user, updates);
}

export function onFirebaseAuthStateChanged(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

/**
 * Normalizes Firestore document data into canonical Profile domain type.
 * Handles backward-compatibility for legacy naming conventions and timestamps.
 */
export function mapFirestoreDataToProfile(uid: string, data: any): Profile {
  const nowIso = new Date().toISOString();

  const toIsoString = (val: any, fallback: string): string => {
    if (!val) return fallback;
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toISOString();
      } catch {}
    }
    if (val instanceof Date) {
      try {
        return val.toISOString();
      } catch {}
    }
    if (typeof val === 'string') return val;
    return fallback;
  };

  if (!data) {
    return {
      id: uid,
      display_name: 'Partner',
      avatar_url: null,
      bio: null,
      status_message: 'Connected with you',
      status_emoji: '❤️',
      anniversary_date: null,
      accent_color: '#f43f5e',
      theme_mode: 'light',
      last_seen_at: null,
      is_online: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  return {
    id: uid,
    display_name: data.displayName || data.display_name || 'My Love',
    avatar_url: data.photoURL || data.photo_url || data.avatar_url || null,
    bio: data.bio !== undefined ? data.bio : null,
    status_message: data.statusMessage || data.status_message || data.statusText || 'Connected with you',
    status_emoji: data.statusEmoji || data.status_emoji || null,
    anniversary_date: data.anniversaryDate || data.anniversary_date || null,
    accent_color: data.accentColor || data.accent_color || '#f43f5e',
    theme_mode: data.themeMode || data.theme_mode || 'light',
    last_seen_at: toIsoString(data.lastSeenAt, null as any),
    is_online: typeof data.isOnline === 'boolean' ? data.isOnline : undefined,
    created_at: toIsoString(data.createdAt, nowIso),
    updated_at: toIsoString(data.updatedAt, nowIso),
  };
}

export async function fetchUserProfileFromFirestore(uid: string): Promise<Profile | null> {
  try {
    const db = getFirebaseFirestore();
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return mapFirestoreDataToProfile(userDoc.id, userDoc.data());
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch Firestore profile:', err);
    return null;
  }
}

