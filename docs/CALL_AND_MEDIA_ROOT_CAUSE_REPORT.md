# OURSPACE V2.3.1 — Call & Media Root Cause Investigation Report

## Executive Summary
This report documents the architectural and implementation flaws identified during the Phase 1 audit of the OURSPACE audio/video calling infrastructure and Firebase image-sharing pipelines.

---

## 1. Root Cause Analysis: Audio Calls Connect but No Sound

### Defect Description
When User A calls User B, the call appears to connect on the UI, but neither participant can hear the other.

### Code Investigation
1. **No LiveKit WebRTC Room Connection**:
   - In `apps/web/src/store/useCallStore.ts`, the `acceptCall` method merely mutates local state (`activeCall.status = 'active'`) and starts an interval for seconds elapsed.
   - It **never instantiated** a LiveKit `Room` object (from `livekit-client`), never fetched an authorized JWT token from `/api/livekit/token`, and never invoked `room.connect(serverUrl, token)`.
2. **Missing Local Microphone Publication**:
   - `navigator.mediaDevices.getUserMedia({ audio: true })` or `room.localParticipant.setMicrophoneEnabled(true)` was never invoked during the call lifecycle.
3. **Missing Remote Audio Playback**:
   - Remote audio tracks were never attached to the DOM, and `@livekit/components-react`'s `<RoomAudioRenderer />` was absent from `ActiveCallModal.tsx`.
   - Browser autoplay restrictions were unhandled; without an explicit user gesture or audio context resume, the browser blocks unmuted audio playback.
4. **Mute Control Was Pure UI State**:
   - `toggleMute()` in `useCallStore.ts` executed `set((state) => ({ isMuted: !state.isMuted }))`, which updated a boolean in Zustand but never toggled `localParticipant.setMicrophoneEnabled(!isMuted)`.
5. **Simulation Auto-Answer Interfered with Real Signaling**:
   - Line 110 in `useCallStore.ts` scheduled an artificial `setTimeout(() => get().acceptCall(), 3800)`, auto-answering the call for the caller before the receiver ever interacted with their device.

---

## 2. Root Cause Analysis: Video Calls Connect but Show Static Mock Photos

### Defect Description
Video calls open, but neither the caller's nor the receiver's camera feed is visible. Instead, static stock photos appear.

### Code Investigation
1. **Hardcoded Unsplash Demonstration Images**:
   - In `apps/web/src/components/calls/ActiveCallModal.tsx`:
     ```tsx
     // Line 85: Remote partner video
     <img
       src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&auto=format&fit=crop&q=80"
       alt="Partner Video Feed"
       className="w-full h-full object-cover brightness-95"
     />
     // Line 125: Self picture-in-picture
     <img
       src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80"
       alt="Self view"
       className="w-full h-full object-cover"
     />
     ```
2. **Zero Camera Track Capture**:
   - Neither `room.localParticipant.setCameraEnabled(true)` nor standard `getUserMedia({ video: true })` was requested for video calls.
3. **Missing Video Element Attachment**:
   - No `<video>` element was bound to `RemoteTrack` or `LocalTrack`, nor were LiveKit's `<VideoTrack />` / `<ParticipantTile />` components utilized.
4. **Camera Toggle Was Cosmetic**:
   - `toggleVideo()` only toggled `isVideoEnabled` in Zustand, with no call to enable or disable actual video hardware tracks.

---

## 3. Root Cause Analysis: Image Sharing Delivery Failures & Document Card Fallback

### Defect Description
Selected images are not successfully shared, or they fail to render as photos and fall back to generic document attachment cards.

### Code Investigation
1. **Base64 Payload Storage in Firestore Documents**:
   - In `apps/web/src/components/chat/MessageInput.tsx` (lines 91–104):
     ```ts
     const reader = new FileReader();
     reader.onload = () => {
       const dataUrl = reader.result as string;
       setSelectedAttachment({
         file_name: file.name,
         file_size: file.size,
         file_type: file.type,
         media_category: category,
         signed_url: dataUrl,
         file_path: 'inline/' + file.name,
       });
     };
     reader.readAsDataURL(file);
     ```
   - When sent, `signed_url` was stored as a massive Base64 string directly inside the Firestore message document (`attachments` field).
   - Firestore imposes a strict **1MB (1,048,576 bytes) document size ceiling**. Photos taken on modern phones (2MB–8MB) immediately crash the Firestore write with `FirebaseError: Document exceeds maximum size limit`.
2. **Bypassed Firebase Cloud Storage**:
   - The production resumable uploader in `apps/web/src/lib/firebase/storage.ts` (`uploadMediaToFirebaseStorage`) was completely bypassed.
3. **Generic Document Card Fallback**:
   - In `apps/web/src/components/chat/MessageBubble.tsx`:
     ```tsx
     if (hasError) {
       return (
         <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/10 text-xs">
           <FileText className="w-4 h-4 text-rose-500 shrink-0" />
           <span className="truncate font-semibold">{att.file_name}</span>
         </div>
       );
     }
     ```
   - Any image error or unresolved path immediately rendered a generic document attachment card with a `FileText` icon instead of a photo preview.
4. **Lack of Dedicated Photo Uploader**:
   - No dedicated image button or photo preview tray with progress indicator, retry on failure, or full-screen lightbox modal.

---

## 4. Remediation Plan

1. **LiveKit Audio Calling (Phase 2)**:
   - Integrate actual LiveKit `Room` lifecycle into `useCallStore` / calling components.
   - Acquire short-lived token via `/api/livekit/token`.
   - Publish local audio track; subscribe to remote audio track.
   - Mount `<RoomAudioRenderer />` and handle browser autoplay gestures.
   - Bind Mute button to `localParticipant.setMicrophoneEnabled(!isMuted)`.
2. **LiveKit Video Calling (Phase 3)**:
   - Remove Unsplash images completely.
   - Publish local camera track on video calls; render via `<VideoTrack />` or `<video>` ref.
   - Subscribe to remote camera track and render in main viewport with object-fit: cover.
   - Render local preview in draggable PiP box.
   - Fall back to avatar/profile initials only when the camera is explicitly disabled.
3. **Signaling & Session State Machine (Phase 4)**:
   - Remove artificial `setTimeout` auto-answer.
   - Firestore call signaling: `ringing` -> `active` -> `ended` / `declined`.
   - Release all media tracks and disconnect LiveKit room when call ends.
4. **Firebase Storage Image Sharing (Phase 5 & 6)**:
   - In `MessageInput.tsx`, validate images (size < 50MB, types `image/*`).
   - Use `uploadMediaToFirebaseStorage` for resumable upload to `spaces/{spaceId}/images/{senderId}/{timestamp}_{name}`.
   - Display real-time progress bar (0% - 100%).
   - Store only metadata (storage path, download URL, dimensions, file size) in Firestore.
   - In `MessageBubble.tsx`, render photographs with natural aspect ratio, rounded corners, full-screen lightbox viewer, and download capability.
   - Keep documents as document cards, videos as playable video cards, and photos as photographs.
