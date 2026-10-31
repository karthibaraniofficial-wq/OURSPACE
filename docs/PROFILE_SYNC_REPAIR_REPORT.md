# OURSPACE V2.4.5 — Profile, DP, Status and Real-Time Synchronization Repair Report

## Overview
OURSPACE V2.4.5 delivers an end-to-end overhaul of user profile management, display picture (DP) storage, custom status messaging, and real-time synchronization between paired partners.

---

## 1. Canonical User Profile Model (`users/{uid}`)
A single authoritative user profile schema was established at `users/{uid}`, supporting modern and legacy property aliases with zero breaking changes for existing users.

### Schema Definition
```typescript
export interface Profile {
  id: string;                    // Firebase Auth UID
  email: string;                 // User email
  display_name: string;          // Display name (alias: displayName)
  avatar_url?: string | null;    // Firebase Storage HTTPS URL (alias: photoURL)
  status_message?: string | null;// Custom status text (alias: statusText)
  status_emoji?: string | null;  // Custom status emoji (alias: statusEmoji)
  is_online?: boolean;           // Real-time online flag
  last_seen_at?: string | null;  // ISO-8601 timestamp of last activity
  created_at?: string;           // ISO-8601 timestamp
  updated_at?: string;           // ISO-8601 timestamp
  partner_id?: string | null;    // Paired partner UID
  space_id?: string | null;      // Active private space ID
}
```

### Normalization & Backward Compatibility
In `apps/web/src/lib/firebase/auth.ts`, `mapFirestoreDataToProfile()` guarantees that legacy documents using camelCase (`displayName`, `photoURL`, `statusText`, `statusEmoji`) or snake_case (`display_name`, `avatar_url`, `status_message`, `status_emoji`) are cleanly mapped into a consistent `Profile` object without runtime errors or missing fields.

---

## 2. Firebase Cloud Storage DP Upload Pipeline
The previous flawed Base64 `FileReader` pipeline was completely replaced with a robust, binary Firebase Storage upload pipeline in `apps/web/src/lib/firebase/storage.ts`:

