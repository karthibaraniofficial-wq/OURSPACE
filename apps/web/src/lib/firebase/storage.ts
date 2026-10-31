/**
 * OURSPACE Firebase Cloud Storage Engine (V2.4.3)
 *
 * Provides:
 *  - Pre-flight Storage availability diagnostic.
 *  - Standardized media category folder mapping:
 *      image    -> spaces/{spaceId}/images/{userId}/{fileId}
 *      video    -> spaces/{spaceId}/videos/{userId}/{fileId}
 *      document -> spaces/{spaceId}/documents/{userId}/{fileId}
 *      audio    -> spaces/{spaceId}/audio/{userId}/{fileId}
 *  - Resumable binary byte streaming with real-time percentage progress.
 *  - Stalled upload detection (catches 0% stalls from unprovisioned buckets/billing).
 *  - Cancellation, pause, and resume controls.
 *  - In-memory download URL resolver with caching.
 *  - Zero-leakage diagnostic telemetry.
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { getFirebaseStorageInstance, getFirebaseConfigStatus, getFirebaseAuth } from './firebase';
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

export interface StorageDiagnosticResult {
  ready: boolean;
  reason?: string;
  code?: string;
  bucketName?: string;
}

export class StorageUploadError extends Error {
  code: string;
  userMessage: string;
  httpStatus?: number;
  retryable: boolean;

  constructor(code: string, userMessage: string, retryable = true, httpStatus?: number) {
    super(userMessage);
    this.name = 'StorageUploadError';
    this.code = code;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.httpStatus = httpStatus;
  }
}

/**
 * Normalizes media category to its canonical plural Storage folder name
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

// In-memory cache of resolved download URLs
const resolvedDownloadUrlCache = new Map<string, string>();

/**
 * Resolves browser-accessible HTTPS media URL from an attachment reference.
 */
