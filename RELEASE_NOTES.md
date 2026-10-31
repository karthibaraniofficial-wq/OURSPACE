# OURSPACE — Release Notes (v2.0.0 Firebase Edition)

OURSPACE has successfully completed a full backend migration from **Supabase** to **Google Firebase**, delivering an enterprise-ready, serverless, real-time private sanctuary for couples across Web and Mobile.

---

## 🌟 What's New in v2.0.0

### 1. Complete Google Firebase Backend
- **Firebase Authentication**: Seamless email/password registration, login, logout, and persistent sessions via `onFirebaseAuthStateChanged`.
- **Cloud Firestore NoSQL Architecture**: Scalable hierarchical document collections with subcollections (`conversations/{id}/messages`, `reminders`, `mediaFiles`, `callSessions`).
- **Real-Time Data Streaming**: Instant updates via Firestore `onSnapshot` listeners, replacing Supabase PostgreSQL change streams.
- **Firebase Cloud Storage**: Private, space-isolated media vault enforcing 50MB file size limits and MIME validation.
- **Firebase Cloud Functions (v2)**: Scheduled reminder dispatching, Firestore triggers for space boundary enforcement, and LiveKit token minting.
- **Firebase Cloud Messaging (FCM)**: Cross-platform push notifications across Web Push, Android, and iOS.
- **Firebase App Check**: Client-side reCAPTCHA v3 protection against abusive bot traffic.

### 2. Strict 2-Person Private Space Invariant Preserved
- Concurrent invite code redemptions are safeguarded by Firestore `runTransaction` guaranteeing atomic checks on `memberCount < 2`.
- Backed by the `onSpaceMemberCreate` Cloud Function trigger which immediately evicts and logs any unauthorized third party attempting to join a couple space.
- Production-ready `firestore.rules` and `storage.rules` ensure no user outside the space can read or write any documents or media.

### 3. Preserved WebRTC Audio & Video Calling
- Preserved LiveKit WebRTC media transport for crystal-clear audio and video calling.
- Integrated Firestore `callSessions` collection for instant incoming call signaling, dialing dialogs, accept/reject workflows, and call duration logs.
- Cloud Function callable endpoint (`getLiveKitToken`) verifies space membership before issuing authorized LiveKit room tokens.

### 4. Zero Supabase Runtime Dependencies
- Decommissioned `@supabase/supabase-js` and `@supabase/ssr` from active runtime.
- Removed legacy Supabase client directories (`apps/web/src/lib/supabase`).
- Centralized Firebase SDK modules under `apps/web/src/lib/firebase/`:
  - `firebase.ts`
  - `auth.ts`
  - `firestore.ts`
  - `storage.ts`
  - `messaging.ts`
  - `functions.ts`
  - `app-check.ts`

### 5. Verified Data Migration & Test Coverage
- Standalone ETL transformer script (`scripts/migrate-supabase-to-firebase.mjs`) handles extraction, relational-to-document transformations, and Firestore batch loading.
- 10 out of 10 automated tests passing on Node 24 (`tests/suite.test.mjs` and `tests/migration.test.mjs`).
- Complete technical audit and deployment documentation in `docs/SUPABASE_TO_FIREBASE_AUDIT.md`, `docs/FIREBASE_SCHEMA.md`, `docs/FIREBASE_SECURITY.md`, `docs/FIREBASE_DEPLOYMENT.md`, and `docs/MIGRATION_REPORT.md`.

---

## 🌐 What's New in v2.1.0 — Global Internet Connectivity & Production Deployment

### 1. Resilient Global Networking
- **Edge Deployment Configuration**: Ready-to-deploy `vercel.json` with HSTS, CSP, and permissions policies, plus `firebase.json` hosting target.
- **Dynamic Connection Monitoring**: Real-time status indicator (`Online`, `Reconnecting...`, `Offline (Actions Queued)`) driven by `useNetworkStore.ts`.
- **Offline Action Queue**: Actions executed during connection drops are safely buffered in a FIFO queue and flushed automatically upon reconnection with idempotency keys.
- **Web Push FCM Service Worker**: Root service worker (`/firebase-messaging-sw.js`) handles background messages, incoming call notifications, and deep link navigation.

### 2. Zero-Localhost Production Policy
- Audited entire project codebase to guarantee zero active runtime dependencies on `localhost`, `127.0.0.1`, or local LAN IPs.
- Desktop Windows launcher (`apppackage/OURSPACE-Windows-v2.0.0.exe`) defaults to public cloud endpoint `https://ourspace.app`.

### 3. Multi-Network LiveKit WebRTC
- Built-in support for WebRTC NAT traversal across cellular 4G/5G carriers (Jio, Airtel, T-Mobile, AT&T) via LiveKit Cloud SFU.
- Configured TURN-over-TLS (port 443) fallback for restrictive firewalls.
- Reconnection and ICE restart handling during cellular-to-Wi-Fi network switching.

---

## 🚀 Quick Start for Operators
1. Copy configuration template:
   ```bash
   cp .env.example .env.local
   ```
2. Populate Firebase Web App configuration credentials and LiveKit Cloud URL.
3. Deploy security rules and cloud functions:
   ```bash
   firebase login
   firebase use <project-id>
   firebase deploy --only firestore:rules,storage,functions,hosting
   ```
4. Deploy Next.js Web App to Vercel:
   ```bash
   cd apps/web
   npx vercel deploy --prod
   ```
5. Run comprehensive automated test suite (40/40 tests passing):
   ```bash
   node --test tests/*.test.mjs
   ```
6. Launch development server:
   ```bash
   npm run dev:web
   ```
