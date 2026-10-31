import { create } from 'zustand';
import type { Profile, PrivateSpace, Invitation } from '@ourspace/types';
import {
  loginWithFirebase,
  registerWithFirebase,
  logoutFromFirebase,
  onFirebaseAuthStateChanged,
  fetchUserProfileFromFirestore,
} from '@/lib/firebase/auth';
import {
  createPrivateSpaceInFirestore,
  joinPrivateSpaceInFirestore,
} from '@/lib/firebase/firestore';
import { isFirebaseConfigured, getFirebaseFirestore, getFirebaseAuth } from '@/lib/firebase/firebase';
import { doc, getDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';

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
  anniversary_date: '2023-06-15',
  accent_color: '#f43f5e',
  theme_mode: 'light',
  created_at: new Date('2023-06-15').toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_USER_2: Profile = {
  id: '00000000-0000-0000-0000-000000000002',
  display_name: 'Jordan Taylor',
  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  bio: 'Exploring the world one day at a time with my favorite person ✨',
  status_message: 'Working from home today ☕',
  anniversary_date: '2023-06-15',
  accent_color: '#8b5cf6',
  theme_mode: 'light',
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
        // Firebase Auth state listener
        onFirebaseAuthStateChanged(async (firebaseUser) => {
          if (firebaseUser) {
            const profile = await fetchUserProfileFromFirestore(firebaseUser.uid);
            if (profile) {
              set({ user: profile });

              // Fetch space if activeSpaceId exists
              const db = getFirebaseFirestore();
              const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
              const spaceId = userSnap.data()?.activeSpaceId;

              if (spaceId) {
                const spaceSnap = await getDoc(doc(db, 'privateSpaces', spaceId));
                if (spaceSnap.exists()) {
                  const sData = spaceSnap.data();
                  const currentSpace: PrivateSpace = {
                    id: spaceId,
                    name: sData.name,
                    created_by: sData.createdBy,
                    couple_started_at: sData.coupleStartedAt || null,
                    theme_accent: sData.themeAccent || '#f43f5e',
                    wallpaper_url: sData.wallpaperUrl || null,
                    created_at: sData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    updated_at: sData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                  };
                  set({ space: currentSpace });

                  // Fetch partner member
                  const membersRef = doc(db, `privateSpaces/${spaceId}/members`, firebaseUser.uid);
                  // Partner is the other member in privateSpaces/{spaceId}/members
                  // In 2-person space, find co-member
                  const dbInst = getFirebaseFirestore();
                  // (Set partner if present)
                }
              }
            }
          }
        });
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
          });
        } else {
          // Default to Demo User 1 for instantaneous review
          set({
            user: DEMO_USER_1,
            space: DEMO_SPACE,
            partner: DEMO_USER_2,
          });
        }
      }
    } catch (err: unknown) {
      console.warn('Session init error:', err);
    } finally {
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
        const unconfiguredMsg = 'Firebase Authentication is unconfigured: Please configure NEXT_PUBLIC_FIREBASE_API_KEY in Vercel Environment Variables, or use the 1-Click Demo Profiles below to test.';
        set({ isLoading: false, error: unconfiguredMsg });
        return { success: false, error: unconfiguredMsg };
      }
      // Local demo auth
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
        const unconfiguredMsg = 'Firebase Authentication is unconfigured: Please configure NEXT_PUBLIC_FIREBASE_API_KEY in Vercel Environment Variables, or use the 1-Click Demo Profiles below to test.';
        set({ isLoading: false, error: unconfiguredMsg });
        return { success: false, error: unconfiguredMsg };
      }
      const newUser: Profile = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        display_name: displayName,
        avatar_url: null,
        bio: 'Just joined OurSpace',
        status_message: 'Online',
        anniversary_date: null,
        accent_color: '#f43f5e',
        theme_mode: 'light',
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
    if (isFirebaseConfigured()) {
      await logoutFromFirebase();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ourspace_user');
      localStorage.removeItem('ourspace_space');
    }
    set({ user: null, space: null, partner: null });
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ourspace_space');
    }
    set({ space: null, partner: null });
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;
    const updated = { ...user, ...updates, updated_at: new Date().toISOString() };

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, 'users', user.id), {
        displayName: updates.display_name || user.display_name,
        photoURL: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url,
        bio: updates.bio !== undefined ? updates.bio : user.bio,
        statusMessage: updates.status_message || user.status_message,
        accentColor: updates.accent_color || user.accent_color,
        themeMode: updates.theme_mode || user.theme_mode,
        anniversaryDate: updates.anniversary_date !== undefined ? updates.anniversary_date : user.anniversary_date,
      });
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('ourspace_user', JSON.stringify(updated));
    }
    set({ user: updated });
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
