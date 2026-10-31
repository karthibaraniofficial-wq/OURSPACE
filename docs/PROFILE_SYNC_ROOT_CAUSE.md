# OURSPACE V2.4.5 — Profile, DP, Status and Real-Time Synchronization Root Cause Analysis

## Executive Summary
Prior to OURSPACE V2.4.5, when User A updated their profile (display picture, custom status, or display name), User B (their paired partner) could not reliably see those changes. Often, User B would see an outdated profile, a blank avatar, or stale cached data. In calling scenarios, User B would even see their own profile displayed as their partner's. 

A thorough architectural audit of the repository revealed five distinct root causes spanning the database listener topology, the file upload pipeline, participant identity resolution, presence tracking, and security authorization boundaries.

---

## 1. Root Cause 1: Broken Listener Topology in `useAuthStore`
### The Flaw
In `apps/web/src/store/useAuthStore.ts`, the profile synchronization mechanism was exclusively listening to:
```typescript
// Legacy implementation:
const membersRef = collection(db, 'privateSpaces', spaceId, 'members');
onSnapshot(membersRef, (snapshot) => { ... });
```
### Why It Failed
1. The `privateSpaces/{spaceId}/members` subcollection is written **only during initial space creation and invite-code pairing**.
2. When User A navigated to `/dashboard/settings` and updated their profile, the app wrote to `users/{user.id}`.
3. The `privateSpaces/{spaceId}/members` subcollection was **never mutated** on profile edits.
4. User B's client had **no active Firestore `onSnapshot` listener attached to `users/{partnerUid}`**.
5. Consequently, User B's local state only received User A's profile data on initial page load (via a one-shot `getDoc`), and was completely blind to any subsequent real-time profile updates until a hard page reload occurred.

---

## 2. Root Cause 2: Display Picture Upload Pipeline Bypassed Firebase Storage
### The Flaw
In `apps/web/src/app/dashboard/settings/page.tsx`, the avatar upload handler contained the following code:
```typescript
// Legacy implementation:
const reader = new FileReader();
reader.onload = async (e) => {
  const base64Url = e.target?.result as string;
  setAvatarUrl(base64Url);
  await updateProfile({ avatar_url: base64Url });
};
reader.readAsDataURL(file);
```
### Why It Failed
1. **Document Bloat & Rejection**: High-resolution mobile or desktop camera images easily exceed 1MB to 5MB. Cloud Firestore enforces a strict 1MB document size limit (`ResourceExhausted: Document exceeds maximum allowed size of 1,048,576 bytes`). Firestore updates failed silently or threw uncaught exceptions.
2. **Missing Storage Upload**: The file was never uploaded to Firebase Cloud Storage. No persistent HTTPS `downloadURL` was generated.
3. **Bandwidth & Cache Invalidation**: Storing Base64 payloads directly in user documents caused massive read payloads on every document fetch and defeated browser HTTP image caching.

---

## 3. Root Cause 3: Inverted Participant Identity in `ActiveCallModal`
### The Flaw
In `apps/web/src/components/calls/ActiveCallModal.tsx`:
```typescript
// Legacy implementation:
const partner = activeCall?.receiver;
```
### Why It Failed
1. In a call session, `activeCall.caller` is the initiating user and `activeCall.receiver` is the receiving user.
2. When User B received and answered an incoming call:
   - User B is the receiver (`activeCall.receiver`).
   - The UI resolved `partner = activeCall.receiver`, which evaluated to User B themselves!
3. User B saw their own display picture and display name labeled as "Calling Partner", while User A saw User B correctly. This created severe confusion and apparent profile desynchronization during active calls.

---

## 4. Root Cause 4: Conflation of Custom Status and Online Presence
### The Flaw
Across `Sidebar.tsx`, `chat/page.tsx`, and `dashboard/page.tsx`:
- Online presence was conflated with custom status text.
- Some components displayed a permanent green dot (`bg-emerald-500`) assuming any user with a profile document was perpetually "Online".
- Other components attempted to read `partner.status_message` and display it as an online indicator.
- There was no heartbeat mechanism, no connection tracking, and no detection of browser tab closure (`pagehide` / `visibilitychange`).
- When a user went offline, their partner's UI continued to indicate that they were actively online.

---

## 5. Root Cause 5: Overly Permissive Security Boundary
### The Flaw
In `firestore.rules`:
```javascript
// Legacy implementation:
match /users/{uid} {
  allow read: if isAuthenticated();
  allow write: if isOwner(uid);
}
```
### Why It Was Problematic
1. While `allow write: if isOwner(uid)` prevented unauthorized writes, `allow read: if isAuthenticated()` allowed any authenticated Firebase user to read any other user's profile document.
2. In a two-person private sanctuary application, only the user themselves and their verified paired partner belonging to the same private space should have read authority over private profile details (such as custom status, status emoji, and activity timestamps).

---

## Summary of Root Cause Matrix

| Issue | Root Cause | Impact |
|---|---|---|
| **Partner Profile Desync** | No `onSnapshot` on `users/{partnerUid}` | Changes in display name, avatar, or status never reached partner |
| **DP Upload Failure** | FileReader converted files to Base64 in Firestore doc | Exceeded Firestore 1MB document limit; no Cloud Storage URL |
| **Call Header Avatar Inversion** | Hardcoded `partner = activeCall.receiver` | Receiver saw their own avatar and name in active calls |
| **Fake Online Presence** | Hardcoded UI green dots & missing heartbeat | Users appeared perpetually online even when offline |
| **Data Boundary Risk** | Blanket `allow read: if isAuthenticated()` | Profile docs readable by any authenticated user in project |
