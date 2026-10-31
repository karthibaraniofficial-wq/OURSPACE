# OURSPACE — Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.3.1] - 2026-10-31
### Fixed
- **LiveKit Audio Calling**:
  - Replaced simulated acceptance with genuine LiveKit Room connection and remote audio track attachment.
  - Bound Mute control directly to hardware audio track disablement and LiveKit participant muting.
  - Added browser autoplay policy handling with interactive "Tap to Enable Audio" action.
  - Removed artificial `setTimeout` auto-answer simulation from `useCallStore.ts`.
- **LiveKit Video Calling**:
  - Completely purged static Unsplash stock demonstration photos from `ActiveCallModal.tsx`.
  - Implemented real hardware camera capture via `getUserMedia({ video: true })` and bound mirrored local preview to picture-in-picture.
  - Subscribed to remote camera tracks via LiveKit SFU, streaming live partner camera feed into main stage.
  - Implemented camera toggle controls that dynamically enable/disable tracks and fall back to avatar initials when disabled.
  - Ensured all media hardware tracks (camera and microphone) are stopped upon call termination.
- **Firebase Image Sharing**:
  - Replaced Base64 Data URL embedding in Firestore with resumable chunked binary uploads to Firebase Cloud Storage.
  - Configured safe storage path: `spaces/{spaceId}/images/{senderId}/{timestamp}_{filename}`.
  - Updated `storage.rules` to recursively permit nested paths under spaces.
  - Added dedicated image picker input and "Share Photo" button in `MessageInput.tsx`.
  - Added real-time progress bar (`0%` - `100%`) during upload and error retry handling.
  - Upgraded `MessageBubble.tsx` to render genuine photographs with rounded corners, natural aspect ratio, and full-screen lightbox modal (`MediaViewerModal`) with download support.
  - Connected `CallsPage.tsx` to real Firestore `callSessions` history and eliminated Jordan Taylor mock records.
- **Automated Verification**:
  - Added `tests/call_and_media.test.mjs` verifying calling state machine, media track lifecycle, and image upload invariants (54/54 tests passing).

---


- **Public Edge Hosting & Cloud Deployment**:
  - `apps/web/vercel.json` with strict production security headers (HSTS, CSP, X-Frame-Options, Permissions-Policy for WebRTC camera/microphone).
  - `firebase.json` hosting target for Firebase Hosting alternative with public rewrite rules.
  - `apps/web/public/firebase-messaging-sw.js` for background Web Push notification handling and deep linking.
  - Optional custom domain configuration for `ourspace.app`.
- **Resilient Networking Store & Connection Monitoring**:
  - `apps/web/src/store/useNetworkStore.ts`: Dynamic online/offline detection (`navigator.onLine`), connection status transitions (`connected`, `connecting`, `reconnecting`, `offline`), and mobile network handover detection via Network Information API.
  - Buffered offline action queue with FIFO sequential flushing and idempotency key deduplication.
  - `apps/web/src/components/layout/Header.tsx`: Real-time connection status pill badge indicating Emerald "Online", Amber "Reconnecting...", and Rose "Offline (Actions Queued)".
- **Zero-Localhost Production Policy**:
  - Audited and eliminated all hardcoded `localhost`, `127.0.0.1`, and LAN IP addresses across production application code.
  - Refactored `apppackage/src/Program.cs` to default to `https://ourspace.app` (customizable via `OURSPACE_URL` or `config.json`), and recompiled `OURSPACE-Windows-v2.0.0.exe`.
