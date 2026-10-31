# OURSPACE — System Specification

## 1. Feature Specifications

### 1.1 Authentication & Profile
- **Registration**: Email + password with password strength validation (min 8 chars, mixed case, numbers, special character).
- **Session Management**: JWT issued by Supabase Auth with refresh tokens, multi-device active session tracking (`user_devices` table).
- **Profile**: Display name, avatar URL, bio/status message, anniversary date, notification preferences, accent color theme preference.

### 1.2 Couple Pairing Engine
- **Space Generation**: User creates a space, generating a cryptographically secure 8-character invitation code, short link, and QR code (valid for 48 hours).
- **Pairing Process**: Partner inputs the 6-8 char code or scans QR code. Backend triggers atomic validation:
  1. Checks if space already has 2 members (fails if count >= 2).
  2. Verifies invitation is not expired and not revoked.
  3. Inserts partner into `space_members`, marks invitation as accepted, and binds the space to both users.
- **Unpairing**: Allows either partner to safely initiate unpairing with confirmation dialog and security cooldown.

### 1.3 Real-Time Messaging & Chat
- **Transport**: Supabase Realtime Postgres Changes & Broadcast channels (`realtime:space:{space_id}`).
- **Message Types**: Text, Media (image, video, document, audio memo), GIF, System event (anniversary reminder, call logged).
- **Features**:
  - Message editing with edit history timestamp.
  - Soft deletion ("Delete for me" vs "Delete for both").
  - Message replies with quote preview.
  - Reactions: 6 quick reactions (❤️, 😍, 😂, 🥺, 🎉, 💋) + full emoji picker.
  - Ephemeral typing indicators (`typing_states` via Realtime Broadcast).
  - Online presence & last-seen status with privacy toggle.
  - Read receipts (`read_at`, `delivered_at`).
  - Search messages by keyword, sender, and date.
  - Pinned messages list.

### 1.4 Media Sharing & Storage
- **Buckets**: Private Supabase Storage bucket `ourspace-media` with RLS allowing only members of the parent space to read/upload.
- **Signed URLs**: Temporary signed URLs generated for secure file access.
- **Supported Formats**:
  - Images: JPG, PNG, WEBP, GIF, HEIC (with client compression).
  - Videos: MP4, MOV, WEBM (in-app player with controls).
  - Documents: PDF, DOCX, XLSX, PPTX, TXT, ZIP.
- **Gallery & Albums**: Categorized gallery (Photos, Videos, Documents), favorites tagging, custom albums.

### 1.5 Real-Time Audio & Video Calling
- **Infrastructure**: WebRTC SFU powered by LiveKit (production-ready) with direct WebRTC peer-to-peer signaling fallback.
- **Signaling**: Supabase Realtime table `call_sessions` + broadcast channel for ring notification.
- **In-Call Controls**:
  - Microphone mute/unmute.
  - Camera toggle and device switching.
  - Call duration timer.
  - Full-screen mode & picture-in-picture.
  - Network quality monitor and automatic reconnect.
  - Missed call log and call history records.

### 1.6 Reminders & Shared Memories
- **Reminders**: Title, due date/time, category, recurrence (none, daily, weekly, monthly, yearly), priority, assigned to (User A, User B, or Both).
- **Shared Memories & Dates**:
  - Days Together counter calculation based on couple start date.
  - Countdown to upcoming anniversaries, birthdays, milestones.
  - Interactive calendar view with reminders and milestone markers.

### 1.7 Custom Notifications & Sound System
- **Sound System**: Built-in harmonic Web Audio API synthesizers for instant zero-dependency notification chimes (Soft Bell, Gentle Harp, Marimba, Modern Ping, Romantic Chime) + support for custom audio uploads.
- **Preferences**: Per-category toggles (Messages, Calls, Reminders, Memories), Do Not Disturb (DND) scheduled hours, privacy preview toggle.

### 1.8 Multi-Device Synchronization
- Changes to messages, receipts, reminders, settings, and calls reflect simultaneously across Web, Desktop, and Mobile clients through persistent Supabase Realtime subscriptions.
