# OURSPACE — Global Network Troubleshooting & Diagnostic Playbook

This playbook provides actionable diagnostic workflows, terminal commands, and resolution procedures for resolving connectivity issues across public internet networks, mobile cellular providers, and restrictive firewalls.

---

## 1. Quick Diagnostic Flowchart

```text
[Issue Detected]
       │
       ├── Can user authenticate and load messages?
       │     ├── NO  ──> Check DNS / Firebase Status / Firestore Rules (Section 2)
       │     └── YES ──> Continue
       │
       ├── Can user start an audio/video call?
       │     ├── NO  ──> Check LiveKit Token / WebRTC ICE / TURN Relay (Section 3)
       │     └── YES ──> Continue
       │
       ├── Are push notifications received when app is backgrounded?
       │     ├── NO  ──> Check FCM Token Registration / APNs / Battery Optimization (Section 4)
       │     └── YES ──> Continue
       │
       └── Do media uploads finish across 4G/5G?
             ├── NO  ──> Check Firebase Storage CORS / Network Timeout / Resume Queue (Section 5)
             └── YES ──> System Healthy (100% Operational)
```

---

## 2. Firebase & Database Connectivity Diagnostics

### 2.1 Symptom: "Failed to connect to Firebase backend" or "Permission Denied"
- **Cause 1: Authorized Domains Mismatch**
  - In Firebase Console -> Authentication -> Settings -> Authorized Domains:
  - Ensure your production domain (`ourspace.app` or `<project>.web.app`) is explicitly listed.
- **Cause 2: Firestore Security Rule Isolation**
  - Verify the user is authenticated and part of a space (`users/{userId}` has `spaceId` matching `spaces/{spaceId}/members`).
  - Verify Firestore rules via tests: `npm run test:audit`
- **Cause 3: DNS or CDN block**
  - Run terminal test:
    ```bash
    curl -I https://firestore.googleapis.com
    # Expected: HTTP/2 200 or 404 with Google headers (proves network path is open)
    ```

---

## 3. WebRTC & LiveKit Calling Diagnostics

### 3.1 Symptom: "Call Connecting..." indefinitely, then "Connection Failed"
This occurs when WebRTC cannot establish a direct P2P connection or traverse NAT.

#### Root Causes:
1. **Symmetric CGNAT (Mobile 4G/5G)**:
   - Cellular carriers (Jio, Airtel, Vodafone, T-Mobile, AT&T) place mobile handsets behind symmetric Carrier-Grade NAT.
   - P2P hole punching fails.
   - **Resolution**: LiveKit SFU automatically routes media through TURN relay. Ensure your LiveKit instance has TURN enabled on port `3478` (UDP/TCP) and `5349` (TLS).
2. **Restrictive Corporate / Campus / Hotel Wi-Fi**:
   - Firewalls frequently block outbound UDP traffic entirely.
   - **Resolution**: Enable **TURN-over-TLS on port 443**. This encapsulates WebRTC media inside standard HTTPS/TLS traffic, passing through 99.9% of enterprise firewalls.

#### Verification Commands:
```bash
# 1. Test LiveKit WebSocket signaling endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://ourspace.livekit.cloud

# 2. Test STUN server reachability
nc -z -v -u stun.l.google.com 19302

# 3. Test LiveKit TURN TLS port (Port 443 or 5349)
openssl s_client -connect ourspace.livekit.cloud:443 -servername ourspace.livekit.cloud
```

---

## 4. Push Notification Delivery Diagnostics

### 4.1 Symptom: Remote partner does not receive message alerts when phone is locked
1. **FCM Token Registration**:
   - Verify token is saved in Firestore at: `users/{partnerUserId}/fcmToken`.
   - If token is missing, check browser notification permissions or Android Notification permission prompt (`POST_NOTIFICATIONS`).
2. **Android Battery Optimization**:
   - Chinese OEM skins (MIUI, ColorOS, OxygenOS) aggressively terminate background processes.
   - User action: In Phone Settings -> Apps -> OURSPACE -> Battery -> Set to "Unrestricted / No restrictions".
3. **iOS APNs Certificate**:
   - Verify APNs authentication key (`.p8`) in Firebase Console under Cloud Messaging has not expired or been revoked.
   - Check APNs sandbox vs production environment mismatch.

---

## 5. Media Upload & Download Diagnostics

### 5.1 Symptom: Photo upload pauses or hangs on weak 4G/5G connection
1. **Resumable Uploads**:
   - OURSPACE uses Firebase Storage `uploadBytesResumable()`.
   - On network drop, the client pauses the task and automatically resumes once `useNetworkStore` signals `connected`.
2. **CORS Configuration**:
   If uploading from web browser yields a CORS error:
   ```json
   [
     {
       "origin": ["https://ourspace.app", "https://*.vercel.app"],
       "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "x-goog-resumable"]
     }
   ]
   ```
   Deploy with:
   ```bash
   gcloud storage buckets update gs://<project-id>.firebasestorage.app --cors-file=cors.json
   ```

---

## 6. Matrix of Common Error Codes & Actions

| Error Code | Meaning | Immediate Corrective Action |
|---|---|---|
| `UNAUTHENTICATED` | Firebase Auth token expired or missing | Re-authenticate via `signInWithEmailAndPassword` or refresh token. |
| `ICE_DISCONNECTED` | Temporary packet loss during Wi-Fi to 5G handover | LiveKit client initiates ICE restart automatically. Keep call screen open. |
| `ICE_FAILED` | Firewall blocked all STUN/TURN routes | Switch network or verify LiveKit Cloud TURN-over-TLS port 443 is active. |
| `OFFLINE_QUEUED` | Device currently has no internet access | Message is safely buffered in `useNetworkStore` queue and will auto-send. |
| `PERMISSION_DENIED` | Attempted access to another couple's space | Verified security rule block; access strictly limited to verified space members. |
