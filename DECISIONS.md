# OURSPACE — Architecture Decision Records (ADR)

## ADR 001: Strict 2-User Space Limit Enforced at Database Level
- **Context**: OURSPACE is specifically designed for romantic couples (exactly 2 members).
- **Decision**: Enforce member count via database constraints. In PostgreSQL, this was enforced via trigger. In Cloud Firestore, this is enforced via atomic transactions (`runTransaction`), Security Rules (`firestore.rules`), and Cloud Function triggers (`onSpaceMemberCreate`).
- **Alternatives Considered**: Application-level checks only. Rejected because concurrent race conditions could permit a 3rd user to join.
- **Impact**: Absolute guarantee of privacy and tenant isolation across both relational and NoSQL implementations.

## ADR 002: Monorepo with Shared Types and Validation
- **Context**: Web and mobile clients need consistent validation, schemas, and state representation.
- **Decision**: Use npm workspaces with `@ourspace/types`, `@ourspace/validation`, and `@ourspace/shared` alongside `apps/web` and `apps/mobile`.
- **Alternatives Considered**: Polyrepo. Rejected due to code divergence risks.
- **Impact**: Single source of truth for schema types, Zod schemas, and date/sound logic.

## ADR 003: Web Audio API for Zero-Asset Sound Synthesis
- **Context**: Mobile/Web apps often fail or show 404s when external audio files fail to load or are blocked by browser autoplay policies.
- **Decision**: Implement built-in polyphonic chime synthesis using Web Audio API (`AudioContext`) with customizable envelopes, alongside support for user-uploaded custom audio files.
- **Impact**: Instant, reliable, zero-latency notification sounds across all modern browsers without external asset dependencies.

## ADR 004: LiveKit for Real-Time Calling Media Transport
- **Context**: 1-to-1 audio and video calls require low latency, adaptive bitrate, and reliable reconnects.
- **Decision**: Use LiveKit for SFU media transport with database-backed state for signaling.
- **Impact**: Production-grade WebRTC with robust reconnect handling.

## ADR 005: Complete Backend Migration from Supabase to Google Firebase
- **Context**: Application requirement to transition from Supabase (Postgres, GoTrue, Realtime channels, Storage) to Google Firebase (Firebase Auth, Cloud Firestore, Cloud Storage, Firebase Cloud Messaging, Cloud Functions).
- **Decision**: Completely replace Supabase runtime dependencies with modular Firebase SDKs (`apps/web/src/lib/firebase/`), convert relational tables into hierarchical Firestore documents and subcollections, and delete legacy Supabase runtime folders.
- **Alternatives Considered**: Dual backend adapter pattern. Rejected to prevent bloat, duplicate network requests, and maintenance overhead.
- **Impact**: Clean, native Firebase architecture while preserving 100% of the existing user interface and romantic feature set.

## ADR 006: Preservation of LiveKit SFU with Firestore Call Signaling
- **Context**: Video calling media transport cannot be replaced with a database.
- **Decision**: Retain LiveKit as the WebRTC media infrastructure. Firestore replaces Supabase for call invitations, room status, caller metadata, and missed call history (`callSessions` subcollection). Cloud Functions (`getLiveKitToken`) handle room token minting.
- **Alternatives Considered**: Pure peer-to-peer WebRTC via Firestore signaling only. Rejected due to NAT traversal issues and mobile battery drain compared to LiveKit SFU.
- **Impact**: Retains high-definition calling while harmonizing signaling into Firestore.

## ADR 007: Atomic Transactions & Security Rules for 2-Member Ceiling in NoSQL Firestore
- **Context**: Cloud Firestore is a NoSQL document database without SQL triggers.
- **Decision**: Couple pairing code redemption uses Firestore `runTransaction` to atomically check `memberCount < 2` before inserting the member document and incrementing the count. Backed by `functions/index.js` (`onSpaceMemberCreate`) as a safety net.
- **Impact**: Eliminates race conditions during space pairing and preserves the core 2-person invariant.
