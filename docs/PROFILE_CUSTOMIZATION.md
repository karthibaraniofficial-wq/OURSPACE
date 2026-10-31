# OURSPACE V2.3 — CUSTOM USER IDENTITY & PROFILE SPECIFICATION

## 1. Overview
In OURSPACE V2.3, each partner maintains their own distinct digital identity within their private two-person sanctuary. Profile personalization synchronizes in real time across all authenticated web, desktop, and mobile devices.

---

## 2. Personal Identity Features
Each user independently controls:
- **Display Name**: Custom first name or loving pet name (no fake defaults).
- **Profile Picture**:
  - Upload personal photography via file picker.
  - Image preview with cropping, zoom, and orientation handling.
  - Option to remove or clear photo.
- **Illustrated Romantic Avatars**: Curated collection of artistic vector avatars for users who prefer stylized illustrations over personal photos.
- **Custom Status Message**:
  - Live couple status (e.g., *"Thinking of you 🌸"*, *"At work, text me later! 💻"*, *"On my way to you 🚗"*).
  - Quick-selection status suggestions for instant updates.
- **Short Biography / Love Note**: Dedicated field for shared quotes, personal reflections, or relationship mottos.
- **Online Visibility & Presence**: Operator control over active status indicators.
- **Profile Accent Palette**: Selection across tailored romantic themes (Blush Rose, Lavender Mist, Sunset Amber, Emerald Mint, Velvet Midnight).

---

## 3. Real-Time Cross-Device Synchronization
- Changes to profile attributes write to Cloud Firestore under `users/{uid}`.
- The partner's device observes updates via real-time `onSnapshot` listeners.
- The navigation sidebar, conversation headers, WebRTC call screens, and partner connection cards immediately reflect updated names and avatar images without requiring a page reload.

---

## 4. Security & Permissions Standard
- **Strict Self-Ownership**: `firestore.rules` enforces `allow update: if request.auth.uid == uid;`.
- A user can never overwrite, replace, or tamper with their partner's profile name or avatar image.
- Image uploads are sanitized and validated against allowed MIME types and size ceilings.
