/**
 * OURSPACE Media Diagnostics & Structured Telemetry
 * Tracks image selection, upload lifecycle, Firestore serialization, and rendering stages.
 * Zero-leakage policy: Never logs sensitive user content, credentials, or base64 streams.
 */

export type MediaStage =
  | 'PHOTO_SELECTED'
  | 'PHOTO_VALIDATED'
  | 'UPLOAD_STARTED'
  | 'UPLOAD_PROGRESS'
  | 'UPLOAD_COMPLETED'
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
}

export function logMediaEvent(event: MediaLogEvent): void {
  const timestamp = new Date().toISOString();
  const safePayload = {
    time: timestamp,
    stage: event.stage,
    space: event.spaceId ? `${event.spaceId.substring(0, 8)}...` : undefined,
    sender: event.senderId ? `${event.senderId.substring(0, 8)}...` : undefined,
    name: event.fileName,
    size: event.fileSize,
    mime: event.mimeType,
    category: event.category,
    progress: event.progress !== undefined ? `${event.progress}%` : undefined,
    duration: event.durationMs !== undefined ? `${event.durationMs}ms` : undefined,
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
