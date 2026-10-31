/**
 * OURSPACE Media Diagnostics & Structured Telemetry
 * Tracks image selection, upload lifecycle, Firestore serialization, and rendering stages.
 * Zero-leakage policy: Never logs sensitive user content, credentials, or base64 streams.
 */

export type MediaStage =
  | 'PHOTO_SELECTED'
  | 'PHOTO_VALIDATED'
  | 'PREFLIGHT_CHECK_STARTED'
  | 'PREFLIGHT_CHECK_FAILED'
  | 'PREFLIGHT_CHECK_SUCCESS'
  | 'UPLOAD_STARTED'
  | 'UPLOAD_RUNNING'
  | 'UPLOAD_PROGRESS'
  | 'UPLOAD_PAUSED'
  | 'UPLOAD_COMPLETED'
  | 'UPLOAD_FAILED'
  | 'DOWNLOAD_REFERENCE_RESOLVED'
  | 'MESSAGE_WRITE_STARTED'
  | 'MESSAGE_WRITE_COMPLETED'
  | 'REALTIME_MESSAGE_RECEIVED'
  | 'IMAGE_RENDERED'
  | 'IMAGE_LOAD_FAILED';

export interface MediaLogEvent {
  stage: MediaStage;
  spaceId?: string;
  senderId?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  category?: string;
  progress?: number;
  durationMs?: number;
  error?: string;
  storageBucket?: string;
  errorCode?: string;
  httpStatus?: number;
  bytesTransferred?: number;
  totalBytes?: number;
  taskState?: string;
}

export function logMediaEvent(event: MediaLogEvent): void {
  const timestamp = new Date().toISOString();
  const safePayload = {
    time: timestamp,
    stage: event.stage,
    space: event.spaceId ? `${event.spaceId.substring(0, 8)}...` : undefined,
    sender: event.senderId ? `${event.senderId.substring(0, 8)}...` : undefined,
    bucket: event.storageBucket,
    path: event.fileId,
    name: event.fileName,
    size: event.fileSize,
    mime: event.mimeType,
    category: event.category,
    progress: event.progress !== undefined ? `${event.progress}%` : undefined,
    bytes: event.bytesTransferred !== undefined ? `${event.bytesTransferred}/${event.totalBytes}` : undefined,
    state: event.taskState,
    duration: event.durationMs !== undefined ? `${event.durationMs}ms` : undefined,
    code: event.errorCode,
    status: event.httpStatus,
    error: event.error,
  };

  if (process.env.NODE_ENV !== 'production' || event.error) {
    if (event.error) {
      console.error(`[MEDIA_DIAGNOSTICS][${event.stage}]`, safePayload);
    } else {
      console.log(`[MEDIA_DIAGNOSTICS][${event.stage}]`, safePayload);
    }
  }
}

// Backward-compatible alias for existing imports
export const logMediaDiagnostic = logMediaEvent;
