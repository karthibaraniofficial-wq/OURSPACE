import { create } from 'zustand';
import type { Profile, PrivateSpace, Invitation } from '@ourspace/types';
import {
  loginWithFirebase,
  registerWithFirebase,
  logoutFromFirebase,
  onFirebaseAuthStateChanged,
  fetchUserProfileFromFirestore,
  mapFirestoreDataToProfile,
  updateFirebaseProfile,
} from '@/lib/firebase/auth';
import {
  createPrivateSpaceInFirestore,
  joinPrivateSpaceInFirestore,
} from '@/lib/firebase/firestore';
import { isFirebaseConfigured, getFirebaseFirestore, getFirebaseAuth } from '@/lib/firebase/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  collection,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

interface AuthState {
  user: Profile | null;
  space: PrivateSpace | null;
  partner: Profile | null;
  pendingInvitation: Invitation | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeSession: () => Promise<void>;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, pass: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  createSpace: (name: string, startDate?: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  joinSpace: (code: string) => Promise<{ success: boolean; error?: string }>;
  unpairSpace: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  switchDemoUser: (userNum: 1 | 2) => void;
}

const DEMO_USER_1: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  display_name: 'Alex Rivera',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  bio: 'Forever grateful for every moment with you ❤️',
  status_message: 'Listening to our favorite playlist 🎶',
  status_emoji: '🎧',
  anniversary_date: '2023-06-15',
  accent_color: '#f43f5e',
  theme_mode: 'light',
  last_seen_at: new Date().toISOString(),
  is_online: true,
  created_at: new Date('2023-06-15').toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_USER_2: Profile = {
  id: '00000000-0000-0000-0000-000000000002',
  display_name: 'Jordan Taylor',
  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  bio: 'Exploring the world one day at a time with my favorite person ✨',
  status_message: 'Working from home today ☕',
  status_emoji: '☕',
  anniversary_date: '2023-06-15',
  accent_color: '#8b5cf6',
  theme_mode: 'light',
  last_seen_at: new Date().toISOString(),
  is_online: true,
  created_at: new Date('2023-06-15').toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_SPACE: PrivateSpace = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Our Forever Space',
  created_by: DEMO_USER_1.id,
  couple_started_at: '2023-06-15',
  theme_accent: '#f43f5e',
  wallpaper_url: null,
  created_at: new Date('2023-06-15').toISOString(),
  updated_at: new Date().toISOString(),
};

// Module-level real-time subscription lifecycle management
let userDocUnsubscribe: (() => void) | null = null;
let partnerDocUnsubscribe: (() => void) | null = null;
let spaceDocUnsubscribe: (() => void) | null = null;
let spaceMembersUnsubscribe: (() => void) | null = null;
let currentPartnerSubscribedUid: string | null = null;
let currentActiveSpaceId: string | null = null;
let presenceInterval: NodeJS.Timeout | null = null;
let authListenerRegistered = false;

function cleanupSubscriptions(options: { keepUser?: boolean } = {}) {
  if (!options.keepUser && userDocUnsubscribe) {
    userDocUnsubscribe();
    userDocUnsubscribe = null;
  }
  if (partnerDocUnsubscribe) {
    partnerDocUnsubscribe();
    partnerDocUnsubscribe = null;
    currentPartnerSubscribedUid = null;
  }
  if (spaceDocUnsubscribe) {
    spaceDocUnsubscribe();
    spaceDocUnsubscribe = null;
  }
  if (spaceMembersUnsubscribe) {
    spaceMembersUnsubscribe();
    spaceMembersUnsubscribe = null;
  }
  currentActiveSpaceId = null;

  if (!options.keepUser && presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }
}

function startPresenceHeartbeat(uid: string) {
  if (typeof window === 'undefined') return;
  if (presenceInterval) clearInterval(presenceInterval);

  const updatePresence = async (isOnline: boolean) => {
    try {
      if (!isFirebaseConfigured()) return;
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, 'users', uid), {
        lastSeenAt: serverTimestamp(),
        isOnline,
      });
    } catch {
      // Ignore background presence ping errors
    }
  };

  // Immediate presence ping upon session setup
  updatePresence(true);

  // Periodic heartbeat every 60 seconds
  presenceInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      updatePresence(true);
    }
  }, 60000);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      updatePresence(true);
    } else {
      updatePresence(false);
    }
  };

  const handlePageHide = () => {
    updatePresence(false);
  };

  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('beforeunload', handlePageHide);
}

