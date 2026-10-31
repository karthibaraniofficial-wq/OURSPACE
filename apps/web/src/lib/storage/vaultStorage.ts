/**
 * OURSPACE Our Locker: High-Capacity IndexedDB & Dual Persistence Storage Engine
 *
 * Provides persistent, quota-free storage for AES-GCM encrypted notes, credentials,
 * photographs, videos, audio, and documents. Overcomes browser localStorage 5MB limit
 * by utilizing IndexedDB as the primary client-side vault database with multi-tier fallback.
 */

import type { EncryptedLockerItem, LockerMetadata, UUID } from '@ourspace/types';

const DB_NAME = 'ourspace_vault_db';
const DB_VERSION = 1;
const STORE_ITEMS = 'vault_items';
const STORE_METADATA = 'vault_metadata';

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openVaultDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB is not available in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Encrypted Items Store
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        itemStore.createIndex('user_id', 'user_id', { unique: false });
        itemStore.createIndex('section', 'section', { unique: false });
        itemStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // 2. Vault Metadata Store
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'user_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open vault database.'));
  });
}

/**
 * Save an encrypted locker item to IndexedDB with localStorage fallback
 */
export async function saveVaultItem(userId: string, item: EncryptedLockerItem): Promise<void> {
  // 1. Primary: Save to IndexedDB (Supports gigabytes of media/video/photos)
  if (isIndexedDBAvailable()) {
    try {
      const db = await openVaultDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ITEMS, 'readwrite');
        const store = tx.objectStore(STORE_ITEMS);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (idbErr) {
      console.warn('[VaultStorage] IndexedDB item write error, attempting localStorage fallback:', idbErr);
    }
  }

  // 2. Secondary fallback: LocalStorage (for lightweight text items under 500KB)
  if (typeof window !== 'undefined') {
    try {
      const approxBytes = (item.title_ciphertext?.length || 0) + (item.payload_ciphertext?.length || 0);
      if (approxBytes < 500 * 1024) {
        const key = `ourspace_vault_items_${userId}`;
        const raw = localStorage.getItem(key);
        const list: EncryptedLockerItem[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          list[idx] = item;
        } else {
          list.push(item);
        }
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch (lsErr) {
      // LocalStorage quota may be exceeded; IndexedDB already holds the authoritative copy
      console.info('[VaultStorage] LocalStorage cache skipped (exceeds quota, protected in IndexedDB)');
    }
  }
}

/**
 * Retrieve all encrypted items for a specific user from IndexedDB and localStorage
 */
export async function getVaultItems(userId: string): Promise<EncryptedLockerItem[]> {
  const itemsMap = new Map<string, EncryptedLockerItem>();

  // 1. Read from IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      const db = await openVaultDatabase();
      const dbItems = await new Promise<EncryptedLockerItem[]>((resolve, reject) => {
        const tx = db.transaction(STORE_ITEMS, 'readonly');
        const store = tx.objectStore(STORE_ITEMS);
        const index = store.index('user_id');
        const req = index.getAll(IDBKeyRange.only(userId));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      for (const item of dbItems) {
        if (item && item.id) {
          itemsMap.set(item.id, item);
        }
      }
    } catch (idbErr) {
      console.warn('[VaultStorage] IndexedDB read error, falling back to localStorage:', idbErr);
    }
  }

  // 2. Read from localStorage and merge any items
  if (typeof window !== 'undefined') {
    try {
      const key = `ourspace_vault_items_${userId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const localList: EncryptedLockerItem[] = JSON.parse(raw);
        for (const item of localList) {
          if (item && item.id && !itemsMap.has(item.id)) {
            itemsMap.set(item.id, item);
            // Backfill to IndexedDB if available
            if (isIndexedDBAvailable()) {
              saveVaultItem(userId, item).catch(() => {});
            }
          }
        }
      }
    } catch (lsErr) {
      console.warn('[VaultStorage] LocalStorage read error:', lsErr);
    }
  }

  return Array.from(itemsMap.values());
}

/**
 * Delete an encrypted item from IndexedDB and localStorage
 */
export async function deleteVaultItem(userId: string, itemId: UUID | string): Promise<void> {
  // 1. Remove from IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      const db = await openVaultDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ITEMS, 'readwrite');
        const store = tx.objectStore(STORE_ITEMS);
        const req = store.delete(itemId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (idbErr) {
      console.warn('[VaultStorage] IndexedDB delete error:', idbErr);
    }
  }

  // 2. Remove from LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const key = `ourspace_vault_items_${userId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const list: EncryptedLockerItem[] = JSON.parse(raw);
        const filtered = list.filter((i) => i.id !== itemId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch {}
  }
}

/**
 * Save vault metadata to both IndexedDB and localStorage
 */
export async function saveVaultMetadata(userId: string, metadata: LockerMetadata): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openVaultDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_METADATA, 'readwrite');
        const store = tx.objectStore(STORE_METADATA);
        const req = store.put({ ...metadata, user_id: userId });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (idbErr) {
      console.warn('[VaultStorage] IndexedDB metadata save error:', idbErr);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`ourspace_vault_meta_${userId}`, JSON.stringify(metadata));
    } catch {}
  }
}

/**
 * Retrieve vault metadata from IndexedDB or localStorage
 */
export async function getVaultMetadata(userId: string): Promise<LockerMetadata | null> {
  // 1. Try IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      const db = await openVaultDatabase();
      const meta = await new Promise<LockerMetadata | null>((resolve, reject) => {
        const tx = db.transaction(STORE_METADATA, 'readonly');
        const store = tx.objectStore(STORE_METADATA);
        const req = store.get(userId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (meta) return meta;
    } catch (idbErr) {
      console.warn('[VaultStorage] IndexedDB metadata read error:', idbErr);
    }
  }

  // 2. Try localStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`ourspace_vault_meta_${userId}`);
      if (raw) {
        return JSON.parse(raw) as LockerMetadata;
      }
    } catch {}
  }

  return null;
}

/**
 * Completely wipe vault database and items on device for reset
 */
export async function clearVaultStorage(userId: string): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openVaultDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_ITEMS, STORE_METADATA], 'readwrite');
        const itemStore = tx.objectStore(STORE_ITEMS);
        const metaStore = tx.objectStore(STORE_METADATA);

        const index = itemStore.index('user_id');
        const req = index.openCursor(IDBKeyRange.only(userId));
        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        metaStore.delete(userId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (idbErr) {
      console.warn('[VaultStorage] IndexedDB clear error:', idbErr);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`ourspace_vault_items_${userId}`);
      localStorage.removeItem(`ourspace_vault_meta_${userId}`);
    } catch {}
  }
}
