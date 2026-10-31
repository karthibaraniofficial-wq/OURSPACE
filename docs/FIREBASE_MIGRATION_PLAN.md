# OURSPACE — Supabase to Firebase Migration Plan

## 1. Objectives
Transition the OURSPACE full-stack platform from Supabase to Google Firebase while:
1. Preserving all existing functionality, real-time responsive speeds, and romantic glassmorphism design.
2. Maintaining strict 2-member private space boundaries with atomic transactions and Firestore security rules.
3. Implementing client-side and server-side Firebase SDKs (`firebase` and `firebase-admin`).
4. Replacing all active runtime dependencies without leaving orphan Supabase code.

---

## 2. Phased Migration Execution

```text
PHASE 1: Project Inspection & Technical Audit (Completed: docs/SUPABASE_TO_FIREBASE_AUDIT.md)
   │
   ▼
PHASE 2: Architecture & Security Specifications
   ├── docs/FIREBASE_SCHEMA.md
   ├── docs/FIREBASE_SECURITY.md
   ├── docs/FIREBASE_DEPLOYMENT.md
   └── firestore.rules, storage.rules, firestore.indexes.json, firebase.json
   │
   ▼
PHASE 3: Centralized Firebase Client SDK Setup
   └── apps/web/src/lib/firebase/
        ├── firebase.ts
        ├── auth.ts
        ├── firestore.ts
        ├── storage.ts
        ├── messaging.ts
        ├── functions.ts
        └── app-check.ts
   │
   ▼
PHASE 4: Domain & Store Migration
   ├── Migrate useAuthStore.ts to Firebase Auth & Firestore Users/Spaces
   ├── Migrate useChatStore.ts to Firestore onSnapshot & Realtime DB Typing
   └── Migrate useCallStore.ts to Firestore Call Sessions & WebRTC Signaling
   │
   ▼
PHASE 5: Server Routes & Cloud Functions
   ├── Update apps/web/src/app/api/livekit/token/route.ts with Firebase token verification
   └── Firebase Cloud Functions for scheduled reminder notifications and pairing validation
   │
   ▼
PHASE 6: Data Migration & Account Mapping Utility
   └── scripts/migrate-supabase-to-firebase.mjs
   │
   ▼
PHASE 7: Package Replacement & Runtime Cleanliness
   ├── Remove @supabase/supabase-js and @supabase/ssr
   ├── Add firebase package to apps/web and apps/mobile
   └── Verify zero active runtime Supabase imports
   │
   ▼
PHASE 8: Automated Verification & Test Execution
   ├── Execute unit tests (tests/suite.test.mjs)
   ├── Execute Firestore rules tests
   └── Generate docs/MIGRATION_REPORT.md
```
