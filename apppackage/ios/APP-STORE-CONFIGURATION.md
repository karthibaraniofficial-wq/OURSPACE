# OURSPACE iOS — App Store Connect Configuration & Compliance

**App Name:** OURSPACE — Private Couple Sanctuary  
**Subtitle:** Two Hearts. One Private Digital World.  
**Primary Category:** Lifestyle  
**Secondary Category:** Social Networking  
**Content Rating:** 12+ (Infrequent / Mild Romance, Private Couple Communication)  
**Bundle ID:** `app.ourspace.client`  
**SKU:** `OURSPACE-IOS-230`  

---

## 1. App Store Connect Metadata

### Promotional Text
> Experience an intimate digital sanctuary built exclusively for two. End-to-end encrypted notes, real-time photo sharing, audio/video calling, and couple memory albums.

### Description
> OURSPACE is a private, distraction-free digital companion designed exclusively for two partners.
>
> **Core Features:**
> - **Private Real-Time Messaging**: Fast, romantic text messaging with customized reactions and inline photo previews.
> - **Instant In-App Camera & Gallery Sharing**: Capture and share authentic photographs with your partner directly inside chat.
> - **Collaborative Memory Albums**: Cherish your relationship milestones, first dates, and travel memories with slideshows and chronological timelines.
> - **OUR LOCKER (Client-Side Encrypted Vault)**: 256-bit AES-GCM zero-knowledge encryption for private notes, letters, travel documents, and emergency contacts.
> - **WebRTC Audio & Video Calling**: High-definition, low-latency calls powered by LiveKit SFU.
> - **Couple Planning Hub**: Shared bucket lists, date ideas, travel checklists, and countdown milestones.
>
> Zero social media algorithms. Zero third-party advertisements. Guaranteed two-person private boundary.

---

## 2. App Privacy & Data Declarations (Apple Privacy Nutrition Label)

Under App Store Connect **App Privacy**:

| Data Type | Collected? | Linked to User? | Used for Tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info** (Email / Phone) | Yes | Yes | No | User Account Authentication |
| **Photos & Videos** | Yes (Uploaded to Private Space) | Yes | No | App Functionality (Memory Albums & Chat) |
| **Audio Data** (Voice notes, Calls) | Yes (Transient / Encrypted) | Yes | No | App Functionality (Voice Messaging & Calling) |
| **User Content** (Messages, Notes) | Yes (Encrypted) | Yes | No | App Functionality (Chat & Locker) |
| **Device Identifiers** (FCM Push Token)| Yes | Yes | No | Remote Call & Message Notifications |
| **Diagnostics / Crash Data** | Minimal | No | No | App Performance & Bug Resolution |

---

## 3. Cryptography & Export Compliance (EAR)

OURSPACE employs standard client-side encryption via WebCrypto / SubtleCrypto APIs (PBKDF2 SHA-256 + AES-GCM 256-bit). Under U.S. Export Administration Regulations (EAR), standard data encryption qualifies for exemption:
- **Export Compliance Question**: *Does your app use encryption?* → **Yes**.
- **Exemption Question**: *Does your app qualify for one of the exemptions under Category 5, Part 2?* → **Yes** (Standard end-user data security and communication encryption; no custom proprietary cipher implementation).
- No formal French ANSSI or BIS CCATS filing is required for standard lifestyle communication applications under this classification.
