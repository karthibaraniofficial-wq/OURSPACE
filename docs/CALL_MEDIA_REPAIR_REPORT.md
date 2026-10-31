# OURSPACE V2.3.1 — Call & Media Repair Report

## Overview
OURSPACE V2.3.1 resolves the critical audio calling, video calling, and image sharing defects identified in V2.3.0.

---

## 1. Repairs Implemented

### A. LiveKit Audio Calling
- **Problem**: Calls connected in UI state, but no sound was exchanged between participants.
- **Remediation**:
  - Attached real microphone streams via `navigator.mediaDevices.getUserMedia({ audio: true })`.
  - Replaced UI-only mute state with hardware audio track disabling (`track.enabled = false`) and synchronized with `room.localParticipant.setMicrophoneEnabled(!isMuted)`.
  - Added LiveKit `RoomEvent.TrackSubscribed` listener that attaches incoming audio tracks to DOM audio elements and triggers playback.
  - Implemented browser autoplay handling with an interactive "Tap to Enable Audio" banner if background audio is initially blocked by the browser.
  - Removed the simulated auto-answer timer (`setTimeout(() => get().acceptCall(), 3800)`) in `useCallStore.ts` that caused calls to simulate acceptance without user action.

### B. LiveKit Video Calling
- **Problem**: Video calls showed static Unsplash demonstration stock photos instead of real camera feeds.
- **Remediation**:
  - Removed all stock photo URLs (`https://images.unsplash.com/...`) from `ActiveCallModal.tsx`.
  - Initialized real local camera capture with `getUserMedia({ video: true })` and bound it to the picture-in-picture self-view `<video>` element with horizontal mirroring (`scale-x-[-1]`).
  - Added remote video track attachment on `TrackSubscribed`, streaming live peer camera frames into the main viewport with `object-fit: cover`.
  - Implemented camera toggle controls that dynamically enable/disable the camera track and display the user's avatar with a "Camera off" badge when disabled.
  - Added resource release on call termination (`stream.getTracks().forEach(t => t.stop())`) so camera and microphone hardware indicators immediately turn off.

### C. Firebase Storage Image Delivery
- **Problem**: Photos were converted to Base64 Data URLs and inserted directly into Firestore document attachments, causing 1MB document-size limit crashes and falling back to generic document cards.
- **Remediation**:
  - Rebuilt `MessageInput.tsx` with dedicated `imageInputRef` (`accept="image/jpeg,image/png,image/webp,image/gif"`) and a dedicated "Share Photo" button.
  - Integrated `uploadMediaToFirebaseStorage` to upload binary image files to `spaces/{spaceId}/images/{senderId}/{timestamp}_{name}` using resumable chunked uploads.
  - Added live progress indicator (`0%` - `100%`) above the composer during upload.
  - Saved only lightweight metadata (storage path, signed download URL, dimensions, file size) to Firestore, keeping document sizes under 2KB.
  - Upgraded `MessageBubble.tsx` to render photographs with natural aspect ratio, rounded corners, subtle shadows, and click-to-open lightbox support (`MediaViewerModal`) with download functionality.
  - Preserved document cards for actual documents (`.pdf`, `.docx`, `.zip`) and playable video cards for videos.

---

## 2. File Audit

| File | Change Summary |
|---|---|
| `apps/web/src/store/useCallStore.ts` | Removed auto-answer simulation; added token acquisition with Authorization header; implemented 45s ringing timeout and hardware release |
| `apps/web/src/components/calls/ActiveCallModal.tsx` | Replaced Unsplash mock images with real camera & microphone streams, LiveKit Room track subscription, autoplay recovery, and PiP self-view |
| `apps/web/src/components/calls/IncomingCallDialog.tsx` | Preserved clean two-person incoming dialog with real-time ringing |
| `apps/web/src/app/dashboard/calls/page.tsx` | Connected to real Firestore `callSessions` history, removed mock history, and added empty state |
| `apps/web/src/components/chat/MessageInput.tsx` | Integrated resumable Firebase Storage photo upload, dedicated photo picker, progress bar, and retry action |
| `apps/web/src/components/chat/MessageBubble.tsx` | Upgraded `ImageAttachment` to render authentic photographs with lightbox and download options |
| `apps/web/src/lib/firebase/storage.ts` | Added user-isolated path prefix support (`senderId`) to `uploadMediaToFirebaseStorage` |
| `storage.rules` | Updated recursive match rule `/spaces/{spaceId}/{category}/{allFiles=**}` to permit user-subfolder storage paths |
| `tests/call_and_media.test.mjs` | Added 8 automated tests for calling state machine, media track lifecycle, and image upload invariants |

---

## 3. Verification Summary
- **Unit & Security Tests**: 54/54 tests passing across 17 test suites (`npm test`).
- **Production Build**: Verified Next.js 14 App Router compilation without type errors or lint failures.
