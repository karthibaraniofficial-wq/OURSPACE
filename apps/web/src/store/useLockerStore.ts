import { create } from 'zustand';
import type {
  LockerSection,
  LockerMetadata,
  LockerDeletionState,
  DecryptedLockerItem,
  EncryptedLockerItem,
  LockerBackupStatus,
  LockerBackupManifest,
  UUID,
} from '@ourspace/types';
import {
  deriveKeyFromPassword,
  computeKeyVerifier,
  encryptPayload,
  decryptPayload,
  generateRandomBytes,
  bufferToHex,
  generateMasterKey,
  generateRecoveryKey,
  deriveWrappingKey,
  wrapMasterKey,
  unwrapMasterKey,
} from '@/lib/crypto/vaultCrypto';
import {
  createEncryptedLockerBackup,
  restoreEncryptedLockerBackup,
  purgeAllLockerBackups,
  verifyEncryptedLockerBackup,
} from '@/lib/drive/lockerDriveBackup';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
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
  lastGeneratedRecoveryKey: string | null;
  backupStatus: LockerBackupStatus;
  lastBackupAt: string | null;

  // Actions
  loadVaultMetadata: (userId: string) => Promise<void>;
  setupLocker: (userId: string, masterPassword: string) => Promise<{ success: boolean; recoveryKey?: string; error?: string }>;
  unlockLocker: (userId: string, masterPassword: string) => Promise<{ success: boolean; error?: string }>;
  unlockWithRecoveryKey: (userId: string, recoveryKey: string) => Promise<{ success: boolean; error?: string }>;
  changeMasterPassword: (userId: string, currentSecret: string, newPassword: string, isRecovery?: boolean) => Promise<{ success: boolean; error?: string }>;
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
  triggerEncryptedBackup: (userId: string) => Promise<{ success: boolean; manifest?: LockerBackupManifest; error?: string }>;
  restoreFromBackup: (userId: string, backupId?: string) => Promise<{ success: boolean; itemCount?: number; error?: string }>;
  verifyCurrentBackup: (userId: string) => Promise<{ success: boolean; isVerified: boolean; error?: string }>;
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
  lastGeneratedRecoveryKey: null,
  backupStatus: 'IDLE',
  lastBackupAt: null,

  setSelectedSection: (section) => set({ selectedSection: section }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  loadVaultMetadata: async (userId: string) => {
    if (!isFirebaseConfigured()) {
      const localMeta = localStorage.getItem(`ourspace_vault_meta_${userId}`);
      if (localMeta) {
        try {
          const meta = JSON.parse(localMeta) as LockerMetadata;
          set({
            isConfigured: true,
            vaultMetadata: meta,
            deletionState: meta.deletion_state || 'ACTIVE',
            lastBackupAt: meta.last_backup_at || null,
            backupStatus: meta.backup_status || 'IDLE',
          });
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
        set({
          isConfigured: true,
          vaultMetadata: data,
          deletionState: data.deletion_state || 'ACTIVE',
          lastBackupAt: data.last_backup_at || null,
          backupStatus: data.backup_status || 'IDLE',
        });
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
      // 1. Generate 256-bit AES-GCM Locker Master Key
      const masterKey = await generateMasterKey();

      // 2. Derive wrapping key from user's master password (PBKDF2 100k rounds)
      const salt = bufferToHex(generateRandomBytes(16));
      const passwordWrappingKey = await deriveWrappingKey(masterPassword, salt);
      const wrappedPasswordEnvelope = await wrapMasterKey(masterKey, passwordWrappingKey);

      // 3. Generate high-entropy recovery key and wrap master key for recovery
      const recoveryKey = generateRecoveryKey();
      const recoverySalt = bufferToHex(generateRandomBytes(16));
      const recoveryWrappingKey = await deriveWrappingKey(recoveryKey, recoverySalt);
      const wrappedRecoveryEnvelope = await wrapMasterKey(masterKey, recoveryWrappingKey);

      // 4. Verifier hash for immediate authentication check
      const verifierHash = await computeKeyVerifier(passwordWrappingKey);

      const metadata: LockerMetadata = {
        vault_id: 'default',
        user_id: userId,
        key_version: 2,
        salt,
        iv: wrappedPasswordEnvelope.iv,
        verifier_hash: verifierHash,
        deletion_state: 'ACTIVE',
        failed_attempts: 0,
        lockout_until: null,
        auto_lock_timeout_minutes: 5,
        key_envelope: {
          wrapped_master_key: wrappedPasswordEnvelope.wrappedKey,
          iv: wrappedPasswordEnvelope.iv,
          salt,
          recovery_wrapped_master_key: wrappedRecoveryEnvelope.wrappedKey,
          recovery_iv: wrappedRecoveryEnvelope.iv,
          recovery_salt: recoverySalt,
        },
        last_backup_at: null,
        backup_status: 'IDLE',
        backup_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        await setDoc(doc(db, 'users', userId, 'personalVault', 'default'), metadata);
      } else {
        localStorage.setItem(`ourspace_vault_meta_${userId}`, JSON.stringify(metadata));
      }

      activeSessionKey = masterKey;
      set({
        isConfigured: true,
        isUnlocked: true,
        vaultMetadata: metadata,
        items: [],
        deletionState: 'ACTIVE',
        lastGeneratedRecoveryKey: recoveryKey,
        isProcessing: false,
      });

      return { success: true, recoveryKey };
    } catch (err: unknown) {
      set({ isProcessing: false });
      return { success: false, error: err instanceof Error ? err.message : 'Locker initialization failed.' };
    }
  },

  unlockLocker: async (userId: string, masterPassword: string) => {
    const { vaultMetadata, failedAttempts, lockoutUntil } = get();

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
      let resolvedKey: CryptoKey;

      if (currentMeta.key_envelope?.wrapped_master_key) {
        // Modern V2.4.1 Key Architecture: Unwrap Master Key
        const wrappingKey = await deriveWrappingKey(masterPassword, currentMeta.key_envelope.salt);
        const computedVerifier = await computeKeyVerifier(wrappingKey);

        if (computedVerifier !== currentMeta.verifier_hash) {
          const newAttempts = failedAttempts + 1;
          const newLockout = newAttempts >= 5 ? Date.now() + 60000 : newAttempts >= 3 ? Date.now() + 15000 : null;
          set({ failedAttempts: newAttempts, lockoutUntil: newLockout, isProcessing: false });
          return { success: false, error: 'Incorrect master password. Access denied.' };
        }

        resolvedKey = await unwrapMasterKey(
          currentMeta.key_envelope.wrapped_master_key,
          currentMeta.key_envelope.iv,
          wrappingKey
        );
      } else {
        // Legacy fallback
        const derivedKey = await deriveKeyFromPassword(masterPassword, currentMeta.salt);
        const computedVerifier = await computeKeyVerifier(derivedKey);
        if (computedVerifier !== currentMeta.verifier_hash) {
          const newAttempts = failedAttempts + 1;
          const newLockout = newAttempts >= 5 ? Date.now() + 60000 : newAttempts >= 3 ? Date.now() + 15000 : null;
          set({ failedAttempts: newAttempts, lockoutUntil: newLockout, isProcessing: false });
          return { success: false, error: 'Incorrect master password. Access denied.' };
        }
        resolvedKey = derivedKey;
      }

      activeSessionKey = resolvedKey;

      // Fetch and decrypt items
      const decryptedList: DecryptedLockerItem[] = [];

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const itemsColl = collection(db, 'users', userId, 'personalVault', 'default', 'items');
        const snap = await getDocs(itemsColl);

        for (const docSnap of snap.docs) {
          const itemData = docSnap.data() as EncryptedLockerItem;
          try {
            const title = await decryptPayload(itemData.title_ciphertext, itemData.iv, resolvedKey);
            const payload = await decryptPayload(itemData.payload_ciphertext, itemData.iv, resolvedKey);
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
            // Corrupt or tampered item skipped
          }
        }
      } else {
        const localItems = localStorage.getItem(`ourspace_vault_items_${userId}`);
        if (localItems) {
          const encList = JSON.parse(localItems) as EncryptedLockerItem[];
          for (const itemData of encList) {
            try {
              const title = await decryptPayload(itemData.title_ciphertext, itemData.iv, resolvedKey);
              const payload = await decryptPayload(itemData.payload_ciphertext, itemData.iv, resolvedKey);
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
              // Ignore corrupt
            }
          }
        }
      }

      // Auto-lock timer (5 minutes)
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

  unlockWithRecoveryKey: async (userId: string, recoveryKey: string) => {
    const { vaultMetadata } = get();
    if (!vaultMetadata) {
      await get().loadVaultMetadata(userId);
    }
    const currentMeta = get().vaultMetadata;
    if (!currentMeta?.key_envelope?.recovery_wrapped_master_key || !currentMeta.key_envelope.recovery_salt) {
      return { success: false, error: 'No recovery key is registered for this locker.' };
    }

    set({ isProcessing: true });
    try {
      const recoveryWrappingKey = await deriveWrappingKey(recoveryKey, currentMeta.key_envelope.recovery_salt);
      const masterKey = await unwrapMasterKey(
        currentMeta.key_envelope.recovery_wrapped_master_key,
        currentMeta.key_envelope.recovery_iv || currentMeta.key_envelope.iv,
        recoveryWrappingKey
      );

      activeSessionKey = masterKey;

      // Decrypt items
      const decryptedList: DecryptedLockerItem[] = [];
      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const snap = await getDocs(collection(db, 'users', userId, 'personalVault', 'default', 'items'));
        for (const docSnap of snap.docs) {
          const itemData = docSnap.data() as EncryptedLockerItem;
          try {
            const title = await decryptPayload(itemData.title_ciphertext, itemData.iv, masterKey);
            const payload = await decryptPayload(itemData.payload_ciphertext, itemData.iv, masterKey);
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
            // Ignore
          }
        }
      }

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
      return { success: false, error: err instanceof Error ? err.message : 'Invalid recovery key.' };
    }
  },

  changeMasterPassword: async (userId: string, currentSecret: string, newPassword: string, isRecovery = false) => {
    const { vaultMetadata } = get();
    if (!vaultMetadata || !vaultMetadata.key_envelope?.wrapped_master_key) {
      return { success: false, error: 'Vault metadata unavailable or unconfigured.' };
    }

    set({ isProcessing: true });
    try {
      // 1. Unwrap current master key using current password or recovery key
      let masterKey: CryptoKey;
      if (isRecovery) {
        if (!vaultMetadata.key_envelope.recovery_wrapped_master_key || !vaultMetadata.key_envelope.recovery_salt) {
          throw new Error('Recovery key not configured on vault.');
        }
        const recWrapKey = await deriveWrappingKey(currentSecret, vaultMetadata.key_envelope.recovery_salt);
        masterKey = await unwrapMasterKey(
          vaultMetadata.key_envelope.recovery_wrapped_master_key,
          vaultMetadata.key_envelope.recovery_iv || vaultMetadata.key_envelope.iv,
          recWrapKey
        );
      } else {
        const oldWrapKey = await deriveWrappingKey(currentSecret, vaultMetadata.key_envelope.salt);
        masterKey = await unwrapMasterKey(
          vaultMetadata.key_envelope.wrapped_master_key,
          vaultMetadata.key_envelope.iv,
          oldWrapKey
        );
      }

      // 2. Derive new password wrapping key and rewrap master key
      const newSalt = bufferToHex(generateRandomBytes(16));
      const newWrappingKey = await deriveWrappingKey(newPassword, newSalt);
      const newWrappedEnvelope = await wrapMasterKey(masterKey, newWrappingKey);
      const newVerifier = await computeKeyVerifier(newWrappingKey);

      // 3. Update metadata envelope (Preserves master key and all backups!)
      const updatedMetadata: LockerMetadata = {
        ...vaultMetadata,
        salt: newSalt,
        iv: newWrappedEnvelope.iv,
        verifier_hash: newVerifier,
        key_envelope: {
          ...vaultMetadata.key_envelope,
          wrapped_master_key: newWrappedEnvelope.wrappedKey,
          iv: newWrappedEnvelope.iv,
          salt: newSalt,
        },
        updated_at: new Date().toISOString(),
      };

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        await updateDoc(doc(db, 'users', userId, 'personalVault', 'default'), updatedMetadata as any);
      } else {
        localStorage.setItem(`ourspace_vault_meta_${userId}`, JSON.stringify(updatedMetadata));
      }

      activeSessionKey = masterKey;
      set({ vaultMetadata: updatedMetadata, isProcessing: false });
      return { success: true };
    } catch (err: unknown) {
      set({ isProcessing: false });
      return { success: false, error: err instanceof Error ? err.message : 'Password change failed.' };
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
      vault_key_version: vaultMetadata?.key_version || 2,
      item_count: items.length,
      disclaimer: 'This file contains unencrypted sensitive information. Store securely.',
      items,
    };
    return JSON.stringify(exportData, null, 2);
  },

  triggerEncryptedBackup: async (userId: string) => {
    if (!activeSessionKey) {
      return { success: false, error: 'Locker must be unlocked to perform encrypted backup.' };
    }
    const { vaultMetadata } = get();
    if (!vaultMetadata) {
      return { success: false, error: 'Vault metadata missing.' };
    }

    set({ backupStatus: 'BACKING_UP', isProcessing: true });
    try {
      // Fetch raw encrypted items
      let rawEncryptedItems: EncryptedLockerItem[] = [];
      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const snap = await getDocs(collection(db, 'users', userId, 'personalVault', 'default', 'items'));
        rawEncryptedItems = snap.docs.map((d) => d.data() as EncryptedLockerItem);
      } else {
        const raw = localStorage.getItem(`ourspace_vault_items_${userId}`);
        rawEncryptedItems = raw ? JSON.parse(raw) : [];
      }

      const res = await createEncryptedLockerBackup(userId, activeSessionKey, rawEncryptedItems, vaultMetadata);
      if (res.success && res.manifest) {
        set({
          backupStatus: 'VERIFIED',
          lastBackupAt: res.manifest.timestamp,
          isProcessing: false,
        });
        return { success: true, manifest: res.manifest };
      } else {
        set({ backupStatus: 'FAILED', isProcessing: false });
        return { success: false, error: res.error || 'Backup creation failed.' };
      }
    } catch (err: unknown) {
      set({ backupStatus: 'FAILED', isProcessing: false });
      return { success: false, error: err instanceof Error ? err.message : 'Backup error.' };
    }
  },

  restoreFromBackup: async (userId: string, backupId?: string) => {
    if (!activeSessionKey) {
      return { success: false, error: 'Locker must be unlocked with master password or recovery key to restore.' };
    }

    set({ isProcessing: true, backupStatus: 'RESTORING' });
    try {
      const res = await restoreEncryptedLockerBackup(userId, activeSessionKey, backupId);
      if (res.success && res.items) {
        // Re-decrypt restored items into memory
        const decryptedList: DecryptedLockerItem[] = [];
        for (const itemData of res.items) {
          try {
            const title = await decryptPayload(itemData.title_ciphertext, itemData.iv, activeSessionKey);
            const payload = await decryptPayload(itemData.payload_ciphertext, itemData.iv, activeSessionKey);
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
            // Skip corrupt
          }
        }

        set({
          items: decryptedList,
          backupStatus: 'VERIFIED',
          isProcessing: false,
        });
        return { success: true, itemCount: decryptedList.length };
      } else {
        set({ backupStatus: 'FAILED', isProcessing: false });
        return { success: false, error: res.error || 'Restore failed.' };
      }
    } catch (err: unknown) {
      set({ backupStatus: 'FAILED', isProcessing: false });
      return { success: false, error: err instanceof Error ? err.message : 'Restore error.' };
    }
  },

  verifyCurrentBackup: async (userId: string) => {
    try {
      let rawEncryptedItems: EncryptedLockerItem[] = [];
      let manifest: LockerBackupManifest | null = null;

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const snap = await getDocs(collection(db, 'users', userId, 'personalVault', 'default', 'items'));
        rawEncryptedItems = snap.docs.map((d) => d.data() as EncryptedLockerItem);

        const bkpSnap = await getDocs(collection(db, 'users', userId, 'secureLockerBackups'));
        if (!bkpSnap.empty) {
          const sorted = bkpSnap.docs
            .map((d) => d.data().manifest as LockerBackupManifest)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          manifest = sorted[0];
        }
      } else {
        const raw = localStorage.getItem(`ourspace_vault_items_${userId}`);
        rawEncryptedItems = raw ? JSON.parse(raw) : [];
        const bkpRaw = localStorage.getItem(`ourspace_locker_backups_${userId}`);
        if (bkpRaw) {
          const list = JSON.parse(bkpRaw);
          if (list.length > 0) manifest = list[0].manifest;
        }
      }

      if (!manifest) {
        return { success: false, isVerified: false, error: 'No existing backup manifest found to verify.' };
      }

      const isValid = await verifyEncryptedLockerBackup(manifest, rawEncryptedItems);
      return { success: true, isVerified: isValid };
    } catch (err: unknown) {
      return { success: false, isVerified: false, error: err instanceof Error ? err.message : 'Verification failed.' };
    }
  },

  // ========================================================================
  // CRITICAL REQUIREMENT: COMPLETE DELETION STATE MACHINE
  // ACTIVE -> LOCKED_FOR_DELETION -> FIREBASE_PURGING -> DRIVE_PURGING -> METADATA_PURGING -> VERIFYING_ALL_LOCATIONS -> OLD_KEYS_DESTROYED -> READY_FOR_NEW_LOCKER
  // ========================================================================
  resetAndEraseLocker: async (userId, confirmationPhrase) => {
    if (confirmationPhrase.trim() !== 'DELETE MY LOCKER') {
      return { success: false, error: 'Confirmation phrase must match "DELETE MY LOCKER" exactly.' };
    }

    set({ isProcessing: true });

    try {
      // 1. LOCKED_FOR_DELETION
      set({ deletionState: 'LOCKED_FOR_DELETION', deletionProgressMessage: 'Locking vault and initiating purge sequence...' });
      activeSessionKey = null;
      if (autoLockTimer) clearTimeout(autoLockTimer);

      // 2. FIREBASE_PURGING
      set({ deletionState: 'FIREBASE_PURGING', deletionProgressMessage: 'Purging Firebase encrypted items, documents, and records...' });
      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const itemsColl = collection(db, 'users', userId, 'personalVault', 'default', 'items');
        const snap = await getDocs(itemsColl);
        for (const docSnap of snap.docs) {
          await deleteDoc(docSnap.ref);
        }
      } else {
        localStorage.removeItem(`ourspace_vault_items_${userId}`);
      }

      // 3. DRIVE_PURGING (Purge all encrypted cloud backup snapshots)
      set({ deletionState: 'DRIVE_PURGING', deletionProgressMessage: 'Purging all encrypted Google Drive and cloud backup snapshots...' });
      await purgeAllLockerBackups(userId);

      // 4. METADATA_PURGING
      set({ deletionState: 'METADATA_PURGING', deletionProgressMessage: 'Erasing vault metadata, verifier hashes, and key wrappers...' });
      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const metaRef = doc(db, 'users', userId, 'personalVault', 'default');
        await deleteDoc(metaRef);
      } else {
        localStorage.removeItem(`ourspace_vault_meta_${userId}`);
      }

      // 5. VERIFYING_ALL_LOCATIONS
      set({ deletionState: 'VERIFYING_ALL_LOCATIONS', deletionProgressMessage: 'Verifying zero remaining records across cloud and local storage...' });
      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        const checkItems = await getDocs(collection(db, 'users', userId, 'personalVault', 'default', 'items'));
        if (!checkItems.empty) throw new Error('Verification failed: Residual items detected in Firestore.');
        const checkBackups = await getDocs(collection(db, 'users', userId, 'secureLockerBackups'));
        if (!checkBackups.empty) throw new Error('Verification failed: Residual backups detected in cloud storage.');
        const checkMeta = await getDoc(doc(db, 'users', userId, 'personalVault', 'default'));
        if (checkMeta.exists()) throw new Error('Verification failed: Residual metadata detected.');
      }

      // 6. OLD_KEYS_DESTROYED
      set({ deletionState: 'OLD_KEYS_DESTROYED', deletionProgressMessage: 'Destroying cryptographic keys in memory and local session...' });
      activeSessionKey = null;

      // 7. READY_FOR_NEW_LOCKER
      set({
        deletionState: 'READY_FOR_NEW_LOCKER',
        deletionProgressMessage: 'Locker permanently erased. Ready for new key creation.',
        isUnlocked: false,
        isConfigured: false,
        vaultMetadata: null,
        items: [],
        lastGeneratedRecoveryKey: null,
        backupStatus: 'IDLE',
        lastBackupAt: null,
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
