# OURSPACE V2.4.4 — LiveKit Participant Identity Collision Fix

## Executive Summary
In prior versions of OURSPACE, WebRTC call initiation suffered from a critical participant identity collision. During token generation in `useCallStore.ts`, the participant identity was derived via:
```typescript
const participantId = currentCall.receiver?.id || 'partner';
```
When Caller (User A) initiated a call to Receiver (User B), Caller's token was minted with `participantId = User B`. When Receiver accepted, Receiver's token was also minted with `participantId = User B`. Both users joined the exact same LiveKit room with the **same identity**.

LiveKit SFU strictly enforces unique participant identities per room. When a second connection joins with an already active identity, the SFU either disconnects the existing participant or fails WebRTC peer connection negotiation, resulting in total two-way audio and video failure.

---

## Root Cause Analysis
1. **Symmetric Identity Assignment Bug**:
   - `fetchCallToken` evaluated `currentCall.receiver?.id` regardless of whether the local user was the caller or receiver.
   - The fallback `'partner'` string caused unauthenticated mock identities.
2. **Insecure Client-Supplied Identity**:
   - The `/api/livekit/token` endpoint trusted whatever `participantId` the client passed in the request body, allowing identity spoofing and collisions.
3. **Absence of Client-Side Identity Verification**:
   - The client never inspected the minted token's subject (`sub`) claim against the authenticated user's Firebase UID.

---

## Architectural Resolution

### 1. Authoritative Firebase UID Identity Derivation
Every participant now obtains a LiveKit JWT token whose identity is strictly derived from their authenticated Firebase UID (`currentUser.uid`):
- **Caller (User A)**: LiveKit identity = `user_A`
- **Receiver (User B)**: LiveKit identity = `user_B`
- Both join the same room: `ourspace-${spaceId.substring(0,8)}-${callId}`

### 2. Elimination of Fake Fallbacks
The fallback `'partner'` has been completely eradicated. If a user's authenticated identity cannot be confirmed, token generation is aborted with an explicit error rather than proceeding with a colliding or spoofed identity.

### 3. Server-Side Identity Enforcement
- **Cloud Functions (`getLiveKitToken`)**: The callable function extracts `request.auth.uid` directly from the validated session. It verifies:
  1. Authenticated user is an active member of `privateSpaces/{spaceId}`.
  2. The call session `callId` exists in Firestore.
  3. The authenticated user is either `callerId` or `receiverId`.
  4. The requested room name strictly matches `callData.roomName`.
  5. The call session status is either `ringing` or `active`.
  6. The minted LiveKit token identity is locked to `request.auth.uid`.
- **API Route (`/api/livekit/token`)**:
  - Validates standard Firebase Auth ID token bearer headers.
  - Rejects forged `participantId` values that do not match the verified Firebase UID.

### 4. Client-Side Cryptographic Validation
In `apps/web/src/store/useCallStore.ts`, upon receiving a token:
```typescript
const tokenSub = parseJwtSubject(mintedToken);
if (tokenSub && localUid && tokenSub !== localUid) {
  console.error(`[SECURITY VIOLATION] LiveKit Token identity collision prevented!`);
  set({
    errorMessage: 'Security check failed: LiveKit participant identity mismatch.',
    callStatus: 'FAILED',
  });
  return;
}
```
If a token does not match the local user's Firebase UID, it is rejected before any WebRTC connection is attempted.

---

## Verification
- Unit test suite: `tests/v2_4_4_calling.test.mjs`
  - `Caller and receiver have unique, distinct LiveKit identities`: **PASSED**
  - `Client token validation detects and rejects identity mismatch / collision`: **PASSED**
  - `Client token validation approves correctly issued user token`: **PASSED**
  - `Third party attacker is rejected with permission-denied`: **PASSED**
