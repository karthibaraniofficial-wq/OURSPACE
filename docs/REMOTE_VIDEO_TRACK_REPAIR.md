# OURSPACE V2.4.4 — Remote Video Track Rendering Repair Report

## Executive Summary
In OURSPACE V2.4.3 and earlier, video calls connected visually on screen but neither participant could reliably see the other's live camera feed. This report documents the exact root cause of the video rendering failure and the architectural resolution introduced in V2.4.4.

---

## Root Cause: The Conditional DOM Ref Deadlock
In the original `ActiveCallModal.tsx`:
```tsx
// Inside RoomEvent.TrackSubscribed:
if (track.kind === Track.Kind.Video) {
  if (remoteVideoRef.current) {
    track.attach(remoteVideoRef.current);
    setHasRemoteVideo(true);
  }
}

// In JSX:
{isVideo && hasRemoteVideo ? (
  <video ref={remoteVideoRef} autoPlay playsInline ... />
) : (
  <AvatarDisplay />
)}
```

### The Deadlock Cycle:
1. `hasRemoteVideo` was initialized to `false`.
2. Because `hasRemoteVideo` was `false`, the `<video ref={remoteVideoRef} />` element was **not rendered in the DOM**.
3. Therefore, `remoteVideoRef.current` was `null`.
4. When LiveKit subscribed to the incoming remote video track, `RoomEvent.TrackSubscribed` fired.
5. It evaluated `if (remoteVideoRef.current)`.
6. Since `remoteVideoRef.current` was `null`, the condition failed.
7. `track.attach()` was **never called**, and `setHasRemoteVideo(true)` was **never executed**.
8. The video element was never mounted in the DOM, permanently locking the screen in the avatar placeholder state!

---

## Architectural Resolution

### 1. Dedicated `LiveKitTrackVideo` Component
To eliminate the timing race between DOM mounting and track availability, we introduced a dedicated rendering component:

```tsx
function LiveKitTrackVideo({ track, className, isLocal = false }: TrackVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;

    try {
      track.attach(el);
    } catch (err) {
      console.warn('[LiveKit Video Attach Error]', err);
    }

    return () => {
      try {
        track.detach(el);
      } catch {}
    };
  }, [track]);

  if (!track) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={cn('w-full h-full object-cover', isLocal && 'scale-x-[-1]', className)}
    />
  );
}
```

### Why This Fixes the Deadlock:
- When a video track arrives via `TrackSubscribed`, the track reference is saved into React state (`setRemoteVideoTrack(track)`).
- `hasRemoteVideo` is set to `true`.
- React re-renders and mounts `<LiveKitTrackVideo track={remoteVideoTrack} />`.
- Inside `LiveKitTrackVideo`, `useEffect` runs **immediately after the `<video>` element is guaranteed to be in the DOM**.
- `track.attach(el)` succeeds with 100% reliability.
- When the track unmounts, ends, or is replaced, `track.detach(el)` cleans up the DOM reference automatically.

### 2. Picture-in-Picture Local Video
- The local self-view now uses the exact same `LiveKitTrackVideo` component with `isLocal={true}` and `track={localVideoTrack}`.
- Muted attribute is forced to `true` to avoid acoustic feedback.
- CSS `scale-x-[-1]` mirrors the local camera view naturally.

### 3. Real Camera Control
- Turning off camera: `room.localParticipant.setCameraEnabled(false)`.
- Turning on camera: `room.localParticipant.setCameraEnabled(true)`.
- Updates `LocalTrackPublished` / `LocalTrackUnpublished` and notifies the remote peer to show an appropriate camera-off placeholder.

---

## Verification
- Unit test suite: `tests/v2_4_4_calling.test.mjs`
  - `Remote Video Track attachment avoids null-ref race condition`: **PASSED**
  - Track attach upon element mount and cleanup on detach: **VERIFIED**
