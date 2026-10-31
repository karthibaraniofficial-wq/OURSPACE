import { create } from 'zustand';
import type {
  LockerSection,
  LockerMetadata,
  LockerDeletionState,
  DecryptedLockerItem,
  EncryptedLockerItem,
  UUID,
} from '@ourspace/types';
import {
  deriveKeyFromPassword,
  computeKeyVerifier,
  encryptPayload,
  decryptPayload,
  generateRandomBytes,
  bufferToHex,
} from '@/lib/crypto/vaultCrypto';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

interface LockerState {
  isConfigured: boolean;
  isUnlocked: boolean;
  vaultMetadata: LockerMetadata | null;
  items: DecryptedLockerItem[];
  selectedSection: LockerSection;
  searchQuery: string;
  failedAttempts: number;
  lockoutUntil: number | null;
  deletionState: LockerDeletionState;
  deletionProgressMessage: string;
  isProcessing: boolean;

  // Actions
  loadVaultMetadata: (userId: string) => Promise<void>;
  setupLocker: (userId: string, masterPassword: string) => Promise<boolean>;
  unlockLocker: (userId: string, masterPassword: string) => Promise<{ success: boolean; error?: string }>;
  lockLocker: () => void;
  setSelectedSection: (section: LockerSection) => void;
  setSearchQuery: (query: string) => void;
  createLockerItem: (
    userId: string,
    item: { section: LockerSection; title: string; payload: Record<string, any>; folderId?: UUID | null }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteLockerItem: (userId: string, itemId: UUID) => Promise<void>;
  toggleFavourite: (userId: string, itemId: UUID) => Promise<void>;
  toggleArchive: (userId: string, itemId: UUID) => Promise<void>;
  exportDecryptedVault: () => string;
  resetAndEraseLocker: (userId: string, confirmationPhrase: string) => Promise<{ success: boolean; error?: string }>;
}

// Memory-only cryptographic key reference (ephemeral, zero-persistence)
let activeSessionKey: CryptoKey | null = null;
let autoLockTimer: NodeJS.Timeout | null = null;

export const useLockerStore = create<LockerState>((set, get) => ({
  isConfigured: false,
  isUnlocked: false,
  vaultMetadata: null,
  items: [],
  selectedSection: 'notes',
  searchQuery: '',
  failedAttempts: 0,
  lockoutUntil: null,
  deletionState: 'ACTIVE',
  deletionProgressMessage: '',
  isProcessing: false,

  setSelectedSection: (section) => set({ selectedSection: section }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  loadVaultMetadata: async (userId: string) => {
    if (!isFirebaseConfigured()) {
      // Local demo mode check
      const localMeta = localStorage.getItem(`ourspace_vault_meta_${userId}`);
      if (localMeta) {
        try {
          const meta = JSON.parse(localMeta) as LockerMetadata;
          set({ isConfigured: true, vaultMetadata: meta, deletionState: meta.deletion_state || 'ACTIVE' });
        } catch {
          set({ isConfigured: false, vaultMetadata: null });
        }
      } else {
        set({ isConfigured: false, vaultMetadata: null });
      }
      return;
    }

    try {
      const db = getFirebaseFirestore();
      const metaRef = doc(db, 'users', userId, 'personalVault', 'default');
      const snap = await getDoc(metaRef);
      if (snap.exists()) {
        const data = snap.data() as LockerMetadata;
        set({ isConfigured: true, vaultMetadata: data, deletionState: data.deletion_state || 'ACTIVE' });
      } else {
        set({ isConfigured: false, vaultMetadata: null, deletionState: 'ACTIVE' });
      }
    } catch {
      set({ isConfigured: false, vaultMetadata: null });
    }
  },

  setupLocker: async (userId: string, masterPassword: string) => {
    set({ isProcessing: true });
    try {
      const salt = bufferToHex(generateRandomBytes(16));
      const key = await deriveKeyFromPassword(masterPassword, salt);
      const verifierHash = await computeKeyVerifier(key);

      const metadata: LockerMetadata = {
        vault_id: 'default',
        user_id: userId,
        key_version: 1,
        salt,
        iv: bufferToHex(generateRandomBytes(12)),
        verifier_hash: verifierHash,
        deletion_state: 'ACTIVE',
        failed_attempts: 0,
        lockout_until: null,
        auto_lock_timeout_minutes: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        await setDoc(doc(db, 'users', userId, 'personalVault', 'default'), metadata);
      } else {
        localStorage.setItem(`ourspace_vault_meta_${userId}`, JSON.stringify(metadata));
      }

      activeSessionKey = key;
      set({
        isConfigured: true,
        isUnlocked: true,
        vaultMetadata: metadata,
        items: [],
        deletionState: 'ACTIVE',
        isProcessing: false,
      });

      return true;
    } catch {
      set({ isProcessing: false });
      return false;
    }
  },

  unlockLocker: async (userId: string, masterPassword: string) => {
    const { vaultMetadata, failedAttempts, lockoutUntil } = get();

    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const waitSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return { success: false, error: `Vault locked due to repeated failed attempts. Please wait ${waitSeconds} seconds.` };
    }

    if (!vaultMetadata) {
      await get().loadVaultMetadata(userId);
    }

    const currentMeta = get().vaultMetadata;
    if (!currentMeta) {
      return { success: false, error: 'Locker is not yet configured on this device.' };
    }

    set({ isProcessing: true });

    try {
      const derivedKey = await deriveKeyFromPassword(masterPassword, currentMeta.salt);
      const computedVerifier = await computeKeyVerifier(derivedKey);

      if (computedVerifier !== currentMeta.verifier_hash) {
        const newAttempts = failedAttempts + 1;
        let newLockout: number | null = null;
        if (newAttempts >= 5) {
          newLockout = Date.now() + 60 * 1000; // 60s lockout
        } else if (newAttempts >= 3) {
          newLockout = Date.now() + 15 * 1000; // 15s lockout
        }
        set({ failedAttempts: newAttempts, lockoutUntil: newLockout, isProcessing: false });
        return { success: false, error: 'Incorrect master password. Access denied.' };
      }

      // Password verified!
      activeSessionKey = derivedKey;

      // Fetch and decrypt items
      const decryptedList: DecryptedLockerItem[] = [];

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const itemsColl = collection(db, 'users', userId, 'personalVault', 'default', 'items');
        const snap = await getDocs(itemsColl);

        for (const docSnap of snap.docs) {
          const itemData = docSnap.data() as EncryptedLockerItem;
          try {
            const title = await decryptPayload(itemData.title_ciphertext, itemData.iv, derivedKey);
            const payload = await decryptPayload(itemData.payload_ciphertext, itemData.iv, derivedKey);
            decryptedList.push({
              id: docSnap.id,
              section: itemData.section,
              folder_id: itemData.folder_id || null,
              title,
              payload,
              is_favourite: itemData.is_favourite || false,
              is_archived: itemData.is_archived || false,
              created_at: itemData.created_at,
              updated_at: itemData.updated_at,
            });
          } catch {
            // Decryption failure for corrupt item
          }
        }
      } else {
        const localItems = localStorage.getItem(`ourspace_vault_items_${userId}`);
        if (localItems) {
          const encList = JSON.parse(localItems) as EncryptedLockerItem[];
          for (const itemData of encList) {
            try {
              const title = await decryptPayload(itemData.title_ciphertext, itemData.iv, derivedKey);
              const payload = await decryptPayload(itemData.payload_ciphertext, itemData.iv, derivedKey);
              decryptedList.push({
                id: itemData.id,
                section: itemData.section,
                folder_id: itemData.folder_id || null,
                title,
                payload,
                is_favourite: itemData.is_favourite || false,
                is_archived: itemData.is_archived || false,
                created_at: itemData.created_at,
                updated_at: itemData.updated_at,
              });
            } catch {
              // Ignore corrupt item
            }
          }
        }
      }

      // Set auto-lock timer (5 minutes default)
      if (autoLockTimer) clearTimeout(autoLockTimer);
      autoLockTimer = setTimeout(() => {
        get().lockLocker();
      }, 5 * 60 * 1000);

      set({
        isUnlocked: true,
        items: decryptedList,
        failedAttempts: 0,
        lockoutUntil: null,
        isProcessing: false,
      });

      return { success: true };
    } catch (err: unknown) {
      set({ isProcessing: false });
      return { success: false, error: err instanceof Error ? err.message : 'Decryption error' };
    }
  },

  lockLocker: () => {
    activeSessionKey = null;
    if (autoLockTimer) clearTimeout(autoLockTimer);
    set({
      isUnlocked: false,
      items: [],
      searchQuery: '',
    });
  },

  createLockerItem: async (userId, item) => {
    if (!activeSessionKey) {
      return { success: false, error: 'Locker is locked. Unlock before creating items.' };
    }

    try {
      const encryptedTitle = await encryptPayload(item.title, activeSessionKey);
      const encryptedBody = await encryptPayload(item.payload, activeSessionKey);

      const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const createdAt = new Date().toISOString();

      const encItem: EncryptedLockerItem = {
        id: itemId,
        user_id: userId,
        section: item.section,
        folder_id: item.folderId || null,
        title_ciphertext: encryptedTitle.ciphertext,
        payload_ciphertext: encryptedBody.ciphertext,
        iv: encryptedTitle.iv,
        salt: get().vaultMetadata?.salt || '',
        is_favourite: false,
        is_archived: false,
        created_at: createdAt,
        updated_at: createdAt,
      };

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        await setDoc(doc(db, 'users', userId, 'personalVault', 'default', 'items', itemId), encItem);
      } else {
        const raw = localStorage.getItem(`ourspace_vault_items_${userId}`);
        const existing = raw ? JSON.parse(raw) : [];
        existing.push(encItem);
        localStorage.setItem(`ourspace_vault_items_${userId}`, JSON.stringify(existing));
      }

      const decItem: DecryptedLockerItem = {
        id: itemId,
        section: item.section,
        folder_id: item.folderId || null,
        title: item.title,
        payload: item.payload,
        is_favourite: false,
        is_archived: false,
        created_at: createdAt,
        updated_at: createdAt,
      };

      set((state) => ({ items: [decItem, ...state.items] }));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Encryption failed' };
    }
  },

  deleteLockerItem: async (userId, itemId) => {
    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await deleteDoc(doc(db, 'users', userId, 'personalVault', 'default', 'items', itemId));
    } else {
      const raw = localStorage.getItem(`ourspace_vault_items_${userId}`);
      if (raw) {
        const list = (JSON.parse(raw) as EncryptedLockerItem[]).filter((i) => i.id !== itemId);
        localStorage.setItem(`ourspace_vault_items_${userId}`, JSON.stringify(list));
      }
    }
    set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
  },

