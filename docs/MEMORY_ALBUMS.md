# OURSPACE V2.3 — MEMORY ALBUMS SPECIFICATION

## 1. Overview
The **Memory Albums** module transforms the previous static photo gallery into a comprehensive photo and video memory curation system for two people. It allows couples to organize their shared journey into dedicated, themed collections with personal vs. shared privacy controls, slideshow playback, chronological timeline filters, and resilient media persistence.

---

## 2. Album Creation & Categories
Users can create unlimited albums within their couple space.
Each album contains:
- **Title**: Custom descriptive title (e.g., "Paris Summer 2026", "First Coffee Date").
- **Description / Love Story**: Extended context capturing the emotion and setting.
- **Cover Photograph**: Primary visual representation with elegant rounded cover display.
- **Category**: Selected from curated defaults or custom user-defined categories.
  - *Our Beginning*
  - *First Meeting*
  - *First Date*
  - *Special Days*
  - *Birthdays*
  - *Anniversaries*
  - *Trips*
  - *Festivals*
  - *Celebrations*
  - *Everyday Moments*
  - *Future Memories*
  - *Custom Albums*
- **Album Date**: Date identifier for chronological indexing and timeline presentation.
- **Visibility**:
  - `shared`: Visible and editable by both authenticated partners in the space.
  - `personal`: Visible exclusively to the album creator (for surprise gifts, personal reflections).

---

## 3. Album Content & Media Operations
- **Supported Formats**: JPEG, PNG, WebP, GIF, MP4, WebM, and document attachments.
- **Captions & Metadata**: Each media item retains its individual date, caption, uploader ID, and dimensions.
- **Slideshow Playback**: Integrated full-screen presentation mode featuring auto-advancing slides (4-second interval), pause/play toggle, keyboard arrow navigation, and memory captions.
- **Album Editing & Item Management**:
  - Add items via multi-select file dialogs.
  - Delete individual items without affecting other collections.
  - Favourite toggle for prioritizing cherished memories.

---

## 4. Cloud Firestore & Storage Architecture
### Document Schema
```
privateSpaces/{spaceId}/albums/{albumId}
  ├── title: string
  ├── description: string | null
  ├── category: string
  ├── albumDate: string (YYYY-MM-DD)
  ├── visibility: 'personal' | 'shared'
  ├── coverUrl: string | null
  ├── createdBy: string (uid)
  ├── isFavourite: boolean
  ├── memoryCount: number
  ├── createdAt: timestamp
  └── updatedAt: timestamp
```

### Subcollection Schema
```
privateSpaces/{spaceId}/albums/{albumId}/items/{itemId}
  ├── mediaUrl: string (Base64 data URL or Storage URI)
  ├── mediaType: 'image' | 'video'
  ├── caption: string | null
  ├── uploadedBy: string (uid)
  ├── originalDate: string (ISO-8601)
  ├── isFavourite: boolean
  ├── sortOrder: number
  └── createdAt: timestamp
```

---

## 5. Security & Access Control
Under `firestore.rules`, access is governed by:
- Strict space membership verification (`isMemberOfSpace(spaceId)`).
- For `personal` albums, client and query-level authorization filters ensure only the owner can read or mutate the album.
- All media uploads are sanitized to prevent script execution or cross-site contamination.
