/**
 * OURSPACE 250 GB Global Storage Quota & Accounting Ledger (V2.5.0)
 *
 * Enforces the strict 250 GB application-level storage boundary across all couples:
 *  - MAX_OURSPACE_STORAGE_BYTES = 250,000,000,000 (250 GB decimal bytes)
 *  - Warning threshold at 150 GB
 *  - Critical warning threshold at 200 GB
 *  - Hard block on new uploads at 250 GB
 *  - Server-side atomic reservation before upload
 *  - Expiry and automatic rollback for abandoned reservations
 *  - Categorized breakdown: shared media, locker ciphertext, videos, voice notes, documents, thumbnails, backups
 */

import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import type {
  StorageLedger,
  StorageReservation,
  StorageWarningLevel,
  DriveMediaCategory,
} from '@ourspace/types';
import {
  MAX_OURSPACE_STORAGE_BYTES,
  STORAGE_WARNING_BYTES,
  STORAGE_CRITICAL_BYTES,
  getStorageWarningLevel,
} from '@ourspace/shared';

export class StorageQuotaExceededError extends Error {
  availableBytes: number;
  requestedBytes: number;
  maxBytes: number;

  constructor(availableBytes: number, requestedBytes: number, maxBytes = MAX_OURSPACE_STORAGE_BYTES) {
    const availGb = (availableBytes / 1_000_000_000).toFixed(2);
    const reqGb = (requestedBytes / 1_000_000_000).toFixed(2);
    super(
      `OURSPACE 250 GB storage quota exceeded. Requested: ${reqGb} GB, Available: ${availGb} GB.`
    );
    this.name = 'StorageQuotaExceededError';
    this.availableBytes = availableBytes;
    this.requestedBytes = requestedBytes;
    this.maxBytes = maxBytes;
  }
}

const DEFAULT_LEDGER: StorageLedger = {
  max_storage_bytes: MAX_OURSPACE_STORAGE_BYTES,
  verified_used_bytes: 0,
  reserved_upload_bytes: 0,
  available_bytes: MAX_OURSPACE_STORAGE_BYTES,
  total_files_count: 0,
  breakdown: {
    shared_media_bytes: 0,
    locker_ciphertext_bytes: 0,
    video_bytes: 0,
    voice_note_bytes: 0,
    document_bytes: 0,
    thumbnail_bytes: 0,
    backup_bytes: 0,
  },
  warning_level: 'NORMAL',
  last_reconciliation_at: null,
  updated_at: new Date().toISOString(),
};

/**
 * Maps DriveMediaCategory to its corresponding breakdown bucket
 */
function getBreakdownKey(category: DriveMediaCategory | string): keyof StorageLedger['breakdown'] {
  const norm = category.toUpperCase();
  if (norm.includes('LOCKER') || norm.startsWith('ENCRYPTED_')) return 'locker_ciphertext_bytes';
  if (norm.includes('VIDEO')) return 'video_bytes';
  if (norm.includes('VOICE') || norm.includes('AUDIO')) return 'voice_note_bytes';
  if (norm.includes('DOC')) return 'document_bytes';
  if (norm.includes('THUMB')) return 'thumbnail_bytes';
  if (norm.includes('BACKUP') || norm.includes('EXPORT') || norm.includes('RECORD')) return 'backup_bytes';
  return 'shared_media_bytes';
}

/**
 * Retrieves the current authoritative storage ledger
 */