function attachSpaceSubscriptions(spaceId: string, currentUid: string) {
  const db = getFirebaseFirestore();

  // 1. Real-time listener for space document
  if (spaceDocUnsubscribe) spaceDocUnsubscribe();
  spaceDocUnsubscribe = onSnapshot(
    doc(db, 'privateSpaces', spaceId),
    (spaceSnap) => {
      if (spaceSnap.exists()) {
        const sData = spaceSnap.data();
        const currentSpace: PrivateSpace = {
          id: spaceId,
          name: sData.name || 'Our Space',
          created_by: sData.createdBy,
          couple_started_at: sData.coupleStartedAt || null,
          theme_accent: sData.themeAccent || '#f43f5e',
          wallpaper_url: sData.wallpaperUrl || null,
          created_at: sData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updated_at: sData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
        useAuthStore.setState({ space: currentSpace });
      }
    },
    (err) => {
      console.warn('Space document real-time listener warning:', err);
    }
  );

  // 2. Real-time listener for space members collection (determines partner UID)
  if (spaceMembersUnsubscribe) spaceMembersUnsubscribe();
  spaceMembersUnsubscribe = onSnapshot(
    collection(db, `privateSpaces/${spaceId}/members`),
    (membersSnap) => {
      const partnerDoc = membersSnap.docs.find((d) => d.id !== currentUid);
      if (partnerDoc) {
        const partnerUid = partnerDoc.id;
        if (partnerUid !== currentPartnerSubscribedUid) {
          currentPartnerSubscribedUid = partnerUid;

          // 3. REAL-TIME LISTENER ON PARTNER'S CANONICAL USER DOCUMENT
          if (partnerDocUnsubscribe) partnerDocUnsubscribe();
          partnerDocUnsubscribe = onSnapshot(
            doc(db, 'users', partnerUid),
            (partnerSnap) => {
              if (partnerSnap.exists()) {
                const pData = partnerSnap.data();
                const partnerProfile = mapFirestoreDataToProfile(partnerSnap.id, pData);
                useAuthStore.setState({ partner: partnerProfile });
              } else {
                const mData = partnerDoc.data();
                useAuthStore.setState({
                  partner: {
                    id: partnerUid,
                    display_name: mData.displayName || 'My Partner',
                    avatar_url: mData.photoURL || null,
                    bio: 'In our private space',
                    status_message: 'Online',
                    status_emoji: '❤️',
                    anniversary_date: null,
                    accent_color: '#8b5cf6',
                    theme_mode: 'light',
                    last_seen_at: new Date().toISOString(),
                    is_online: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                });
              }
            },
            (partnerErr) => {
              console.warn('Partner profile real-time sync warning:', partnerErr);
            }
          );
        }
      } else {
        // Space does not yet have a second member
        if (partnerDocUnsubscribe) {
          partnerDocUnsubscribe();
          partnerDocUnsubscribe = null;
        }
        currentPartnerSubscribedUid = null;
        useAuthStore.setState({ partner: null });
      }
    },
    (err) => {
      console.warn('Space members real-time listener warning:', err);
    }
  );
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  space: null,
  partner: null,
  pendingInvitation: null,
  isLoading: true,
  error: null,

  initializeSession: async () => {
    set({ isLoading: true });
    try {
      if (process.env.NODE_ENV === 'production' && !isFirebaseConfigured()) {
        set({
          isLoading: false,
          error: 'Production configuration error: Firebase credentials missing.',
          user: null,
          space: null,
          partner: null,
        });
        return;
      }

      if (isFirebaseConfigured()) {
        if (!authListenerRegistered) {
          authListenerRegistered = true;
          onFirebaseAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
              cleanupSubscriptions();
              const db = getFirebaseFirestore();

              // 1. Subscribe to CURRENT USER canonical profile document in real-time
              const userRef = doc(db, 'users', firebaseUser.uid);
              userDocUnsubscribe = onSnapshot(
                userRef,
                async (userSnap) => {
                  if (userSnap.exists()) {
                    const uData = userSnap.data();
                    const profile = mapFirestoreDataToProfile(userSnap.id, uData);
                    set({ user: profile, isLoading: false });

                    const spaceId = uData.activeSpaceId;
                    if (spaceId && spaceId !== currentActiveSpaceId) {
                      currentActiveSpaceId = spaceId;
                      attachSpaceSubscriptions(spaceId, firebaseUser.uid);
                    } else if (!spaceId && currentActiveSpaceId) {
                      cleanupSubscriptions({ keepUser: true });
                      set({ space: null, partner: null });
                    }
                  } else {
                    const initialProfile = await fetchUserProfileFromFirestore(firebaseUser.uid);
                    if (initialProfile) {
                      set({ user: initialProfile, isLoading: false });
                    } else {
                      set({ isLoading: false });
                    }
                  }
                },
                (err) => {
                  console.warn('Current user real-time listener warning:', err);
                  set({ isLoading: false });
                }
              );

              // 2. Start presence heartbeat
              startPresenceHeartbeat(firebaseUser.uid);
            } else {
              cleanupSubscriptions();
              set({
                user: null,
                space: null,
                partner: null,
                pendingInvitation: null,
                isLoading: false,
              });
            }
          });
        }
      } else {
        // Local persistence fallback for out-of-the-box demoing
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('ourspace_user') : null;
        const storedSpace = typeof window !== 'undefined' ? localStorage.getItem('ourspace_space') : null;

        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          set({
            user: parsedUser,
            space: storedSpace ? JSON.parse(storedSpace) : DEMO_SPACE,
            partner: parsedUser.id === DEMO_USER_1.id ? DEMO_USER_2 : DEMO_USER_1,
            isLoading: false,
          });
        } else {
          set({
            user: DEMO_USER_1,
            space: DEMO_SPACE,
            partner: DEMO_USER_2,
            isLoading: false,
          });
        }
      }
    } catch (err: unknown) {
      console.warn('Session init error:', err);
      set({ isLoading: false });
    }
  },

  login: async (email, pass) => {
    set({ isLoading: true, error: null });
    if (isFirebaseConfigured()) {
      const { user, error } = await loginWithFirebase(email, pass);
      if (error || !user) {
        set({ isLoading: false, error: error || 'Login failed' });
        return { success: false, error };
      }
      await get().initializeSession();
      return { success: true };
    } else {
      if (process.env.NODE_ENV === 'production') {
        const unconfiguredMsg =
          'Firebase Authentication is unconfigured: Please configure NEXT_PUBLIC_FIREBASE_API_KEY in Vercel Environment Variables, or use the 1-Click Demo Profiles below to test.';
        set({ isLoading: false, error: unconfiguredMsg });
        return { success: false, error: unconfiguredMsg };
      }
      const user = email.includes('jordan') ? DEMO_USER_2 : DEMO_USER_1;
      const partner = user.id === DEMO_USER_1.id ? DEMO_USER_2 : DEMO_USER_1;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ourspace_user', JSON.stringify(user));
        localStorage.setItem('ourspace_space', JSON.stringify(DEMO_SPACE));
      }
      set({ user, space: DEMO_SPACE, partner, isLoading: false });
      return { success: true };
    }
  },

  register: async (email, pass, displayName) => {
    set({ isLoading: true, error: null });
    if (isFirebaseConfigured()) {
      const { user, error } = await registerWithFirebase(email, pass, displayName);
      if (error || !user) {
        set({ isLoading: false, error: error || 'Registration failed' });
        return { success: false, error };
      }
      await get().initializeSession();
      return { success: true };
    } else {
      if (process.env.NODE_ENV === 'production') {
        const unconfiguredMsg =
          'Firebase Authentication is unconfigured: Please configure NEXT_PUBLIC_FIREBASE_API_KEY in Vercel Environment Variables, or use the 1-Click Demo Profiles below to test.';
        set({ isLoading: false, error: unconfiguredMsg });
        return { success: false, error: unconfiguredMsg };
      }
      const newUser: Profile = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        display_name: displayName,
        avatar_url: null,
        bio: 'Just joined OurSpace',
        status_message: 'Online',
        status_emoji: '❤️',
        anniversary_date: null,
        accent_color: '#f43f5e',
        theme_mode: 'light',
        last_seen_at: new Date().toISOString(),
        is_online: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('ourspace_user', JSON.stringify(newUser));
        localStorage.removeItem('ourspace_space');
      }
      set({ user: newUser, space: null, partner: null, isLoading: false });
      return { success: true };
    }
  },

  logout: async () => {
    const user = get().user;
    if (user && isFirebaseConfigured()) {
      try {
        const db = getFirebaseFirestore();
        await updateDoc(doc(db, 'users', user.id), {
          lastSeenAt: serverTimestamp(),
          isOnline: false,
        });
      } catch {}
    }
    cleanupSubscriptions();
    if (isFirebaseConfigured()) {
      await logoutFromFirebase();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ourspace_user');
      localStorage.removeItem('ourspace_space');
    }
    set({ user: null, space: null, partner: null, pendingInvitation: null });
  },

  createSpace: async (name, startDate) => {
    const user = get().user;
    if (!user) return { success: false, error: 'User not authenticated' };

    const auth = isFirebaseConfigured() ? getFirebaseAuth() : null;
    if (auth?.currentUser) {
      const res = await createPrivateSpaceInFirestore(user, name, startDate);
      if (res.success && res.spaceId) {
        await get().initializeSession();
        return { success: true, code: res.inviteCode };
      }
      return { success: false, error: res.error };
    } else {
      const code = 'LOVE-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const newSpace: PrivateSpace = {
        id: 'space_' + Math.random().toString(36).substring(2, 9),
        name,
        created_by: user.id,
        couple_started_at: startDate || new Date().toISOString().split('T')[0],
        theme_accent: '#f43f5e',
        wallpaper_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const invite: Invitation = {
        id: 'inv_' + Math.random().toString(36).substring(2, 9),
        space_id: newSpace.id,
        code,
        created_by: user.id,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        accepted_at: null,
        accepted_by: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('ourspace_space', JSON.stringify(newSpace));
      }
      set({ space: newSpace, pendingInvitation: invite });
      return { success: true, code };
    }
  },

  joinSpace: async (code) => {
    const user = get().user;
    if (!user) return { success: false, error: 'User not authenticated' };

    const auth = isFirebaseConfigured() ? getFirebaseAuth() : null;
    if (auth?.currentUser) {
      const res = await joinPrivateSpaceInFirestore(user, code);
      if (res.success) {
        await get().initializeSession();
        return { success: true };
      }
      return { success: false, error: res.error };
    } else {
      const partner = user.id === DEMO_USER_1.id ? DEMO_USER_2 : DEMO_USER_1;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ourspace_space', JSON.stringify(DEMO_SPACE));
      }
      set({ space: DEMO_SPACE, partner });
      return { success: true };
    }
  },

  unpairSpace: async () => {
    const space = get().space;
    const user = get().user;
    if (!space || !user) return;

    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseFirestore();
        await updateDoc(doc(db, 'users', user.id), { activeSpaceId: null });
        const memberRef = doc(db, `privateSpaces/${space.id}/members`, user.id);
        await deleteDoc(memberRef);
        await updateDoc(doc(db, 'privateSpaces', space.id), { memberCount: increment(-1) });
      } catch (err) {
        console.warn('Error during space unpairing:', err);
      }
    }
    cleanupSubscriptions({ keepUser: true });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ourspace_space');
    }
    set({ space: null, partner: null });
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;

    // Optimistic local state update
    const updated: Profile = {
      ...user,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    set({ user: updated });

    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseFirestore();
        const firestoreUpdates: Record<string, any> = {
          updatedAt: serverTimestamp(),
        };

        if (updates.display_name !== undefined) {
          firestoreUpdates.displayName = updates.display_name;
        }
        if (updates.avatar_url !== undefined) {
          firestoreUpdates.photoURL = updates.avatar_url;
        }
        if (updates.bio !== undefined) {
          firestoreUpdates.bio = updates.bio;
        }
        if (updates.status_message !== undefined) {
          firestoreUpdates.statusMessage = updates.status_message;
        }
        if (updates.status_emoji !== undefined) {
          firestoreUpdates.statusEmoji = updates.status_emoji;
        }
        if (updates.accent_color !== undefined) {
          firestoreUpdates.accentColor = updates.accent_color;
        }
        if (updates.theme_mode !== undefined) {
          firestoreUpdates.themeMode = updates.theme_mode;
        }
        if (updates.anniversary_date !== undefined) {
          firestoreUpdates.anniversaryDate = updates.anniversary_date;
        }

        // 1. Authoritative update to canonical user document
        await updateDoc(doc(db, 'users', user.id), firestoreUpdates);

        // 2. Synchronize to Firebase Auth credential profile
        const auth = getFirebaseAuth();
        if (auth?.currentUser) {
          const authUpdates: { displayName?: string; photoURL?: string | null } = {};
          if (updates.display_name !== undefined) authUpdates.displayName = updates.display_name;
          if (updates.avatar_url !== undefined) authUpdates.photoURL = updates.avatar_url;
          if (Object.keys(authUpdates).length > 0) {
            await updateFirebaseProfile(auth.currentUser, authUpdates).catch((err) => {
              console.warn('Auth profile sync warning:', err);
            });
          }
        }

        // 3. Keep space member document updated for backward compatibility
        const space = get().space;
        if (space?.id) {
          const memberRef = doc(db, `privateSpaces/${space.id}/members`, user.id);
          const memberUpdates: Record<string, any> = {};
          if (updates.display_name !== undefined) memberUpdates.displayName = updates.display_name;
          if (updates.avatar_url !== undefined) memberUpdates.photoURL = updates.avatar_url;
          if (Object.keys(memberUpdates).length > 0) {
            await updateDoc(memberRef, memberUpdates).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Profile update error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('ourspace_user', JSON.stringify(updated));
    }
  },

  switchDemoUser: (userNum) => {
    if (process.env.NODE_ENV === 'production' && isFirebaseConfigured()) {
      console.warn('[SECURITY] Demo user switching is strictly disabled in production.');
      return;
    }
    const selected = userNum === 1 ? DEMO_USER_1 : DEMO_USER_2;
    const partner = userNum === 1 ? DEMO_USER_2 : DEMO_USER_1;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ourspace_user', JSON.stringify(selected));
      localStorage.setItem('ourspace_space', JSON.stringify(DEMO_SPACE));
    }
    set({ user: selected, partner, space: DEMO_SPACE });
  },
}));

