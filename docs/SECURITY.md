# OURSPACE — Security, Privacy & Compliance Architecture

## 1. Principles of Private Communication
OURSPACE is designed exclusively for sensitive personal and couple communication.
Security is treated as a fundamental requirement across all tiers:
1. **Zero Multi-Tenant Bleed**: Space boundaries are enforced by PostgreSQL RLS at the persistence layer, not simply in client code.
2. **Strict Two-Party Consent**: Space pairing requires an explicit cryptographic invitation token (48-hour expiration) and rejects a third party.
3. **Private Media by Default**: Media files are stored in private buckets accessible only via space-scoped signed URLs or authenticated RLS download streams.
4. **Session Transparency**: Active user sessions and device tokens are tracked in `user_devices`, allowing revocation of unauthorized sessions.
5. **No Secret Inlining**: Privileged keys (e.g. `SUPABASE_SERVICE_ROLE_KEY`, LiveKit API secrets) are restricted to backend Edge Functions / server routes and NEVER bundled into client JavaScript.

## 2. Threat Modeling & Countermeasures

| Threat Vector | Mitigation Strategy |
|---|---|
| Unauthorized space access by third party | Trigger-based max 2 member ceiling on `space_members`, single-use expiring invitation codes. |
| Insecure direct object reference (IDOR) on messages/media | RLS function `is_member_of_space(space_id)` validated on every SELECT/INSERT/UPDATE/DELETE. |
| Malicious file upload / MIME spoofing | Server-side MIME validation, 50MB file size ceiling, private bucket storage. |
| WebRTC call interception | LiveKit SFU with authenticated JWT room grants and ephemeral single-use tokens. |
| Stolen session / token replay | JWT expiration with automatic refresh rotation and device revocation table. |

## 3. Cryptographic and API Key Management
- Public keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_LIVEKIT_URL`.
- Protected server secrets: `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