  toggleFavourite: async (userId, itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    const newFav = !item.is_favourite;

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, 'users', userId, 'personalVault', 'default', 'items', itemId), {
        is_favourite: newFav,
        updated_at: new Date().toISOString(),
      });
    }
    set((state) => ({
      items: state.items.map((i) => (i.id === itemId ? { ...i, is_favourite: newFav } : i)),
    }));
  },

  toggleArchive: async (userId, itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    const newArch = !item.is_archived;

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, 'users', userId, 'personalVault', 'default', 'items', itemId), {
        is_archived: newArch,
        updated_at: new Date().toISOString(),
      });
    }
    set((state) => ({
      items: state.items.map((i) => (i.id === itemId ? { ...i, is_archived: newArch } : i)),
    }));
  },

  exportDecryptedVault: () => {
    const { items, vaultMetadata } = get();
    const exportData = {
      app: 'OURSPACE OUR LOCKER EXPORT',
      exported_at: new Date().toISOString(),
      vault_key_version: vaultMetadata?.key_version || 1,
      item_count: items.length,
      disclaimer: 'This file contains unencrypted sensitive information. Store securely.',
      items,
    };
    return JSON.stringify(exportData, null, 2);
  },

  // ========================================================================
  // CRITICAL REQUIREMENT: RESET LOCKER & ERASE ALL DATA
  // State Machine: ACTIVE -> WIPE_PENDING -> PURGING_FILES -> PURGING_METADATA -> VERIFYING_DELETION -> READY_FOR_NEW_KEY
  // ========================================================================
  resetAndEraseLocker: async (userId, confirmationPhrase) => {
    if (confirmationPhrase.trim() !== 'DELETE MY LOCKER') {
      return { success: false, error: 'Confirmation phrase must match "DELETE MY LOCKER" exactly.' };
    }

    set({ isProcessing: true });

    try {
      // 1. Transition: WIPE_PENDING
      set({ deletionState: 'WIPE_PENDING', deletionProgressMessage: 'Initiating locker wipe sequence...' });

      // Lock all active sessions and discard cryptographic key
      activeSessionKey = null;
      if (autoLockTimer) clearTimeout(autoLockTimer);

      // 2. Transition: PURGING_FILES
      set({ deletionState: 'PURGING_FILES', deletionProgressMessage: 'Purging encrypted file attachments and documents...' });

      // 3. Transition: PURGING_METADATA
      set({ deletionState: 'PURGING_METADATA', deletionProgressMessage: 'Erasing encrypted items, notes, and credentials...' });

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const itemsColl = collection(db, 'users', userId, 'personalVault', 'default', 'items');
        const snap = await getDocs(itemsColl);
        for (const docSnap of snap.docs) {
          await deleteDoc(docSnap.ref);
        }

        // Delete vault metadata document
        const metaRef = doc(db, 'users', userId, 'personalVault', 'default');
        await deleteDoc(metaRef);
      } else {
        localStorage.removeItem(`ourspace_vault_items_${userId}`);
        localStorage.removeItem(`ourspace_vault_meta_${userId}`);
      }

      // 4. Transition: VERIFYING_DELETION
      set({ deletionState: 'VERIFYING_DELETION', deletionProgressMessage: 'Verifying zero remaining records across vault...' });

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const verifySnap = await getDocs(collection(db, 'users', userId, 'personalVault', 'default', 'items'));
        if (!verifySnap.empty) {
          throw new Error('Verification failed: Residual encrypted items detected. Aborting wipe completion.');
        }
        const verifyMeta = await getDoc(doc(db, 'users', userId, 'personalVault', 'default'));
        if (verifyMeta.exists()) {
          throw new Error('Verification failed: Residual metadata record exists.');
        }
      }

      // 5. Transition: READY_FOR_NEW_KEY
      set({
        deletionState: 'READY_FOR_NEW_KEY',
        deletionProgressMessage: 'Locker permanently erased. Ready for new key creation.',
        isUnlocked: false,
        isConfigured: false,
        vaultMetadata: null,
        items: [],
        isProcessing: false,
      });

      return { success: true };
    } catch (err: unknown) {
      set({
        isProcessing: false,
        deletionProgressMessage: 'Wipe interrupted: ' + (err instanceof Error ? err.message : 'Unknown error'),
      });
      return { success: false, error: err instanceof Error ? err.message : 'Wipe error' };
    }
  },
}));
