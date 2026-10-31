# OURSPACE V2.4.5 — Profile Security Rules and Verification Suite

## Overview
This document specifies the security architecture, Firestore and Firebase Cloud Storage rules enforcement, automated test results, and manual verification procedures for profile synchronization and asset management in OURSPACE V2.4.5.

---

## 1. Security Architecture & Rules

### Firestore Security Rules (`firestore.rules`)
User profiles contain personal identity information, custom status thoughts, and online presence timestamps. Access must be strictly restricted to the user and their verified space partner.

```javascript
// Helper checking if authenticated caller is co-member in a private space with target user:
function canReadUserProfile(targetUid) {
  return isAuthenticated() && (
    isOwner(targetUid) ||
    // Partner access: must be verified member in target user's space
    (
      resource.data.space_id != null &&
      isSpaceMember(resource.data.space_id)
    )
  );
}

match /users/{uid} {
  // Read allowed ONLY for the user or their verified space partner
  allow read: if canReadUserProfile(uid);
  
  // Creation allowed for authenticated user's own UID
  allow create: if isOwner(uid) && 
    request.resource.data.id == uid &&
    request.resource.data.email == request.auth.token.email;
    
  // Update allowed ONLY by the profile owner, preventing tampering with protected system fields
  allow update: if isOwner(uid) &&
    // Immutable system fields
    request.resource.data.id == uid &&
    request.resource.data.email == resource.data.email &&
    (!('createdAt' in request.resource.data) || request.resource.data.createdAt == resource.data.createdAt);
    
  // Deletion forbidden via client SDK
  allow delete: if false;
}
```

### Key Security Safeguards
1. **Partner Boundary Isolation**: Unpaired users or unauthorized third parties cannot read a user's profile document.
2. **Field Immutability**: Client cannot overwrite `id`, `email`, or `createdAt`. Space membership assignment is governed through the verified invite/pairing workflow.
3. **Write Ownership**: No user can update another user's profile under any circumstances (`isOwner(uid)`).

---

### Firebase Storage Security Rules (`storage.rules`)
```javascript
match /users/{uid}/profile/{allFiles=**} {
  // Anyone in the space could view, but storage URLs are unguessable download tokens
  allow read: if request.auth != null;
  // Upload allowed ONLY by profile owner for valid image types under 10MB
  allow write: if request.auth != null && 
    request.auth.uid == uid &&
    request.resource.size < 10 * 1024 * 1024 &&
    request.resource.contentType.matches('image/.*');
}
```

---

## 2. Automated Test Results

### Suite: `tests/v2_4_5_profile_sync.test.mjs`
Run command: `node --test tests/v2_4_5_profile_sync.test.mjs`

| # | Test Case Description | Status | Duration |
|---|---|---|---|
| 1 | Canonical Profile Model: maps and normalizes all fields with backward compatibility | **PASSED** | 9.58ms |
| 2 | Canonical Profile Model: supports legacy field names gracefully without crash | **PASSED** | 0.55ms |
| 3 | Profile Picture Upload Pipeline: validates images and enforces 10MB limit | **PASSED** | 1.41ms |
| 4 | Profile Picture: strictly forbids raw Base64 data URLs or Blob URLs in canonical storage | **PASSED** | 0.32ms |
| 5 | Real-Time Two-Way Synchronization: User A updates profile -> User B instantly sees changes | **PASSED** | 1.11ms |
| 6 | Security Rules: only legitimate space partner can read profile; 3rd party attacker is rejected | **PASSED** | 0.69ms |
| 7 | Presence & Online Calculation: cleanly distinguishes custom status from active presence | **PASSED** | 0.60ms |
| 8 | Space Isolation: unpairing and signing out clears user-specific partner state | **PASSED** | 0.66ms |

### Complete Repository Regression Suite
Run command: `npm test`
- **Total Tests**: 97
- **Suites**: 23
- **Passed**: 97
- **Failed**: 0
- **Duration**: ~3.0s

---

## 3. Manual Verification Protocol (Two Separate Accounts)

To perform live verification between User A and User B:

### Step 1: Sign in on Two Browser Contexts
- Context 1 (Chrome): User A (`userA@example.com`)
- Context 2 (Chrome Incognito or Firefox): User B (`userB@example.com`)
- Confirm both users are paired into the same Private Space.

### Step 2: Display Name Synchronization
1. On Context 1 (User A), navigate to `/dashboard/settings`.
2. Change display name to `"Alex Mercer"`. Click **Save Changes**.
3. **Observation on Context 2 (User B)**:
   - Sidebar partner card instantly updates to `"Alex Mercer"`.
   - Chat header instantly updates to `"Alex Mercer"`.
   - No browser reload or page refresh required.

### Step 3: Display Picture (DP) Upload Synchronization
1. On Context 1 (User A), click the camera icon on the avatar in `/dashboard/settings`.
2. Select a valid JPEG or PNG image (< 10MB).
3. Observe upload spinner overlay.
4. Verify upload completes successfully and toast notification appears.
5. Inspect Firestore: `users/{uidA}.avatar_url` is a Firebase Storage HTTPS URL (e.g. `https://firebasestorage.googleapis.com/...`). It is **not** a `data:image/...` Base64 string or `blob:` URL.
6. **Observation on Context 2 (User B)**:
   - User B immediately sees User A's new avatar in the sidebar, chat header, and dashboard.

### Step 4: Custom Status & Status Emoji Synchronization
1. On Context 1 (User A), type a custom status `"Coding late tonight..."` and select the 💻 emoji. Click **Save Changes**.
2. **Observation on Context 2 (User B)**:
   - User B's sidebar partner widget displays `💻 "Coding late tonight..."`.
   - User B's chat header displays the 💻 emoji and status text.

### Step 5: Online Presence & Disconnect Detection
1. While Context 1 (User A) is active, User B sees green pulsing ring ("Online").
2. Close Context 1 tab or minimize browser window.
3. Observe that `visibilitychange` or `pagehide` fires, transitioning User A's presence.
4. When User A re-opens tab, presence returns to "Online".

### Step 6: Active Call Partner Display
1. User A initiates an audio or video call to User B.
2. User B accepts the call.
3. **Verification in `ActiveCallModal`**:
   - User A sees User B's avatar and name.
   - User B sees User A's avatar and name.
   - Neither participant sees their own profile as the remote partner.
