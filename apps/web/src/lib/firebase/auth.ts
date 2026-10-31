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

export function onFirebaseAuthStateChanged(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export async function fetchUserProfileFromFirestore(uid: string): Promise<Profile | null> {
  try {
    const db = getFirebaseFirestore();
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        id: uid,
        display_name: data.displayName || 'Partner',
        avatar_url: data.photoURL || null,
        bio: data.bio || null,
        status_message: data.statusMessage || 'Online',
        anniversary_date: data.anniversaryDate || null,
        accent_color: data.accentColor || '#f43f5e',
        theme_mode: data.themeMode || 'light',
        created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updated_at: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch Firestore profile:', err);
    return null;
  }
}