export async function getStorageLedger(): Promise<StorageLedger> {
  if (!isFirebaseConfigured()) {
    return { ...DEFAULT_LEDGER };
  }

  const db = getFirebaseFirestore();
  const ledgerDocRef = doc(db, 'storageLedger', 'global');

  try {
    const snap = await getDoc(ledgerDocRef);
    if (!snap.exists()) {
      await setDoc(ledgerDocRef, { ...DEFAULT_LEDGER, createdAt: serverTimestamp() });
      return { ...DEFAULT_LEDGER };
    }

    const data = snap.data();
    const verified = Number(data.verified_used_bytes || 0);
    const reserved = Number(data.reserved_upload_bytes || 0);
    const max = Number(data.max_storage_bytes || MAX_OURSPACE_STORAGE_BYTES);
    const available = Math.max(0, max - (verified + reserved));

    return {
      max_storage_bytes: max,
      verified_used_bytes: verified,
      reserved_upload_bytes: reserved,
      available_bytes: available,
      total_files_count: Number(data.total_files_count || 0),
      breakdown: {
        shared_media_bytes: Number(data.breakdown?.shared_media_bytes || 0),
        locker_ciphertext_bytes: Number(data.breakdown?.locker_ciphertext_bytes || 0),
        video_bytes: Number(data.breakdown?.video_bytes || 0),
        voice_note_bytes: Number(data.breakdown?.voice_note_bytes || 0),
        document_bytes: Number(data.breakdown?.document_bytes || 0),
        thumbnail_bytes: Number(data.breakdown?.thumbnail_bytes || 0),
        backup_bytes: Number(data.breakdown?.backup_bytes || 0),
      },
      warning_level: getStorageWarningLevel(verified + reserved, max),
      last_reconciliation_at: data.last_reconciliation_at || null,
      updated_at: data.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[StorageLedger] Could not read ledger, returning default state:', err);
    return { ...DEFAULT_LEDGER };
  }
}

/**
 * Atomically reserves upload capacity before an upload session begins.
 * Prevents concurrent uploads from exceeding the remaining 250 GB limit.
 */
export async function reserveStorageQuota(
  reservationId: string,
  bytes: number,
  spaceId: string,
  userId: string,
  category: DriveMediaCategory
): Promise<StorageReservation> {
  if (!isFirebaseConfigured()) {
    // In local dev without credentials, grant reservation
    return {
      id: reservationId,
      space_id: spaceId,
      user_id: userId,
      category,
      bytes,
      status: 'RESERVED',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    };
  }

  const db = getFirebaseFirestore();
  const ledgerDocRef = doc(db, 'storageLedger', 'global');
  const reservationDocRef = doc(db, 'storageLedger', 'global', 'reservations', reservationId);

  const expiresAt = new Date(Date.now() + 3600_000).toISOString(); // 1 hour lease

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ledgerDocRef);
    const data = snap.exists() ? snap.data() : { ...DEFAULT_LEDGER };

    const max = Number(data.max_storage_bytes || MAX_OURSPACE_STORAGE_BYTES);
    const verified = Number(data.verified_used_bytes || 0);
    const reserved = Number(data.reserved_upload_bytes || 0);

    const projectedUsage = verified + reserved + bytes;
    if (projectedUsage > max) {
      const available = Math.max(0, max - (verified + reserved));
      throw new StorageQuotaExceededError(available, bytes, max);
    }

    const newReserved = reserved + bytes;
    const newAvailable = Math.max(0, max - (verified + newReserved));
    const warningLevel = getStorageWarningLevel(verified + newReserved, max);

    tx.set(
      ledgerDocRef,
      {
        reserved_upload_bytes: newReserved,
        available_bytes: newAvailable,
        warning_level: warningLevel,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    tx.set(reservationDocRef, {
      id: reservationId,
      space_id: spaceId,
      user_id: userId,
      category,
      bytes,
      status: 'RESERVED',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });
  });

  return {
    id: reservationId,
    space_id: spaceId,
    user_id: userId,
    category,
    bytes,
    status: 'RESERVED',
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  };
}

/**
 * Commits a completed upload, converting reserved capacity into verified used bytes.
 */
