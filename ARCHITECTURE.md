# OURSPACE — Architecture Specification (Firebase Edition)

## 1. High-Level Architecture

```text
[ Client Tier ]
   ├── Web (Next.js 14+ App Router, PWA, Vanilla CSS Tokens, Framer Motion)
   └── Mobile (Expo React Native, Reanimated)
            │
            │ HTTPS / WSS / gRPC Web
            ▼
[ Gateway & Auth Tier ]
   ├── Firebase Authentication (JWTs, Session Tokens, ID Token Verification)
   ├── Firebase App Check (reCAPTCHA v3 / Play Integrity abuse protection)
   └── Edge / Next.js Middleware (Route protection, Space membership assertion)
            │
            ▼
[ Application & Realtime Services ]
   ├── Cloud Firestore (Real-time snapshots, atomic transactions, subcollections)
   ├── Firebase Realtime Database (Optimized ephemeral presence & typing indicators)
   ├── Firebase Cloud Storage (Space-isolated media buckets, resumable uploads)
   ├── Firebase Cloud Functions (Background triggers, schedulers, callable endpoints)
   ├── Firebase Cloud Messaging (Cross-platform push notifications for iOS, Android, Web)
   └── LiveKit Cloud / SFU (Preserved WebRTC Audio/Video media transport)
            │
            ▼
[ Persistence Tier ]
   └── Cloud Firestore NoSQL Database (Document model, composite indexes, atomic transactions)
```

## 2. Security & Data Isolation Architecture

### 2.1 Private Space Boundary
Every couple tenant is an isolated document in the `privateSpaces` collection. Each space is strictly bounded to at most two users through the `members` subcollection:

```text
privateSpaces/{spaceId}
  ├── memberCount: 2 (ceiling strictly enforced)
  ├── pairingCode: "X8K9M2P1"
  └── members/{uid}
        ├── role: "creator" | "partner"
        └── joinedAt: Timestamp
```

### 2.2 Security Rules Policy Pattern
All child collections and subcollections (`conversations`, `messages`, `mediaFiles`, `reminders`, `callSessions`, `events`) enforce access using the Firestore Security Rules helper:

```javascript
function isMemberOfSpace(spaceId) {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/privateSpaces/$(spaceId)/members/$(request.auth.uid));
}
```

This guarantees zero data leakage across different couples at the database layer.

### 2.3 Atomic Two-Person Limit
Concurrency during invite code redemption is strictly regulated using Firestore `runTransaction`:

```javascript
await runTransaction(db, async (transaction) => {
  const spaceDoc = await transaction.get(spaceRef);
  const data = spaceDoc.data();
  if (data.memberCount >= 2) {
    throw new Error("This private space is already full.");
  }
  transaction.set(memberRef, { role: "partner", joinedAt: serverTimestamp() });
  transaction.update(spaceRef, { memberCount: data.memberCount + 1 });
});
```

Furthermore, the Cloud Function `onSpaceMemberCreate` (`functions/index.js`) validates total member documents and automatically evicts any rogue third member.

---

## 3. Realtime Signaling Flow

```text
[Alice Device]                         [Cloud Firestore]                      [Bob Device]
      │                                         │                                  │
      ├─── Send Message (doc set) ─────────────►│                                  │
      │                                         ├──── Real-time Snapshot (onSnapshot) ─►
      │                                         │                                  ├── Display Message
      │                                         │                                  ├── Play Sound Chime
      │                                         │                                  └── Update Read Receipt
      │                                         │                                         │
      │                                         │◄─── Update messageReceipt (update) ─────┤
      │◄── Snapshot Update (onSnapshot) ────────┤                                         │
      ├── Update Delivery Indicator (✓✓ Blue)   │                                         │
```

---

## 4. WebRTC Calling Signaling Flow (Preserving LiveKit SFU)

```text
[Caller]                               [Cloud Firestore]                          [Callee]
   │                                            │                                     │
   ├── Set callSessions/{callId} (ringing) ────►│                                     │
   │                                            ├──── Snapshot Event (onSnapshot) ───►│
   │                                            │                                     ├── Trigger Ringing Audio
   │                                            │                                     ├── Show Incoming Screen
   │                                            │                                     ├── Click "Accept"
   │                                            │◄─── Update callSessions (active) ───┤
   │◄── Snapshot Event (onSnapshot) ────────────┤                                     │
   │                                            │                                     │
   ├── Call getLiveKitToken(callId)             │                                     ├── Call getLiveKitToken(callId)
   │   (Cloud Function verifies membership)     │                                     │   (Cloud Function verifies membership)
   ├── Connect to LiveKit SFU Room ─────────────┴─────────────────────────────────────┤ Connect to LiveKit Room
   │◄═════════════════════════ WebRTC Audio & Video Stream ══════════════════════════►│
```

---

## 5. Scheduled Reminders & Cloud Messaging Flow

```text
[Cloud Scheduler (every 1 min)]
             │
             ▼
[Cloud Functions: checkScheduledReminders]
             │
             ├── Query: collectionGroup('reminders').where('isCompleted' == false).where('dueAt' <= now)
             ├── Update: Mark completed or compute next recurrence (daily, weekly, monthly, yearly)
             │
             ▼
[Firebase Cloud Messaging (FCM)]
             │
             ├── Send multicast payload to partner device FCM tokens
             ▼
[Partner Device (iOS / Android / Web)]
   ├── Displays high-priority notification with deep link to /dashboard/reminders
   └── Triggers celebratory reminder chime
```
