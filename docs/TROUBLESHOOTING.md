# OURSPACE — Master Troubleshooting & Incident Resolution Guide

This guide provides targeted resolution steps for operational issues across authentication, space pairing, chat synchronization, audio/video calling, and cloud services.

---

## 1. Authentication Issues

### 1.1 Symptom: "auth/invalid-credential" or "auth/user-not-found"
- **Cause**: User credentials do not exist in the configured Firebase project.
- **Resolution**:
  - In development: Ensure `.env.local` points to the correct Firebase project. If using demo profiles, use the 1-click test button.
  - In production: Ensure the user has registered via `auth.createUserWithEmailAndPassword`.
  - Check Firebase Console -> Authentication -> Users to confirm the user UID exists.

### 1.2 Symptom: "auth/unauthorized-domain"
- **Cause**: The web application domain is not whitelisted in Firebase Auth.
- **Resolution**:
  - In Firebase Console -> Authentication -> Settings -> Authorized domains:
  - Add your deployment URL (`<project>.vercel.app` or `ourspace.app`).

---

## 2. Couple Pairing & Space Boundary Issues

### 2.1 Symptom: "Space membership limit reached: OURSPACE strictly permits a maximum of 2 members."
- **Cause**: A third user is attempting to join an already paired space.
- **Resolution**:
  - This is expected, intentional security behavior. OURSPACE strictly enforces a 2-person limit.
  - To join a new partner, create a fresh space or call `unpairSpace()` from the Settings menu.

### 2.2 Symptom: "Invitation has expired or code is invalid"
- **Cause**: Invitations expire after 48 hours for security.
- **Resolution**:
  - The partner who initiated pairing must generate a new invite code from the Pairing screen.
  - Verify clock synchronization on both devices.

---

## 3. WebRTC Audio & Video Calling Issues

### 3.1 Symptom: Call stuck on "Connecting..." followed by "Connection Failed"
- **Cause**: WebRTC media traffic blocked by symmetric CGNAT or firewall.
- **Resolution**:
  - Verify LiveKit Cloud WSS URL in `.env.local` / Vercel Environment Variables (`NEXT_PUBLIC_LIVEKIT_URL`).
  - Ensure TURN-over-TLS (port 443) is enabled on your LiveKit instance.
  - Check browser permissions for camera and microphone: ensure `Permissions-Policy` in `vercel.json` allows `camera=(self), microphone=(self)`.
  - Refer to [docs/LIVEKIT_NETWORKING.md](file:///e:/private%20chat%20app/docs/LIVEKIT_NETWORKING.md) for full network diagnostic commands.

### 3.2 Symptom: "UNAUTHENTICATED" when requesting call token
- **Cause**: Call to `/api/livekit/token` was made without an active Firebase Auth ID token.
- **Resolution**:
  - Check client session: verify `useAuthStore.getState().user` is not null.
  - Refresh the token via `user.getIdToken(true)` before requesting room credentials.

---

## 4. Real-Time Chat & Offline Buffering

### 4.1 Symptom: Connection pill shows "Offline (Actions Queued)"
- **Cause**: Device has lost internet connection (cellular dead zone, airplane mode).
- **Resolution**:
  - Messages sent while offline are safely queued in `useNetworkStore.getState().pendingQueue`.
  - As soon as connectivity is restored, the client automatically transitions to `Reconnecting...` and flushes all queued items in FIFO order with idempotency keys.

### 4.2 Symptom: Messages not updating in real time
- **Cause**: Firestore `onSnapshot` listener was detached or hit permission error.
- **Resolution**:
  - Check browser console for Firestore errors.
  - Verify composite indexes in [firestore.indexes.json](file:///e:/private%20chat%20app/firestore.indexes.json) have finished building in Firebase Console.

---

## 5. Media Vault Uploads

### 5.1 Symptom: "Upload paused" or "Upload failed: File exceeds 50MB"
- **Cause**: File size exceeds the hard 50MB security ceiling enforced by [storage.rules](file:///e:/private%20chat%20app/storage.rules).
- **Resolution**:
  - Compress large video files before uploading.
  - On weak 4G/5G connections, the client uses `uploadBytesResumable` and will resume chunk transmission once signal strength recovers.

---

## 6. Detailed Playbooks Reference

- For deep WebRTC NAT and port inspection: [docs/LIVEKIT_NETWORKING.md](file:///e:/private%20chat%20app/docs/LIVEKIT_NETWORKING.md)
- For cellular 4G/5G handover analysis: [docs/GLOBAL_CONNECTIVITY.md](file:///e:/private%20chat%20app/docs/GLOBAL_CONNECTIVITY.md)
- For native mobile build issues: [docs/MOBILE_PRODUCTION_SETUP.md](file:///e:/private%20chat%20app/docs/MOBILE_PRODUCTION_SETUP.md)
- For custom domain & SSL troubleshooting: [docs/CUSTOM_DOMAIN_SETUP.md](file:///e:/private%20chat%20app/docs/CUSTOM_DOMAIN_SETUP.md)
