# OURSPACE — Supabase to Firebase Comprehensive Technical Audit

## 1. Executive Summary
This audit inspects the complete codebase of **OURSPACE**, identifying all current Supabase dependencies, data models, persistence mechanisms, real-time channels, storage policies, and environment configurations. It maps each component to its designated production Firebase equivalent.

---

## 2. Inventory of Detected Supabase Dependencies

### 2.1 Package Dependencies
| Package | Version | Location | Target Firebase Replacement |
|---|---|---|---|
| `@supabase/supabase-js` | `^2.45.6` | `apps/web/package.json`, `apps/mobile/package.json` | `firebase` (Web SDK 10.x / 11.x) & `firebase-admin` (Server / Cloud Functions) |
| `@supabase/ssr` | `^0.5.1` | `apps/web/package.json` | Firebase Auth session cookie / client SDK state |

### 2.2 Client Initializers & Service Wrappers
- `apps/web/src/lib/supabase/client.ts` — Creates browser Supabase client via `createBrowserClient()`.
  - **Replacement**: `apps/web/src/lib/firebase/` centralized modular SDK (`firebase.ts`, `auth.ts`, `firestore.ts`, `storage.ts`, `messaging.ts`, `functions.ts`).

### 2.3 Application Stores & Runtime Usages
1. **`apps/web/src/store/useAuthStore.ts`**:
   - `auth.getSession()`, `auth.signInWithPassword()`, `auth.signUp()`, `auth.signOut()`.
   - Table queries: `profiles`, `space_members`, `private_spaces`, `invitations`.
   - **Replacement**: Firebase Authentication (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged`) + Cloud Firestore operations.
2. **`apps/web/src/store/useChatStore.ts`**:
   - Table queries: `messages`, `message_reactions`, `message_attachments`, `message_deletions`.
   - Realtime broadcast channel: `space:{space_id}` for ephemeral typing indicators.
   - **Replacement**: Cloud Firestore real-time collection listeners (`onSnapshot`) for messages/reactions/attachments + Firebase Realtime Database for ephemeral typing indicators.
3. **`apps/web/src/store/useCallStore.ts`**:
   - Table queries: `call_sessions`.
   - Realtime broadcast channel: `space:{space_id}` for call events (`incoming`, `accepted`, `declined`, `ended`).
   - Media transport: LiveKit SFU (preserved!).
   - **Replacement**: Cloud Firestore `callSessions` document snapshots for WebRTC signaling and call state.

### 2.4 Environment Variables
| Legacy Supabase Variable | Target Firebase Environment Variable |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_DATABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_APP_ID` |
| `SUPABASE_SERVICE_ROLE_KEY` | `FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY` (Server / Functions only) |
| N/A | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| N/A | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| N/A | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| N/A | `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` |

---

## 3. Database Schema Mapping: PostgreSQL to Cloud Firestore

| PostgreSQL Table | Existing Purpose | Cloud Firestore Structure | Access Pattern |
|---|---|---|---|
| `profiles` | User profile, anniversary, status, theme | `users/{uid}` | Read by space partner, updated only by owner |
| `private_spaces` | Space tenant root (name, started_at, accent) | `privateSpaces/{spaceId}` | Read/write strictly by authorized members |
| `space_members` | Junction table enforcing max 2 members | `privateSpaces/{spaceId}/members/{uid}` | Enforced by Firestore Security Rules & Functions |
| `invitations` | 8-character code, expiration, accepted status | `invitations/{code}` | Validated on join; atomic transaction to accept |
| `conversations` | Conversation thread parent | `privateSpaces/{spaceId}/conversations/{convId}` | 1 per space (Main chat) |
| `messages` | Chat messages with replies and edits | `privateSpaces/{spaceId}/conversations/{convId}/messages/{msgId}` | Subcollection, ordered by `createdAt`, indexed |
| `message_reactions` | Emoji reactions per message | Subcollection `.../messages/{msgId}/reactions/{rxId}` or embedded array in message doc | Atomic arrayUnion / subcollection |
| `message_attachments` | File metadata, signed URLs, categories | Embedded in message doc `attachments: [...]` | Eliminates extra queries on message load |
| `message_receipts` | Delivered and read timestamps | `.../messages/{msgId}/receipts/{uid}` | Real-time update |
| `typing_states` | Ephemeral user typing status | Firebase Realtime Database `presence/{spaceId}/{uid}/typing` | Zero write cost, automatic disconnect detection |
| `user_devices` | FCM push notification tokens per device | `users/{uid}/devices/{deviceId}` | Subcollection for multi-device push routing |
| `notification_preferences` | Sound profiles, quiet hours, DND | `users/{uid}/settings/notifications` | Document within user settings |
| `reminders` | Personal and shared couple tasks | `privateSpaces/{spaceId}/reminders/{reminderId}` | Real-time sync, scheduled Cloud Function triggers |
| `shared_events` | Anniversaries, birthdays, countdowns | `privateSpaces/{spaceId}/events/{eventId}` | Read by space members, calendar view |
| `media_files` | Vault photo, video, document metadata | `privateSpaces/{spaceId}/mediaFiles/{fileId}` | Full gallery queries, category filtering |
| `albums` | Themed collections of memories | `privateSpaces/{spaceId}/albums/{albumId}` | Grouping media items |
| `call_sessions` | WebRTC call metadata and duration | `privateSpaces/{spaceId}/callSessions/{callId}` | Real-time signaling with `onSnapshot` |
| `audit_logs` | Security sensitive action logs | `privateSpaces/{spaceId}/auditLogs/{logId}` | Append-only audit trail |

---

## 4. Storage Architecture Mapping

| Existing Supabase Storage | Target Firebase Storage |
|---|---|
| Bucket: `ourspace-media` (Private) | Default Firebase Storage bucket |
| Path: `{spaceId}/{category}/{filename}` | Path: `spaces/{spaceId}/{category}/{fileId}_{filename}` |
| Security: SQL storage RLS policies | Security: `storage.rules` validating `request.auth.uid` against space membership |
| Download: Short-lived signed URLs | Download: Secure Firebase Storage download URLs with token-based access |

---

## 5. Calling & Media Transport Infrastructure
- **Existing Architecture**: WebRTC media transport powered by **LiveKit SFU** with signaling handled via database state and real-time broadcasts.
- **Migration Strategy**:
  - **Media Transport**: LiveKit remains unchanged! (We do NOT replace low-latency WebRTC SFU with Firestore).
  - **Signaling & Call Lifecycle**: Migrates from Supabase Realtime to Cloud Firestore `privateSpaces/{spaceId}/callSessions/{callId}` real-time listener + Firebase Cloud Messaging background call alerts.
  - **Token Generation**: Migrates from Next.js server route to Firebase Cloud Function `getLiveKitToken` or Next.js API route using Firebase Auth verification.

---

## 6. Features Affected by Migration

1. **Authentication**: Sign up, sign in, sign out, password reset, session persistence.
2. **Pairing**: Creating private space, generating 8-character invitation code & QR code, validating max 2 member ceiling, redeeming invitation.
3. **Chat**: Message submission, attachments upload, real-time message stream via Firestore `onSnapshot`, editing, soft deletion, emoji reactions, typing indicators via Realtime DB.
4. **Media Sharing**: Photo/video/document upload to Firebase Storage, download URLs, lightbox viewer, favourites.
5. **Calls**: Call invitation signaling, incoming ring dialog, call acceptance/rejection, duration tracking, call history.
6. **Reminders & Events**: Real-time reminder sync, completion toggling, anniversary and birthday countdowns.
7. **Settings**: Theme, accent colors, custom Web Audio synthesizer presets, FCM push preferences, space unpairing.

---

## 7. Migration Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Race condition allowing 3rd member to join a space | High | Atomic Firestore Transaction in Cloud Function / Security Rules checking `members` count < 2 before committing member insert. |
| Excessive Firestore document reads on chat scroll | Medium | Paginate message queries with `limit(50)` and `startAfter()`; embed reactions and attachments inside the message document where appropriate. |
| Ephemeral typing indicators driving unnecessary Firestore document write costs | Medium | Use Firebase Realtime Database with `onDisconnect()` or lightweight Firestore document with debounce. |
| Cold-start latency on LiveKit room token generation | Low | Optimize Cloud Function with minimal cold dependencies or use Next.js edge route with Firebase Admin SDK. |
| Browser autoplay blocking call ringtone | Low | Preserved Web Audio API synthesizer unlocks on first user interaction. |
