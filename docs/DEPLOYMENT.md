# OURSPACE — Production Deployment Guide

## 1. Web Application Deployment (Vercel)
1. Push repository to GitHub.
2. In Vercel, import the project and set Root Directory to `apps/web`.
3. Configure Environment Variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `NEXT_PUBLIC_GIPHY_API_KEY`
4. Deploy with Framework Preset: Next.js.

## 2. Supabase Backend Setup
1. Create a Supabase Project at [supabase.com](https://supabase.com).
2. Run database migrations in order:
   - `supabase/migrations/20261031_001_initial_schema.sql`
   - `supabase/migrations/20261031_002_rls_policies.sql`
   - `supabase/migrations/20261031_003_storage_buckets.sql`
3. Enable Realtime on tables:
   - Go to Database -> Replication in Supabase Dashboard.
   - Toggle source on `messages`, `message_reactions`, `message_receipts`, `typing_states`, `call_sessions`, `reminders`.
4. Storage Configuration:
   - Verify bucket `ourspace-media` exists as Private.

## 3. LiveKit Cloud Setup
1. Create a free project at [livekit.io](https://livekit.io).
2. Copy WebSocket URL, API Key, and API Secret into environment variables.
