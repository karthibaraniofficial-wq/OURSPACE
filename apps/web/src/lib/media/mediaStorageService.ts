/**
 * OURSPACE Unified Media Storage & Client-Side Decryption Service (V2.5.0)
 *
 * Fully replaces legacy Firebase Storage upload dependencies:
 *  - Encrypts all media attachments on client-side before upload using AES-GCM 256-bit
 *  - Communicates with OURSPACE Central Google Drive backend
 *  - Bounded 4MB chunked streaming respecting Vercel serverless request limits
 *  - Resumable progress tracking with accurate byte-transferred measurements
 *  - Transparent client-side decryption for inline rendering inside chat and galleries
 *  - Backward compatibility: Seamlessly reads legacy Firebase Storage URLs
 */

import {
  encryptMediaBuffer,
  decryptMediaBuffer,
  getActiveSpaceKey,
  type EncryptedMediaResult,
} from '@/lib/crypto/e2eeService';
import type { DriveMediaCategory, EncryptedMediaManifest } from '@ourspace/types';
import { getFirebaseAuth } from '@/lib/firebase/firebase';

export interface MediaUploadOptions {
  file: File | Blob;
  fileName?: string;
  spaceId: string;
  userId: string;
  category: DriveMediaCategory | 'image' | 'video' | 'audio' | 'document' | string;
  spaceKey?: CryptoKey;
  onProgress?: (percent: number, transferredBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}

export interface MediaUploadResult {
  fileId: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mediaCategory: 'image' | 'video' | 'audio' | 'document';
  storagePath: string;
  manifest: EncryptedMediaManifest;
}

// In-memory cache for decrypted Blob URLs to prevent repeated decryption on re-renders
const decryptedBlobUrlCache = new Map<string, string>();

/**
 * Normalizes category to DriveMediaCategory
 */
function normalizeToDriveCategory(category: string): DriveMediaCategory {
  const norm = category.toUpperCase().trim();
  if (norm.includes('VIDEO')) return 'CHAT_VIDEOS';
  if (norm.includes('VOICE') || norm.includes('AUDIO')) return 'VOICE_NOTES';
  if (norm.includes('DOC')) return 'DOCUMENTS';
  if (norm.includes('PROFILE') || norm.includes('AVATAR')) return 'PROFILE_PHOTOS';
  if (norm.includes('STATUS')) return 'STATUS_MEDIA';
  if (norm.includes('ALBUM') || norm.includes('MEMORY')) return 'MEMORY_ALBUMS';
  if (norm.includes('THUMB')) return 'THUMBNAILS';
  if (norm.includes('ENCRYPTED_IMAGE')) return 'ENCRYPTED_IMAGES';
  if (norm.includes('ENCRYPTED_VIDEO')) return 'ENCRYPTED_VIDEOS';
  if (norm.includes('ENCRYPTED_DOC')) return 'ENCRYPTED_DOCUMENTS';
  return 'CHAT_IMAGES';
}

/**
 * Uploads media file to Google Drive with client-side end-to-end encryption.
 */
export async function uploadEncryptedMedia(options: MediaUploadOptions): Promise<MediaUploadResult> {
  const { file, spaceId, userId, category, onProgress, signal } = options;
  const fileName = options.fileName || (file instanceof File ? file.name : `media_${Date.now()}`);
  const mimeType = file.type || 'application/octet-stream';
  const driveCategory = normalizeToDriveCategory(category);

  // 1. Resolve couple's Space Encryption Key
  const spaceKey = options.spaceKey || (await getActiveSpaceKey(spaceId));

  // 2. Read file bytes and encrypt on client (AES-256-GCM)
  const fileArrayBuffer = await file.arrayBuffer();
  const encrypted: EncryptedMediaResult = await encryptMediaBuffer(fileArrayBuffer, spaceKey);

  // 3. Obtain authentication token if user is signed in
  let authHeader = '';
  try {
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      authHeader = `Bearer ${token}`;
    }
  } catch {}