export async function commitStorageQuota(
  reservationId: string,
  actualBytes: number,
  category: DriveMediaCategory
): Promise<StorageLedger> {
  if (!isFirebaseConfigured()) {
    return { ...DEFAULT_LEDGER };
  }

  const db = getFirebaseFirestore();
  const ledgerDocRef = doc(db, 'storageLedger', 'global');
  const reservationDocRef = doc(db, 'storageLedger', 'global', 'reservations', reservationId);
  const breakdownKey = getBreakdownKey(category);

  return await runTransaction(db, async (tx) => {
    const ledgerSnap = await tx.get(ledgerDocRef);
    const ledgerData = ledgerSnap.exists() ? ledgerSnap.data() : { ...DEFAULT_LEDGER };

    const resSnap = await tx.get(reservationDocRef);
    const resData = resSnap.exists() ? resSnap.data() : null;

    const reservedAmount = Number(resData?.bytes || actualBytes);
    const max = Number(ledgerData.max_storage_bytes || MAX_OURSPACE_STORAGE_BYTES);
    const currentVerified = Number(ledgerData.verified_used_bytes || 0);
    const currentReserved = Number(ledgerData.reserved_upload_bytes || 0);

    // Release reserved capacity and record verified usage
    const newReserved = Math.max(0, currentReserved - reservedAmount);
    const newVerified = currentVerified + actualBytes;
    const newAvailable = Math.max(0, max - (newVerified + newReserved));
    const currentBreakdown = ledgerData.breakdown || {};
    const newCategoryBytes = Number(currentBreakdown[breakdownKey] || 0) + actualBytes;
    const newTotalCount = Number(ledgerData.total_files_count || 0) + 1;
    const warningLevel = getStorageWarningLevel(newVerified + newReserved, max);

    const updatedLedger: Partial<StorageLedger> = {
      verified_used_bytes: newVerified,
      reserved_upload_bytes: newReserved,
      available_bytes: newAvailable,
      total_files_count: newTotalCount,
      breakdown: {
        ...currentBreakdown,
        [breakdownKey]: newCategoryBytes,
      },
      warning_level: warningLevel,
      updated_at: new Date().toISOString(),
    };

    tx.set(ledgerDocRef, updatedLedger, { merge: true });
    tx.set(
      reservationDocRef,
      {
        status: 'COMMITTED',
        actual_bytes: actualBytes,
        committed_at: new Date().toISOString(),
      },
      { merge: true }
    );

    return {
      max_storage_bytes: max,
      verified_used_bytes: newVerified,
      reserved_upload_bytes: newReserved,
      available_bytes: newAvailable,
      total_files_count: newTotalCount,
      breakdown: updatedLedger.breakdown as any,
      warning_level: warningLevel,
      last_reconciliation_at: ledgerData.last_reconciliation_at || null,
      updated_at: updatedLedger.updated_at!,
    };
  });
}

/**
 * Releases reserved upload capacity after a failed, cancelled, or expired upload.
 */
