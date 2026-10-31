# OURSPACE — Development Roadmap

## Phase 1: Project Inspection and Planning
- [x] Inspect workspace and environment (Node v24.19.0, npm 11.17.0, Git 2.55).
- [x] Create project memory files (`PROJECT_RULES.md`, `SPEC.md`, `ARCHITECTURE.md`, `STACK.md`, `ROADMAP.md`, `STATE.md`, `DECISIONS.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`, `VERIFICATION.md`, `RELEASE_NOTES.md`).
- [x] Define monorepo architecture and package contracts.

## Phase 2: Foundation & Pairing
- [x] Initialize monorepo root (`package.json`, workspaces).
- [x] Create `@ourspace/types` package.
- [x] Create `@ourspace/validation` package.
- [x] Create `@ourspace/shared` package.
- [x] Build Next.js Web App foundation (`apps/web`) with Tailwind CSS and CSS design tokens.
- [x] Implement Authentication flows (Register, Login, Password Reset, Profile Setup, 1-Click Demo Profiles).
- [x] Implement Couple Pairing System (Generate space, Invite code, QR Code, Join space, Unpair).

## Phase 3: Core Communication (Chat & Media)
- [x] Build Real-Time Chat interface with message bubble glassmorphism.
- [x] Implement text messaging, message editing, soft deletion ("Delete for me" vs "Delete for both").
- [x] Implement reply preview and quoting.
- [x] Implement message reactions & emoji picker (❤️, 😍, 😂, 🥺, 🎉, 💋 + full emoji picker).
- [x] Implement media sharing (Photos, Videos, Documents) with upload progress and signed URLs.
- [x] Build Media Gallery & Lightbox viewer.
- [x] Implement GIPHY search and GIF sharing with fallback proxy.

## Phase 4: Audio & Video Calling
- [x] Build LiveKit integration and token generation endpoint.
- [x] Build Call Signaling with database-backed session state.
- [x] Build Incoming Call modal with ringtone chime and accept/reject controls.
- [x] Build Active Call UI (Video grid, Audio meter, Mic mute, Cam toggle, PiP, Call duration).
- [x] Build Call History & Missed Call notifications.

## Phase 5: Reminders, Calendar & Personalization
- [x] Build Personal & Shared Reminders engine with recurrence and completion confetti.
- [x] Build Days Together counter and Anniversary / Birthday countdowns.
- [x] Build Shared Calendar view.
- [x] Build Custom Notification Sound system (harmonic Web Audio synthesizers + upload).
- [x] Build Appearance settings (Accent colors, Light/Dark theme, Chat wallpapers).

## Phase 6: Mobile Client & PWA
- [x] Initialize Expo Mobile App (`apps/mobile/src/App.tsx`) with shared logic and types.
- [x] Configure PWA manifest and service worker in `apps/web`.
- [x] Verify cross-platform responsive behavior on mobile viewports.

## Phase 7: Verification & Initial Quality Gate
- [x] Automated unit test suite execution (`node --test tests/suite.test.mjs`) — 6/6 tests passed.
- [x] Validation test suite execution (`tests/validation.test.mjs`).
- [x] Security audit (isolation, credential masking, input sanitization).

## Phase 8: Complete Supabase-to-Firebase Migration
- [x] Complete project audit of all Supabase dependencies documented in `docs/SUPABASE_TO_FIREBASE_AUDIT.md`.
- [x] Strategic migration plan documented in `docs/FIREBASE_MIGRATION_PLAN.md`.
- [x] Cloud Firestore NoSQL document architecture specified in `docs/FIREBASE_SCHEMA.md`.
- [x] Security architecture and App Check design specified in `docs/FIREBASE_SECURITY.md`.
- [x] Deployment guide documented in `docs/FIREBASE_DEPLOYMENT.md`.
- [x] Create production `firestore.rules` (auth, space boundary `isMemberOfSpace`, 2-member limit).
- [x] Create production `storage.rules` (auth, space boundary, 50MB ceiling, MIME validation).
- [x] Create composite indexes in `firestore.indexes.json`.
- [x] Create Firebase project configuration in `firebase.json` for firestore, storage, functions, and emulators.
- [x] Create centralized Firebase client SDK (`apps/web/src/lib/firebase/`): `firebase.ts`, `auth.ts`, `firestore.ts`, `storage.ts`, `messaging.ts`, `functions.ts`, `app-check.ts`.
- [x] Migrate `useAuthStore.ts` to Firebase Auth, Firestore profile hydration, and atomic pairing transactions.
- [x] Migrate `useChatStore.ts` to Firestore `onSnapshot` real-time listeners and atomic reactions.
- [x] Migrate `useCallStore.ts` to Firestore `callSessions` signaling while preserving LiveKit SFU media transport.
- [x] Implement Cloud Functions in `functions/index.js` (`onSpaceMemberCreate`, `onNewMessageNotification`, `checkScheduledReminders`, `getLiveKitToken`).
- [x] Create automated migration transformation utility in `scripts/migrate-supabase-to-firebase.mjs`.
- [x] Create migration test suite in `tests/migration.test.mjs` verifying document transformations and 2-member limit invariants.
- [x] Cleanly remove Supabase packages (`@supabase/supabase-js`, `@supabase/ssr`) and delete legacy `apps/web/src/lib/supabase`.
- [x] Verify zero Supabase runtime references in `apps/` and `packages/`.
- [x] Execute full automated test suite: 10/10 tests passed across `tests/suite.test.mjs` and `tests/migration.test.mjs`.
- [x] Generate comprehensive final report in `docs/MIGRATION_REPORT.md`.
