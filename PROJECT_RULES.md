# OURSPACE — Project Rules & Engineering Standards (Firebase Edition)

## 1. Product Standard
OURSPACE is a premium private couple communication and connection platform engineered for exactly two connected individuals. It is built to enterprise SaaS standards: secure by default, resilient, reactive, cross-platform, and aesthetically refined.

## 2. Core Non-Negotiable Principles
1. **Strict 2-Person Space Limit**: A private space strictly accommodates at most 2 active members. Enforced by Firestore atomic transactions (`runTransaction`), Security Rules (`firestore.rules`), and Cloud Function triggers (`onSpaceMemberCreate`).
2. **Multi-Tenant Isolation via Security Rules**: Every read/write query on space data (conversations, messages, attachments, calls, reminders, memories) MUST be filtered by private space membership via `isMemberOfSpace(spaceId)` in `firestore.rules` and `storage.rules`. No data leakage across spaces is permitted.
3. **No Non-Functional Controls**: Every button, switch, link, and input performs a genuine action with optimistic UI, feedback, and error handling.
4. **Cross-Platform Parity**: Web (Next.js PWA) and Mobile (Expo React Native) share domain models, schemas, validation logic, and Firebase client configurations.
5. **Real-Time Responsiveness**: Chat, reactions, incoming calls, and reminders synchronize across all active devices via Cloud Firestore real-time snapshots (`onSnapshot`).
6. **Graceful Degradation & Local Resilience**: Dual-mode quick demo switcher (Alex/Jordan) allows full UI inspection when live Firebase credentials are not yet linked. Custom Web Audio chimes synthesize locally without network overhead.
7. **Zero Supabase Runtime Dependencies**: Supabase has been cleanly decommissioned from all active runtime code. Zero `@supabase/supabase-js` imports exist in application code.

## 3. Directory Layout (Monorepo)
- `apps/web`: Next.js 14 App Router, Vanilla CSS Tokens, Lucide, Framer Motion, Zustand, Firebase Client SDK (`apps/web/src/lib/firebase/`).
- `apps/mobile`: Expo (React Native), TypeScript.
- `packages/types`: Shared TypeScript definitions (Firestore document schemas, API payloads, WebRTC events).
- `packages/validation`: Zod validation schemas for all domain entities.
- `packages/shared`: Shared utilities, date formatting, sound synthesizer, romantic palettes.
- `functions/`: Firebase Cloud Functions (v2) for scheduled tasks, Firestore triggers, and LiveKit token minting.
- `scripts/`: Data migration tools (`migrate-supabase-to-firebase.mjs`).
- `firestore.rules`: Production Firestore security rules.
- `storage.rules`: Production Cloud Storage security rules.
- `firestore.indexes.json`: Composite query indexes.
- `firebase.json`: Firebase project configuration and emulator settings.
- `docs/`: Technical specifications, migration audit, schema mappings, security guides, deployment manuals.

## 4. Verification Workflow
Before declaring any task or phase done:
1. Type check.
2. Automated test suite passes (`node --test tests/suite.test.mjs tests/migration.test.mjs`).
3. Security review on Firestore and Storage rules.
4. Zero runtime leakage of deprecated services or credentials.
5. State update in `STATE.md`.