1. **Pre-flight Validation**:
   - Strict image MIME type check (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/gif`).
   - File size ceiling: 10MB (`file.size <= 10 * 1024 * 1024`).
2. **Canonical Storage Path**:
   - Stored at `users/{uid}/profile/{timestamp}_{sanitizedFileName}`.
3. **Upload Execution & Resiliency**:
   - Native `uploadBytesResumable` with `contentType` metadata.
   - 15-second stall detection timer with actionable error reporting.
   - Download URL resolved via `getDownloadURL(snapshot.ref)`.
   - Appends cache-invalidation version parameter: `${downloadUrl}?v=${Date.now()}`.
4. **Atomic Profile Update**:
   - Writes `avatar_url` to `users/{uid}` in Firestore.
   - Updates Firebase Auth profile (`updateFirebaseProfile`).
   - Updates member record in `privateSpaces/{spaceId}/members/{uid}`.
   - Updates local Zustand `useAuthStore` state.

---

## 3. Real-Time Dual-Listener Architecture
In `apps/web/src/store/useAuthStore.ts`, the profile synchronization engine was re-engineered with dual Firestore `onSnapshot` listeners:

1. **Current User Listener (`users/{currentUid}`)**:
   - Listens continuously for remote profile changes made to the user's document.
   - Automatically synchronizes local state if changes occur in another browser tab or session.
2. **Partner User Listener (`users/{partnerUid}`)**:
   - Automatically attached whenever a user is paired (`spaceId` and `partner_id` are resolved).
   - Real-time updates trigger instantaneous state updates for `partner: mappedProfile`.
   - Changes made by User A (avatar, display name, status text, status emoji) appear instantly on User B's screen without requiring manual refresh.
3. **Lifecycle & Cleanup**:
   - `unsubscribeCurrentUserProfile()` and `unsubscribePartnerProfile()` are called on:
     - User logout / sign-out.
     - Active private space change or unpairing.
     - Component unmounting.
   - Prevents memory leaks and duplicate listeners across re-renders.

---

## 4. Presence & Status Heartbeat Engine
To prevent fake "perpetually online" states and distinguish custom status from online presence:

1. **Presence Engine (`isUserOnline`)**:
   - Implemented in `packages/shared/src/index.ts`:
     ```typescript
     export function isUserOnline(lastSeenAt?: string | null, isOnline?: boolean, thresholdMs = 120_000): boolean
     ```
   - Evaluates both `is_online` boolean and a 2-minute (`120_000ms`) freshness threshold on `last_seen_at`.
2. **Presence Heartbeat**:
   - `apps/web/src/store/useAuthStore.ts` registers a 60-second periodic heartbeat updating `last_seen_at` and `is_online: true` on `users/{currentUid}`.
   - Registers listeners for:
     - `visibilitychange`: sets `is_online: false` when tab is hidden, `is_online: true` when tab returns to visible.
     - `beforeunload` & `pagehide`: fires firestore update setting `is_online: false` and timestamp on window close or tab navigation.
3. **Custom Status Separation**:
   - Custom status (`status_message` and `status_emoji`) is fully decoupled from online status.
   - Users can set custom thoughts or mood emojis without affecting presence calculation.

---

## 5. UI Component Updates

### `apps/web/src/app/dashboard/settings/page.tsx`
- Replaced Base64 upload with `uploadProfilePictureToStorage`.
- Added upload progress spinner overlay (`isUploadingAvatar`).
- Added error banner with retry button on failed uploads.
- Added quick emoji status selection buttons (❤️, ✨, 🌙, ☕, 🎮, 💻, 🎧, 💤).
- Added "Clear Status" button.

### `apps/web/src/components/layout/Sidebar.tsx`
- Partner card displays dynamic presence status via `isUserOnline` and `formatPresenceStatus`.
- Pulsing emerald ring for online state, subtle gray ring for offline state.
- Displays partner's custom status emoji and status text.

### `apps/web/src/app/dashboard/chat/page.tsx`
- Chat header displays partner avatar keyed with `key={partner.avatar_url}` to prevent stale browser cache rendering.
- Displays partner presence status ("Online", "Active 5m ago", "Offline") and custom status emoji.

### `apps/web/src/app/dashboard/page.tsx`
- Dashboard home partner card dynamically updates with real presence and status emoji.

### `apps/web/src/components/calls/ActiveCallModal.tsx`
- Corrected partner resolution:
  ```typescript
  const partner = activeCall.caller?.id === currentUser?.id ? activeCall.receiver : activeCall.caller;
  ```
- Ensures callers see receivers, and receivers see callers.

---

## 6. Summary of Changed Files

| File | Changes Made |
|---|---|
| `packages/types/src/index.ts` | Added `status_emoji`, `last_seen_at`, and `is_online` to `Profile` interface |
| `packages/shared/src/index.ts` | Added `isUserOnline` and `formatPresenceStatus` utility functions |
| `apps/web/src/lib/firebase/auth.ts` | Added `updateFirebaseProfile`, `mapFirestoreDataToProfile` canonical mapper |
| `apps/web/src/lib/firebase/storage.ts` | Implemented binary `uploadProfilePictureToStorage` with 10MB limit and versioning |
| `apps/web/src/store/useAuthStore.ts` | Implemented dual real-time Firestore listeners, heartbeat, and cleanup |
| `apps/web/src/app/dashboard/settings/page.tsx` | UI for DP upload with progress/retry, status emoji selector, clear status |
| `apps/web/src/components/layout/Sidebar.tsx` | Partner presence badge, dynamic status rendering |
| `apps/web/src/app/dashboard/chat/page.tsx` | Chat header partner avatar cache busting, status message display |
| `apps/web/src/app/dashboard/page.tsx` | Partner status card real-time presence sync |
| `apps/web/src/components/calls/ActiveCallModal.tsx` | Resolved participant identity inversion for call receiver |
| `firestore.rules` | Hardened `users/{uid}` rules to partner-only reads and immutable system fields |
| `storage.rules` | Allowed authenticated users to upload to `users/{uid}/profile/*` |
| `package.json` & `apps/web/package.json` | Version bumped to `2.4.5` |
| `tests/v2_4_5_profile_sync.test.mjs` | Automated test suite verifying profile sync, storage validation, and presence |
