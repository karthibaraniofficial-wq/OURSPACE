# OURSPACE V2.4.4 — Two-Way LiveKit Audio Calling Repair Report

## Executive Summary
Prior to V2.4.4, users in OURSPACE reported that neither the caller nor the receiver could hear one another during audio and video calls. The call status changed to active in Firestore, giving the false illusion of connectivity, but real WebRTC audio transport was broken.

This report details the architectural audit, root causes, and complete repair of the two-way audio media pipeline.

---

## Root Causes of Two-Way Audio Failure

### 1. Competing Local Media Capture
In `apps/web/src/components/calls/ActiveCallModal.tsx`, the component executed:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
```
and held that stream in `localStreamRef.current`.
Immediately afterwards, it connected to LiveKit and executed:
```typescript
await room.localParticipant.setMicrophoneEnabled(!isMuted);
```
On Windows (DirectShow/CoreAudio) and mobile platforms (Android/iOS), attempting to lock the microphone hardware twice simultaneously by two separate controllers causes audio device contention, silent microphone capture failures, or zero-byte audio packet emissions.

### 2. Browser Autoplay Restrictions
Browsers (Chrome, Edge, Safari) strictly enforce autoplay policies. Remote audio tracks attached to HTML `<audio>` elements can fail to play if the audio context is created without an explicit user gesture during track reception. The previous implementation logged a warning but provided no mechanism to resume audio, leaving the participant in silent disconnect.

### 3. Cosmetic Mute Toggling
In earlier code, pressing Mute toggled the local audio track's enabled flag on `localStreamRef` but never reliably updated LiveKit's `LocalParticipant.setMicrophoneEnabled(false)`. As a result, LiveKit never propagated `TrackMuted` / `TrackUnmuted` signaling events to the remote SFU peer.

---

## Architectural Fixes Implemented

### 1. LiveKit as the Single Source of Truth
- Removed all redundant `navigator.mediaDevices.getUserMedia()` calls in `ActiveCallModal.tsx`.
- LiveKit Room manages local audio hardware capture, acoustic echo cancellation (AEC), automatic gain control (AGC), and noise suppression (ANS):
  ```typescript
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  ```

### 2. Local Microphone Publication & Verification
- When joining the call, `room.localParticipant.setMicrophoneEnabled(!isMuted)` initiates the microphone track publication.
- Toggling Mute directly executes `room.localParticipant.setMicrophoneEnabled(!nextMuted)`.
- LiveKit broadcasts `TrackMuted` / `TrackUnmuted` events across the SFU so the partner's UI displays real-time mute indicators.

### 3. Remote Audio Track Subscription & Playback
- `RoomEvent.TrackSubscribed` intercepts `track.kind === Track.Kind.Audio`.
- The track is attached to a dedicated `<audio>` element and pushed into `audioElementsRef.current`.
- If browser autoplay blocks the playback, `autoplayBlocked` state is set, displaying:
  **"TAP TO ENABLE CALL AUDIO"**.
- User gesture calls `room.startAudio()` and resumes audio elements seamlessly.
- `RoomEvent.AudioPlaybackStatusChanged` monitors playback readiness automatically.

### 4. Comprehensive Hardware Release
When a call ends or is declined:
- Local participant microphone track is stopped: `pub.track.stop()`.
- Remote audio tracks are detached and paused.
- Audio DOM elements are removed.
- Room is disconnected.
- Microphone hardware LED turns off immediately.

---

## Test Results
- Unit test suite: `tests/v2_4_4_calling.test.mjs`
  - `Two-way Audio Track publication, mute/unmute and release`: **PASSED**
  - Autoplay block interception and user gesture resumption: **VERIFIED**
  - LiveKit `LocalParticipant.setMicrophoneEnabled`: **VERIFIED**