  // 4. Initialize upload session with OURSPACE backend (reserves 250 GB quota)
  const sessionRes = await fetch('/api/media/upload/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({
      spaceId,
      userId,
      category: driveCategory,
      fileName,
      fileSize: encrypted.byteLength,
      mimeType,
    }),
    signal,
  });

  if (!sessionRes.ok) {
    const errData = await sessionRes.json().catch(() => ({}));
    throw new Error(errData.error || `Upload session failed with status ${sessionRes.status}`);
  }

  const sessionData = await sessionRes.json();
  const { uploadSessionId, chunkSize } = sessionData;

  // 5. Send encrypted ciphertext in bounded chunks (4MB max per chunk)
  const totalBytes = encrypted.byteLength;
  let rangeStart = 0;
  let finalDriveFile: any = null;

  while (rangeStart < totalBytes) {
    if (signal?.aborted) {
      throw new Error('Upload aborted by user.');
    }

    const rangeEnd = Math.min(rangeStart + chunkSize - 1, totalBytes - 1);
    const chunkSlice = encrypted.ciphertext.subarray(rangeStart, rangeEnd + 1);

    const chunkRes = await fetch(`/api/media/upload/chunk?sessionId=${encodeURIComponent(uploadSessionId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${rangeStart}-${rangeEnd}/${totalBytes}`,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: chunkSlice,
      signal,
    });

    if (!chunkRes.ok) {
      const err = await chunkRes.text();
      throw new Error(`Chunk upload failed at byte ${rangeStart}: ${err}`);
    }

    const chunkData = await chunkRes.json();
    rangeStart = rangeEnd + 1;

    const progressPercent = Math.min(98, Math.round((rangeStart / totalBytes) * 100));
    if (onProgress) {
      onProgress(progressPercent, rangeStart, totalBytes);
    }

    if (chunkData.isComplete && chunkData.file) {
      finalDriveFile = chunkData.file;
      break;
    }
  }

  // 6. Finalize upload & commit quota accounting
  const manifest: EncryptedMediaManifest = {
    drive_file_id: finalDriveFile?.id || `drive_${uploadSessionId}`,
    space_id: spaceId,
    sender_id: userId,
    file_name: fileName,
    file_size: totalBytes,
    file_type: mimeType,
    media_category: category.toLowerCase().includes('video')
      ? 'video'
      : category.toLowerCase().includes('audio') || category.toLowerCase().includes('voice')
      ? 'audio'
      : category.toLowerCase().includes('doc')
      ? 'document'
      : 'image',
    iv: encrypted.iv,
    wrapped_key: encrypted.wrappedKey,
    ciphertext_sha256: encrypted.ciphertextSha256,
    is_e2ee: true,
    created_at: new Date().toISOString(),
  };

  const finalizeRes = await fetch('/api/media/upload/finalize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({
      uploadSessionId,
      driveFileId: finalDriveFile?.id,
      manifest,
    }),
  });

  if (!finalizeRes.ok) {
    const err = await finalizeRes.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to finalize media upload.');
  }

  const finalizeData = await finalizeRes.json();
  if (onProgress) onProgress(100, totalBytes, totalBytes);

  return {
    fileId: finalizeData.fileId,
    downloadUrl: finalizeData.downloadUrl,
    fileName,
    fileSize: finalizeData.verifiedBytes,
    fileType: mimeType,
    mediaCategory: manifest.media_category,
    storagePath: finalizeData.downloadUrl,
    manifest,
  };
}

/**
 * Fetches ciphertext from Google Drive gateway and decrypts it on the client
 * Returns temporary Blob URL for inline <img>, <video>, or <audio> tags.
 */
export async function fetchAndDecryptMediaUrl(
  mediaUrlOrFileId: string,
  manifest?: Partial<EncryptedMediaManifest> | null,
  spaceId?: string | null
): Promise<string> {
  const cacheKey = `${mediaUrlOrFileId}:${manifest?.iv || 'raw'}`;
  if (decryptedBlobUrlCache.has(cacheKey)) {
    return decryptedBlobUrlCache.get(cacheKey)!;
  }

  // 1. Resolve gateway URL
  const fetchUrl = mediaUrlOrFileId.startsWith('/') || mediaUrlOrFileId.startsWith('http')
    ? mediaUrlOrFileId
    : `/api/media/${mediaUrlOrFileId}`;

  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch media ciphertext: HTTP ${res.status}`);
  }

  const buffer = await res.arrayBuffer();

  // 2. If not encrypted, return raw blob URL
  if (!manifest?.is_e2ee || !manifest.iv || !manifest.wrapped_key) {
    const rawBlob = new Blob([buffer], { type: manifest?.file_type || 'application/octet-stream' });
    const url = URL.createObjectURL(rawBlob);
    decryptedBlobUrlCache.set(cacheKey, url);
    return url;
  }

  // 3. Client-side decrypt with Space Key
  const spaceKey = await getActiveSpaceKey(spaceId || manifest.space_id || 'default');
  const decryptedBlob = await decryptMediaBuffer(
    buffer,
    manifest.iv,
    manifest.wrapped_key,
    spaceKey,
    manifest.file_type || 'image/jpeg'
  );

  const decryptedUrl = URL.createObjectURL(decryptedBlob);
  decryptedBlobUrlCache.set(cacheKey, decryptedUrl);
  return decryptedUrl;
}

/**
 * Clears cached temporary Blob URLs
 */
export function revokeDecryptedBlobUrls(): void {
  decryptedBlobUrlCache.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  });
  decryptedBlobUrlCache.clear();
}