export async function resolveMediaDownloadUrl(
  filePathOrUrl?: string | null,
  fallbackUrl?: string | null
): Promise<string | null> {
  const candidate = fallbackUrl || filePathOrUrl;
  if (!candidate) return null;

  if (
    candidate.startsWith('http://') ||
    candidate.startsWith('https://') ||
    candidate.startsWith('data:') ||
    candidate.startsWith('blob:')
  ) {
    return candidate;
  }

  const rawPath = filePathOrUrl || fallbackUrl;
  if (!rawPath) return null;

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

export function clearMediaUrlCache(key?: string): void {
  if (key) {
    resolvedDownloadUrlCache.delete(key);
  } else {
    resolvedDownloadUrlCache.clear();
  }
}

/**
 * Parses Firebase Storage error codes into actionable user-friendly messages
 */
export function parseFirebaseStorageError(err: any): StorageUploadError {
  const code = (err && (err.code || err.serverResponse?.status)) ? String(err.code || '') : 'storage/unknown';
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const httpStatus = err?.serverResponse?.status || err?.status || (rawMsg.includes('402') ? 402 : rawMsg.includes('403') ? 403 : undefined);

  // 1. Billing restrictions & Missing Bucket
  if (
    httpStatus === 402 ||
    rawMsg.toLowerCase().includes('billing') ||
    rawMsg.toLowerCase().includes('payment required') ||
    rawMsg.toLowerCase().includes('blaze')
  ) {
    return new StorageUploadError(
      'storage/billing-required',
      'Firebase Cloud Storage requires a linked billing account (Blaze plan). Check Firebase Console.',
      false,
      402
    );
  }

  if (code === 'storage/bucket-not-found' || rawMsg.toLowerCase().includes('bucket not found')) {
    return new StorageUploadError(
      'storage/bucket-not-found',
      'OURSPACE Storage bucket is not configured or does not exist. Check Firebase project.',
      false,
      404
    );
  }

  if (code === 'storage/project-not-found') {
    return new StorageUploadError(
      'storage/project-not-found',
      'Firebase project not found. Verify project ID configuration.',
      false,
      404
    );
  }

  if (code === 'storage/no-default-bucket') {
    return new StorageUploadError(
      'storage/no-default-bucket',
      'No default storage bucket configured in Firebase project.',
      false,
      500
    );
  }

  // 2. Authentication & Authorization
  if (code === 'storage/unauthenticated') {
    return new StorageUploadError(
      'storage/unauthenticated',
      'Your session has expired. Please sign in again.',
      true,
      401
    );
  }

  if (code === 'storage/unauthorized' || rawMsg.toLowerCase().includes('permission denied')) {
    return new StorageUploadError(
      'storage/unauthorized',
      'Upload rejected by Storage Security Rules. Check your private space membership.',
      false,
      403
    );
  }

  // 3. Quota & Limits
  if (code === 'storage/quota-exceeded') {
    return new StorageUploadError(
      'storage/quota-exceeded',
      'Storage quota exceeded. The image has not been sent.',
      false,
      429
    );
  }

  if (code === 'storage/retry-limit-exceeded') {
    return new StorageUploadError(
      'storage/retry-limit-exceeded',
      'Upload timed out. The server took too long to respond. Please retry.',
      true,
      408
    );
  }

  if (code === 'storage/canceled') {
    return new StorageUploadError(
      'storage/canceled',
      'Upload was cancelled.',
      false
    );
  }

  if (code === 'storage/invalid-checksum') {
    return new StorageUploadError(
      'storage/invalid-checksum',
      'File corrupted during transmission. Please retry.',
      true
    );
  }

  return new StorageUploadError(
    code,
    rawMsg || 'An unexpected storage error occurred during upload.',
    true,
    httpStatus
  );
}

/**
 * Fast pre-flight verification before beginning binary stream upload
 */
export async function checkStorageAvailability(
  spaceId?: string,
  userId?: string
): Promise<StorageDiagnosticResult> {
  logMediaEvent({
    stage: 'PREFLIGHT_CHECK_STARTED',
    spaceId,
    senderId: userId,
  });

  if (typeof window !== 'undefined' && !navigator.onLine) {
    const reason = 'Internet connection interrupted. Retry your upload.';
    logMediaEvent({
      stage: 'PREFLIGHT_CHECK_FAILED',
      error: reason,
    });
    return { ready: false, reason, code: 'NETWORK_OFFLINE' };
  }

  const configStatus = getFirebaseConfigStatus();
  if (!configStatus.isConfigured) {
    const reason = `Firebase configuration incomplete: ${configStatus.missingFields.join(', ')}`;
    logMediaEvent({
      stage: 'PREFLIGHT_CHECK_FAILED',
      error: reason,
    });
    return { ready: false, reason, code: 'CONFIG_INCOMPLETE' };
  }

  const auth = getFirebaseAuth();
  if (!auth.currentUser && !userId) {
    const reason = 'User is not authenticated with Firebase Auth.';
    logMediaEvent({
      stage: 'PREFLIGHT_CHECK_FAILED',
      error: reason,
    });
    return { ready: false, reason, code: 'UNAUTHENTICATED' };
  }

  const storage = getFirebaseStorageInstance();
  const bucketName = storage.app.options.storageBucket;
  if (!bucketName || bucketName.includes('ourspace-dev.appspot.com')) {
    if (configStatus.isProduction) {
      const reason = 'OURSPACE Storage bucket is not configured correctly in production.';
      logMediaEvent({
        stage: 'PREFLIGHT_CHECK_FAILED',
        error: reason,
        storageBucket: bucketName,
      });
      return { ready: false, reason, code: 'BUCKET_MISSING' };
    }
  }

  logMediaEvent({
    stage: 'PREFLIGHT_CHECK_SUCCESS',
    spaceId,
    senderId: userId,
    storageBucket: bucketName,
  });

  return { ready: true, bucketName };
}

export interface UploadMediaOptions {
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void;
  onTaskCreated?: (task: UploadTask) => void;
  timeoutMs?: number;
  stalledTimeoutMs?: number;
}

/**
 * Resumable media uploader with active progress callbacks, stalled upload detection,
 * safe timeout, and detailed error classification.
 */
export async function uploadMediaToFirebaseStorage(
  spaceId: string,
  category: MediaCategory | string,
  file: File,
  onProgressOrOptions?: ((percent: number) => void) | UploadMediaOptions,
  senderId?: string
): Promise<UploadResult> {
  const startTime = Date.now();
  const canonicalCategory = normalizeMediaCategory(category);
  const folder = getCategoryFolder(category);

  // Normalize options
  const options: UploadMediaOptions =
    typeof onProgressOrOptions === 'function'
      ? { onProgress: (pct) => onProgressOrOptions(pct) }
      : onProgressOrOptions || {};

  const timeoutMs = options.timeoutMs ?? 90000; // 90 second hard timeout
  const stalledTimeoutMs = options.stalledTimeoutMs ?? 15000; // 15 second 0% stall detector

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
    throw new StorageUploadError('storage/file-too-large', errorMsg, false);
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
    throw new StorageUploadError('storage/invalid-mime-type', errorMsg, false);
  }

  logMediaEvent({
    stage: 'PHOTO_VALIDATED',
    spaceId,
    fileName: file.name,
    fileSize: file.size,
    category: canonicalCategory,
  });

  // 3. Pre-flight check
  const preflight = await checkStorageAvailability(spaceId, senderId);
  if (!preflight.ready) {
    throw new StorageUploadError(
      preflight.code || 'storage/preflight-failed',
      preflight.reason || 'Storage pre-flight check failed.',
      true
    );
  }

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
    fileSize: file.size,
    mimeType: file.type,
    storageBucket: preflight.bucketName,
  });

  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: file.type,
  });

  if (options.onTaskCreated) {
    options.onTaskCreated(uploadTask);
  }

  return new Promise<UploadResult>((resolve, reject) => {
    let hasCompleted = false;
    let lastBytesTransferred = 0;
    let stalledTimer: NodeJS.Timeout | null = null;
    let totalTimeoutTimer: NodeJS.Timeout | null = null;

    const cleanupTimers = () => {
      if (stalledTimer) clearTimeout(stalledTimer);
      if (totalTimeoutTimer) clearTimeout(totalTimeoutTimer);
    };

    // Stalled detection timer: if upload is stuck at 0% for stalledTimeoutMs
    const armStalledTimer = () => {
      if (stalledTimer) clearTimeout(stalledTimer);
      stalledTimer = setTimeout(() => {
        if (!hasCompleted && lastBytesTransferred === 0) {
          hasCompleted = true;
          try {
            uploadTask.cancel();
          } catch {}
          cleanupTimers();

          const stallMsg =
            'Upload stalled at 0%. Cloud Storage is unreachable. Firebase requires a linked Blaze billing account or bucket provisioning.';
          logMediaEvent({
            stage: 'UPLOAD_FAILED',
            fileId: storagePath,
            fileName: file.name,
            error: stallMsg,
            errorCode: 'storage/stalled-at-zero',
          });
          reject(new StorageUploadError('storage/stalled-at-zero', stallMsg, true));
        }
      }, stalledTimeoutMs);
    };

    // Total upload timeout
    totalTimeoutTimer = setTimeout(() => {
      if (!hasCompleted) {
        hasCompleted = true;
        try {
          uploadTask.cancel();
        } catch {}
        cleanupTimers();

        const timeoutMsg = 'Upload timed out after ' + Math.round(timeoutMs / 1000) + ' seconds.';
        logMediaEvent({
          stage: 'UPLOAD_FAILED',
          fileId: storagePath,
          fileName: file.name,
          error: timeoutMsg,
          errorCode: 'storage/retry-limit-exceeded',
        });
        reject(new StorageUploadError('storage/retry-limit-exceeded', timeoutMsg, true));
      }
    }, timeoutMs);

    armStalledTimer();

    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        if (hasCompleted) return;

        const transferred = snapshot.bytesTransferred;
        const total = snapshot.totalBytes;
        const progress = total > 0 ? Math.round((transferred / total) * 100) : 0;

        if (transferred > lastBytesTransferred) {
          lastBytesTransferred = transferred;
          // Progress occurred: re-arm stalled detector
          armStalledTimer();
        }

        const stage =
          snapshot.state === 'running'
            ? 'UPLOAD_RUNNING'
            : snapshot.state === 'paused'
            ? 'UPLOAD_PAUSED'
            : 'UPLOAD_PROGRESS';

        logMediaEvent({
          stage,
          fileId: storagePath,
          progress,
          bytesTransferred: transferred,
          totalBytes: total,
          taskState: snapshot.state,
        });

        options.onProgress?.(progress, transferred, total);
      },
      (error) => {
        if (hasCompleted) return;
        hasCompleted = true;
        cleanupTimers();

        const parsedError = parseFirebaseStorageError(error);
        logMediaEvent({
          stage: 'UPLOAD_FAILED',
          fileId: storagePath,
          fileName: file.name,
          error: parsedError.userMessage,
          errorCode: parsedError.code,
          httpStatus: parsedError.httpStatus,
        });

        reject(parsedError);
      },
      async () => {
        if (hasCompleted) return;
        hasCompleted = true;
        cleanupTimers();

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
          reject(new StorageUploadError('storage/download-url-failed', err.message, true));
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
