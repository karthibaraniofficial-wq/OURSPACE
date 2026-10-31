# OURSPACE V2.4.2 — Image Sharing Repair Report

## Overview
This engineering repair report details all modifications made to restore reliable photo sharing across Android, iOS, Windows, and Mac browsers on different internet providers and physical locations.

---

## Modified Architecture & Data Flow

```text
User Selects / Captures Photo (Gallery or In-App Camera)
                     │
                     ▼
  Staged in Client Memory (`stagedMediaList: StagedMedia[]`)
  - Local Blob/Object URL for instant feedback
  - Size check (< 50MB) & MIME type validation (image/jpeg, png, webp, gif)
                     │
                     ▼
  Resumable Upload to Firebase Storage
  - Canonical Category: 'image'
  - Storage Path: spaces/{spaceId}/images/{userId}/{timestamp}_{fileId}
  - uploadBytesResumable with real-time progress callbacks (0% -> 100%)
  - Retrieves authentic Download URL via getDownloadURL()
                     │
                     ▼
  Idempotent Firestore Message Creation
  - Stable Message ID: msg-{random}-{timestamp}
  - setDoc(doc(privateSpaces/{spaceId}/conversations/main/messages/{messageId}), payload, { merge: true })
  - Stores METADATA ONLY:
    • id, file_name, file_size, file_type, media_category ('image')
    • storage_path, file_path
    • download_url, signed_url
    • thumbnail_path, thumbnail_url
    • width, height, created_at
  - ZERO Base64 data strings stored in Firestore
                     │
                     ▼
  Realtime Synchronization via onSnapshot
  - Both User A and User B receive identical message document
                     │
                     ▼
  Image Message Rendering (`MessageBubble.tsx`)
  - Asynchronously resolves Storage path via `resolveMediaDownloadUrl()`
  - Never passes relative storage path directly to <img src>
  - Renders genuine photograph with natural aspect ratio & rounded corners
  - Loading skeleton & retry action with cache clearing (`clearMediaUrlCache()`)
  - Lightbox modal with Fullscreen view and direct Download button
```

---

## Detailed File Modifications

### 1. `packages/types/src/index.ts`
- Extended `MessageAttachment` interface:
  - Added `thumbnail_url?: string | null`
  - Added `download_url?: string | null`
  - Added `storage_path?: string`
  - Retained `signed_url` and `file_path` for backwards compatibility.

### 2. `apps/web/src/lib/diagnostics/mediaDiagnostics.ts`
- Created structured logging utility for tracking all 11 lifecycle stages:
  1. `PHOTO_SELECTED`
  2. `PHOTO_VALIDATED`
  3. `UPLOAD_STARTED`
  4. `UPLOAD_PROGRESS`
  5. `UPLOAD_COMPLETED`
  6. `DOWNLOAD_REFERENCE_RESOLVED`
  7. `MESSAGE_WRITE_STARTED`
  8. `MESSAGE_WRITE_COMPLETED`
  9. `REALTIME_MESSAGE_RECEIVED`
  10. `IMAGE_RENDERED`
  11. `IMAGE_LOAD_FAILED`
- Scrubbed sensitive authentication tokens, service keys, and base64 payloads from logs.

### 3. `apps/web/src/lib/firebase/storage.ts`
- Added canonical category normalizer `getCategoryFolder()` and `normalizeMediaCategory()` supporting `image`, `video`, `audio`, `document`.
- Implemented `resolveMediaDownloadUrl(filePathOrUrl, fallbackUrl)` with in-memory caching and `getDownloadURL(ref(storage, path))`.
- Added `clearMediaUrlCache(key)` to invalidate stale or expired URLs when users tap retry.
- Rebuilt `uploadMediaToFirebaseStorage` using `uploadBytesResumable` with cumulative progress callbacks, 50MB check, MIME validation, and structured return payload (`UploadResult`).

### 4. `apps/web/src/lib/firebase/firestore.ts`
- Replaced `addDoc` with stable document reference:
  ```typescript
  const messageDocRef = doc(msgsRef, message.id);
  await setDoc(messageDocRef, payload, { merge: true });
  ```
- Ensures client-generated optimistic ID and Firestore document key are 1:1 identical, eliminating duplicate bubbles and jitter.
- Mapped both `senderId` and `sender_id` to satisfy Firestore Security Rules (`request.resource.data.senderId == request.auth.uid`).

### 5. `apps/web/src/store/useChatStore.ts`
- Upgraded `sendMessage` action:
  - Accepts both single `attachment?: Partial<MessageAttachment>` and multiple `attachments?: Partial<MessageAttachment>[]`.
  - Maps `download_url`, `signed_url`, `storage_path`, `file_path`, `thumbnail_url`, `thumbnail_path`.
  - Auto-resolves message type to `'image'` if attachments contain photographs.
  - Retains optimistic message without dropping metadata.

### 6. `apps/web/src/components/chat/MessageBubble.tsx`
- Completely overhauled `ImageAttachment` component:
  - Asynchronous download URL resolution via `resolveMediaDownloadUrl()`.
  - Zero raw `spaces/...` paths passed to `<img>`.
  - Displays loading skeleton with animated bounce icon.
  - Displays error card with filename and working "Tap to retry" button calling `clearMediaUrlCache()`.
  - Overlay with photo filename, Full-screen zoom button, and direct Download button.
  - Bound diagnostics: emits `IMAGE_RENDERED` on load and `IMAGE_LOAD_FAILED` on failure.

### 7. `apps/web/src/components/chat/MessageInput.tsx`
- Corrected category passed from `'images'` to canonical `'image'`.
- Added `multiple` attribute to both `imageInputRef` and `fileInputRef`.
- Replaced single `stagedMedia` with `stagedMediaList: StagedMedia[]`.
- Built multi-photo preview tray with thumbnail badges, file sizes, and individual remove buttons.
- Implemented cumulative progress calculation during multi-file uploads.
- Staged photos are kept in memory if upload fails, enabling immediate "Retry".

### 8. `apps/web/src/lib/firebase/mediaRecovery.ts`
- Created auditing and migration helper:
  - `auditSpaceMediaAttachments(spaceId)`: scans messages for `DATA_URL`, `BLOB_URL`, `VALID_STORAGE`, and `EXPIRED_SIGNED_URL`.
  - `migrateRecoverableAttachments(spaceId, dryRun)`: extracts base64 data URLs, converts them to binary `File` objects, uploads to Firebase Storage, and updates Firestore metadata idempotently.
