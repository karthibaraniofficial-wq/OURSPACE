/**
 * OURSPACE Firebase Cloud Storage Engine (V2.4.2)
 *
 * Provides:
 *  - Standardized media category folder mapping:
 *      image    -> spaces/{spaceId}/images/{userId}/{fileId}
 *      video    -> spaces/{spaceId}/videos/{userId}/{fileId}
 *      document -> spaces/{spaceId}/documents/{userId}/{fileId}
 *      audio    -> spaces/{spaceId}/audio/{userId}/{fileId}
 *  - Resumable binary byte streaming with real-time percentage progress.
 *  - In-memory download URL resolver with caching to eliminate raw storage path rendering.
 *  - Structured diagnostics for upload lifecycle events.
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { getFirebaseStorageInstance } from './firebase';
import { logMediaEvent } from '@/lib/diagnostics/mediaDiagnostics';

export type MediaCategory = 'image' | 'video' | 'document' | 'audio';

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mediaCategory: MediaCategory;
  width?: number | null;
  height?: number | null;
}

/**
 * Normalizes media category to its canonical plural Storage folder name
 * Ensures 100% backward compatibility for 'image' vs 'images'
 */
export function getCategoryFolder(category: string): string {
  switch (category.toLowerCase()) {
    case 'image':
    case 'images':
    case 'photo':
    case 'photos':
      return 'images';
    case 'video':
    case 'videos':
      return 'videos';
    case 'audio':
    case 'voice':
    case 'sound':
      return 'audio';
    case 'document':
    case 'documents':
    case 'file':
    case 'files':
    default:
      return 'documents';
  }
}

/**
 * Normalizes input category to the standard MediaCategory enum
 */
export function normalizeMediaCategory(category: string): MediaCategory {
  const folder = getCategoryFolder(category);
  if (folder === 'images') return 'image';
  if (folder === 'videos') return 'video';
  if (folder === 'audio') return 'audio';
  return 'document';
}

// In-memory cache of resolved download URLs to eliminate redundant Firebase network calls
const resolvedDownloadUrlCache = new Map<string, string>();

/**
 * Resolves a reliable, browser-playable HTTPS media URL from an attachment reference.
 * If the input is already an HTTP, Data, or Blob URL, it returns immediately.
 * If the input is a Firebase Storage path (e.g. `spaces/...`), it resolves the authorized
 * download URL using the Firebase Storage SDK.
 */
export async function resolveMediaDownloadUrl(
  filePathOrUrl?: string | null,
  fallbackUrl?: string | null
): Promise<string | null> {
  const candidate = fallbackUrl || filePathOrUrl;
  if (!candidate) return null;

  // Direct web-accessible URLs pass through directly
  if (
    candidate.startsWith('http://') ||
    candidate.startsWith('https://') ||
    candidate.startsWith('data:') ||
    candidate.startsWith('blob:')
  ) {
    return candidate;
  }

  // Raw path candidate
  const rawPath = filePathOrUrl || fallbackUrl;
  if (!rawPath) return null;

  // Check in-memory resolution cache
  if (resolvedDownloadUrlCache.has(rawPath)) {
    return resolvedDownloadUrlCache.get(rawPath)!;
  }

  try {
    const storage = getFirebaseStorageInstance();
    const fileRef = ref(storage, rawPath);
    const downloadUrl = await getDownloadURL(fileRef);
    resolvedDownloadUrlCache.set(rawPath, downloadUrl);
    logMediaEvent({
      stage: 'DOWNLOAD_REFERENCE_RESOLVED',
      fileId: rawPath,
    });
    return downloadUrl;
  } catch (err: unknown) {
    logMediaEvent({
      stage: 'IMAGE_LOAD_FAILED',
      fileId: rawPath,
      error: err instanceof Error ? err.message : 'Storage resolution failed',
    });
    return null;
  }
}

/**
 * Clears a specific cached URL or the entire cache (e.g. on manual retry)
 */
export function clearMediaUrlCache(key?: string): void {
  if (key) {
    resolvedDownloadUrlCache.delete(key);
  } else {
    resolvedDownloadUrlCache.clear();
  }
}

/**
 * Reusable, robust media uploader with resumable byte streaming and progress
 */
export async function uploadMediaToFirebaseStorage(
  spaceId: string,
  category: MediaCategory | string,
  file: File,
  onProgress?: (percent: number) => void,
  senderId?: string
): Promise<UploadResult> {
  const startTime = Date.now();
  const canonicalCategory = normalizeMediaCategory(category);
  const folder = getCategoryFolder(category);

  logMediaEvent({
    stage: 'PHOTO_SELECTED',
    spaceId,
    senderId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    category: canonicalCategory,
  });

  // 1. Validate file size (50MB ceiling)
  if (file.size > 50 * 1024 * 1024) {
    const errorMsg = 'File size exceeds the 50MB platform limit.';
    logMediaEvent({
      stage: 'PHOTO_VALIDATED',
      fileName: file.name,
      fileSize: file.size,
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  // 2. Validate MIME type
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  const isAllowedDoc =
    file.type === 'application/pdf' ||
    file.type === 'application/msword' ||
    file.type.includes('officedocument') ||
    file.type === 'text/plain' ||
    file.type === 'application/zip';

  if (!isImage && !isVideo && !isAudio && !isAllowedDoc) {
    const errorMsg = `Unsupported media file type: ${file.type || 'unknown'}`;
    logMediaEvent({
      stage: 'PHOTO_VALIDATED',
      fileName: file.name,
      mimeType: file.type,
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  logMediaEvent({
    stage: 'PHOTO_VALIDATED',
    spaceId,
    fileName: file.name,
    fileSize: file.size,
    category: canonicalCategory,
  });

  const storage = getFirebaseStorageInstance();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const userSegment = senderId ? `${senderId}/` : '';
  const uniqueFileId = `${Date.now()}_${safeName}`;
  const storagePath = `spaces/${spaceId}/${folder}/${userSegment}${uniqueFileId}`;
  const fileRef = ref(storage, storagePath);

  logMediaEvent({
    stage: 'UPLOAD_STARTED',
    spaceId,
    senderId,
    fileId: storagePath,
    fileName: file.name,
  });

  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(progress);
        logMediaEvent({
          stage: 'UPLOAD_PROGRESS',
          fileId: storagePath,
          progress,
        });
      },
      (error) => {
        logMediaEvent({
          stage: 'UPLOAD_COMPLETED',
          fileId: storagePath,
          error: error.message,
        });
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolvedDownloadUrlCache.set(storagePath, downloadUrl);

          const durationMs = Date.now() - startTime;
          logMediaEvent({
            stage: 'UPLOAD_COMPLETED',
            fileId: storagePath,
            fileName: file.name,
            fileSize: file.size,
            durationMs,
          });

          resolve({
            downloadUrl,
            storagePath,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            mediaCategory: canonicalCategory,
          });
        } catch (downloadErr: unknown) {
          const err = downloadErr instanceof Error ? downloadErr : new Error('Failed to resolve download URL');
          logMediaEvent({
            stage: 'DOWNLOAD_REFERENCE_RESOLVED',
            fileId: storagePath,
            error: err.message,
          });
          reject(err);
        }
      }
    );
  });
}

/**
 * Permanently deletes media file from Firebase Storage
 */
export async function deleteMediaFromFirebaseStorage(storagePath: string): Promise<void> {
  const storage = getFirebaseStorageInstance();
  const fileRef = ref(storage, storagePath);
  await deleteObject(fileRef);
  resolvedDownloadUrlCache.delete(storagePath);
}