export async function releaseStorageQuota(reservationId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;

  const db = getFirebaseFirestore();
  const ledgerDocRef = doc(db, 'storageLedger', 'global');
  const reservationDocRef = doc(db, 'storageLedger', 'global', 'reservations', reservationId);

  try {
    await runTransaction(db, async (tx) => {
      const resSnap = await tx.get(reservationDocRef);
      if (!resSnap.exists()) return;
      const resData = resSnap.data();

      // Only release if still in RESERVED state
      if (resData.status !== 'RESERVED') return;

      const bytesToRelease = Number(resData.bytes || 0);

      const ledgerSnap = await tx.get(ledgerDocRef);
      if (ledgerSnap.exists()) {
        const ledgerData = ledgerSnap.data();
        const currentReserved = Number(ledgerData.reserved_upload_bytes || 0);
        const verified = Number(ledgerData.verified_used_bytes || 0);
        const max = Number(ledgerData.max_storage_bytes || MAX_OURSPACE_STORAGE_BYTES);

        const newReserved = Math.max(0, currentReserved - bytesToRelease);
        const newAvailable = Math.max(0, max - (verified + newReserved));
        const warningLevel = getStorageWarningLevel(verified + newReserved, max);

        tx.set(
          ledgerDocRef,
          {
            reserved_upload_bytes: newReserved,
            available_bytes: newAvailable,
            warning_level: warningLevel,
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      tx.set(
        reservationDocRef,
        {
          status: 'CANCELLED',
          released_at: new Date().toISOString(),
        },
        { merge: true }
      );
    });
  } catch (err) {
    console.warn(`[StorageLedger] Failed to release reservation ${reservationId}:`, err);
  }
}

/**
 * Decrements verified storage usage when a file is permanently deleted by authorized users.
 */
export async function releaseDeletedFileQuota(bytes: number, category: DriveMediaCategory): Promise<void> {
  if (!isFirebaseConfigured() || bytes <= 0) return;

  const db = getFirebaseFirestore();
  const ledgerDocRef = doc(db, 'storageLedger', 'global');
  const breakdownKey = getBreakdownKey(category);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ledgerDocRef);
      if (!snap.exists()) return;
      const data = snap.data();

      const max = Number(data.max_storage_bytes || MAX_OURSPACE_STORAGE_BYTES);
      const verified = Number(data.verified_used_bytes || 0);
      const reserved = Number(data.reserved_upload_bytes || 0);
      const breakdown = data.breakdown || {};

      const newVerified = Math.max(0, verified - bytes);
      const newCategoryBytes = Math.max(0, Number(breakdown[breakdownKey] || 0) - bytes);
      const newTotalCount = Math.max(0, Number(data.total_files_count || 1) - 1);
      const newAvailable = Math.max(0, max - (newVerified + reserved));
      const warningLevel = getStorageWarningLevel(newVerified + reserved, max);

      tx.set(
        ledgerDocRef,
        {
          verified_used_bytes: newVerified,
          available_bytes: newAvailable,
          total_files_count: newTotalCount,
          warning_level: warningLevel,
          breakdown: {
            ...breakdown,
            [breakdownKey]: newCategoryBytes,
          },
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
    });
  } catch (err) {
    console.warn('[StorageLedger] Failed to release deleted file quota:', err);
  }
}

/**
 * Reconciles storage ledger against expired reservations and active records.
 * Automatically releases abandoned reservations older than 1 hour.
 */
export async function reconcileStorageLedger(): Promise<StorageLedger> {
  if (!isFirebaseConfigured()) return { ...DEFAULT_LEDGER };

  const db = getFirebaseFirestore();
  const ledgerDocRef = doc(db, 'storageLedger', 'global');
  const reservationsColRef = collection(db, 'storageLedger', 'global', 'reservations');

  const nowIso = new Date().toISOString();
  let expiredBytesReclaimed = 0;

  try {
    // Find all expired reservations still marked as 'RESERVED'
    const expiredSnap = await getDocs(
      query(reservationsColRef, where('status', '==', 'RESERVED'), where('expires_at', '<', nowIso))
    );

    for (const docSnap of expiredSnap.docs) {
      const data = docSnap.data();
      expiredBytesReclaimed += Number(data.bytes || 0);
      await setDoc(
        docSnap.ref,
        { status: 'EXPIRED', expired_at: nowIso },
        { merge: true }
      );
    }

    if (expiredBytesReclaimed > 0) {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ledgerDocRef);
        if (!snap.exists()) return;
        const data = snap.data();

        const currentReserved = Number(data.reserved_upload_bytes || 0);
        const verified = Number(data.verified_used_bytes || 0);
        const max = Number(data.max_storage_bytes || MAX_OURSPACE_STORAGE_BYTES);

        const newReserved = Math.max(0, currentReserved - expiredBytesReclaimed);
        const newAvailable = Math.max(0, max - (verified + newReserved));

        tx.set(
          ledgerDocRef,
          {
            reserved_upload_bytes: newReserved,
            available_bytes: newAvailable,
            warning_level: getStorageWarningLevel(verified + newReserved, max),
            last_reconciliation_at: nowIso,
            updated_at: nowIso,
          },
          { merge: true }
        );
      });
    } else {
      await setDoc(
        ledgerDocRef,
        { last_reconciliation_at: nowIso, updated_at: nowIso },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('[StorageLedger] Reconciliation error:', err);
  }

  return await getStorageLedger();
}