- **Mobile Production Configuration**:
  - `apps/mobile/app.json`: Bundle configuration for `app.ourspace.client`, custom URL scheme `ourspace`, required hardware permissions (`CAMERA`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`), and cloud endpoint mapping.
- **Environment Staging & Documentation**:
  - Created `.env.development`, `.env.staging`, and `.env.production` templates.
  - Created comprehensive documentation: `docs/PRODUCTION_DEPLOYMENT.md`, `docs/GLOBAL_CONNECTIVITY.md`, `docs/LIVEKIT_NETWORKING.md`, `docs/MOBILE_PRODUCTION_SETUP.md`, and `docs/NETWORK_TROUBLESHOOTING.md`.
  - Added automated test suite `tests/connectivity.test.mjs` (13 tests verifying network state machines, offline queueing, zero-localhost policy, WebRTC ICE configs, and FCM payloads).

---

## [2.0.0-migration.firebase] - 2026-10-31
### Added
- **Firebase Infrastructure & Configuration**:
  - `firebase.json` for Cloud Firestore, Storage, Functions, and Local Emulator Suite.
  - `firestore.rules`: Enterprise-grade security rules enforcing strict authentication, space isolation (`isMemberOfSpace`), and atomic 2-member space boundary ceiling.
  - `storage.rules`: Space-isolated media storage rules enforcing 50MB file size ceiling and allowed MIME types.
  - `firestore.indexes.json`: Composite indexes for chat messages, call history, reminders, and calendar events.
- **Centralized Firebase Client SDK (`apps/web/src/lib/firebase/`)**:
  - `firebase.ts`: Modular Firebase initialization supporting auth, firestore, and storage.
  - `auth.ts`: Authentication flows with email/password, session persistence, and Firestore profile synchronization.
  - `firestore.ts`: Real-time listeners (`onSnapshot`), atomic transaction pairing (`runTransaction`), message reactions, and reminders.
  - `storage.ts`: Resumable media uploads with progress tracking and validation.
  - `messaging.ts`: Web Push FCM token registration.
  - `functions.ts`: Callable Cloud Functions wrapper.
  - `app-check.ts`: Firebase App Check integration with reCAPTCHA v3.
- **Backend Cloud Functions (`functions/index.js`)**:
  - `onSpaceMemberCreate`: Trigger enforcing maximum 2 members per space with auto-eviction of unauthorized third parties and audit logging.
  - `onNewMessageNotification`: Real-time FCM push notification delivery to partner devices.
  - `checkScheduledReminders`: Cron scheduler running every 1 minute to dispatch reminder alerts and advance recurring schedules.
  - `getLiveKitToken`: Authenticated callable function minting LiveKit room tokens for space members.
- **Migration & Testing Utilities**:
  - `scripts/migrate-supabase-to-firebase.mjs`: Standalone ETL transformer converting relational PostgreSQL tables into Firestore document hierarchies.
  - `tests/migration.test.mjs`: Automated migration tests verifying user documents, 2-member limit invariants, and subcollection structures.
- **Documentation**:
  - `docs/SUPABASE_TO_FIREBASE_AUDIT.md`: Complete audit of legacy dependencies.
  - `docs/FIREBASE_MIGRATION_PLAN.md`: Strategic phased migration plan.
  - `docs/FIREBASE_SCHEMA.md`: Firestore NoSQL document architecture specification.
  - `docs/FIREBASE_SECURITY.md`: Security, App Check, and access control specification.
  - `docs/FIREBASE_DEPLOYMENT.md`: Firebase CLI and emulator deployment manual.
  - `docs/MIGRATION_REPORT.md`: Comprehensive completion report, dependency removal inventory, and verification log.

### Changed
- Migrated `apps/web/src/store/useAuthStore.ts` to Firebase Auth and Firestore atomic pairing while preserving the 1-click quick demo switcher (Alex/Jordan).
- Migrated `apps/web/src/store/useChatStore.ts` to Firestore `onSnapshot` real-time listeners.
- Migrated `apps/web/src/store/useCallStore.ts` to Firestore `callSessions` signaling while preserving LiveKit SFU WebRTC media transport.
- Updated `apps/web/package.json` and `apps/mobile/package.json` to replace Supabase dependencies with Firebase SDK.
- Expanded automated test suite from 6 tests to 10 tests across 2 suites with 100% pass rate.

### Removed
- Removed `@supabase/supabase-js` and `@supabase/ssr` from active runtime.
- Deleted `apps/web/src/lib/supabase/` runtime directory.
- Removed legacy Supabase URL and key dependencies from client runtime.

---

## [1.0.0-alpha] - 2026-10-31
### Added
- **Monorepo Architecture**:
  - `@ourspace/types`: Comprehensive TypeScript definitions.
  - `@ourspace/validation`: Zod schemas for auth, pairing, messages, media, and reminders.
  - `@ourspace/shared`: Date calculations, days together counter, countdowns, zero-latency Web Audio API chime synthesizer, and romantic accent palettes.
- **Web Application (`apps/web`)**:
  - Soft glassmorphism UI with rose, cream, lavender, and dark velvet themes.
  - 1-to-1 Realtime Chat, Media Vault & Gallery, Audio & Video Calling with LiveKit, Reminders & Shared Tasks, Memories & Milestones, Settings & Personalization.
- **Mobile Application (`apps/mobile`)**:
  - Expo / React Native client (`apps/mobile/src/App.tsx`).
