# OURSPACE — Cloud Firestore NoSQL Data Architecture

## 1. Schema Philosophy
Cloud Firestore is a hierarchical document-oriented database. Unlike relational PostgreSQL, we design for:
1. **Tenant Isolation**: All shared couple resources reside under `privateSpaces/{spaceId}` or link strictly to `spaceId`.
2. **Subcollections for Scale**: Messages, attachments, and reminders use subcollections to allow unlimited growth with efficient pagination (`limit`, `startAfter`).
3. **Atomic Operations**: Space membership updates and invitation redemptions use Firestore Transactions (`runTransaction`).
4. **Denormalization for Fast Read**: Sender avatar, display name, and message attachment metadata are stored alongside messages to avoid N+1 lookups.

---

## 2. Collection Hierarchy

```text
users/
 └── {uid}                              # User profile & global preferences
      ├── displayName: string
      ├── email: string
      ├── photoURL: string | null
      ├── bio: string | null
      ├── statusMessage: string
      ├── anniversaryDate: string | null
      ├── accentColor: string           # hex e.g. "#f43f5e"
      ├── themeMode: "light" | "dark" | "system"
      ├── activeSpaceId: string | null
      ├── createdAt: Timestamp
      ├── updatedAt: Timestamp
      │
      ├── devices/
      │    └── {deviceId}               # Multi-device FCM tokens
      │         ├── pushToken: string
      │         ├── deviceType: "web" | "android" | "ios"
      │         ├── deviceName: string
      │         └── lastSeenAt: Timestamp
      │
      └── settings/
           └── notifications            # Notification sound & DND preferences
                ├── messagesSound: string
                ├── callsRingtone: string
                ├── remindersSound: string
                ├── customSoundUrl: string | null
                ├── dndEnabled: boolean
                ├── dndStart: string
                ├── dndEnd: string
                └── previewPrivacy: boolean

invitations/
 └── {code}                             # 8-character pairing code e.g. "LOVE-ABCD"
      ├── spaceId: string
      ├── createdBy: string (uid)
      ├── expiresAt: Timestamp         # 48 hours validity
      ├── acceptedAt: Timestamp | null
      ├── acceptedBy: string (uid) | null
      └── status: "pending" | "accepted" | "expired" | "revoked"

privateSpaces/
 └── {spaceId}                          # Private couple space tenant root
      ├── name: string
      ├── createdBy: string (uid)
      ├── coupleStartedAt: string | null # "YYYY-MM-DD"
      ├── themeAccent: string
      ├── wallpaperUrl: string | null
      ├── memberCount: number           # STRICTLY <= 2
      ├── createdAt: Timestamp
      ├── updatedAt: Timestamp
      │
      ├── members/
      │    └── {uid}                    # Space membership record (max 2 per space)
      │         ├── role: "creator" | "partner"
      │         ├── joinedAt: Timestamp
      │         └── displayName: string
      │
      ├── conversations/
      │    └── {conversationId}         # Default: "main"
      │         ├── title: string
      │         ├── lastMessageSnippet: string | null
      │         ├── lastMessageAt: Timestamp | null
      │         │
      │         └── messages/
      │              └── {messageId}    # Individual chat message
      │                   ├── senderId: string (uid)
      │                   ├── content: string | null
      │                   ├── type: "text" | "image" | "video" | "document" | "audio" | "gif"
      │                   ├── replyToId: string | null
      │                   ├── replyToSnippet: string | null
      │                   ├── isEdited: boolean
      │                   ├── editedAt: Timestamp | null
      │                   ├── deletedForAll: boolean
      │                   ├── pinned: boolean
      │                   ├── attachments: Array<{
      │                   │     id: string,
      │                   │     fileName: string,
      │                   │     fileSize: number,
      │                   │     fileType: string,
      │                   │     mediaCategory: string,
      │                   │     storagePath: string,
      │                   │     downloadUrl: string
      │                   │   }>
      │                   ├── reactions: Array<{
      │                   │     userId: string,
      │                   │     emoji: string
      │                   │   }>
      │                   ├── readBy: Array<string>
      │                   └── createdAt: Timestamp
      │
      ├── reminders/
      │    └── {reminderId}             # Shared & personal reminders
      │         ├── title: string
      │         ├── description: string | null
      │         ├── dueDate: Timestamp
      │         ├── recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly"
      │         ├── priority: "low" | "medium" | "high" | "urgent"
      │         ├── isCompleted: boolean
      │         ├── isShared: boolean
      │         ├── assignedTo: string | null
      │         ├── createdBy: string (uid)
      │         └── createdAt: Timestamp
      │
      ├── events/
      │    └── {eventId}                # Milestones, countdowns, calendar events
      │         ├── title: string
      │         ├── eventDate: string   # "YYYY-MM-DD"
      │         ├── eventType: "anniversary" | "birthday" | "trip" | "date_night" | "milestone"
      │         ├── notes: string | null
      │         ├── createdBy: string (uid)
      │         └── createdAt: Timestamp
      │
      ├── mediaFiles/
      │    └── {fileId}                 # Media gallery index
      │         ├── title: string
      │         ├── category: "image" | "video" | "document" | "audio"
      │         ├── storagePath: string
      │         ├── downloadUrl: string
      │         ├── fileSize: number
      │         ├── isFavourite: boolean
      │         ├── uploadedBy: string (uid)
      │         └── createdAt: Timestamp
      │
      └── callSessions/
           └── {callId}                 # WebRTC call signaling & history
                ├── callerId: string (uid)
                ├── receiverId: string (uid)
                ├── callType: "audio" | "video"
                ├── status: "ringing" | "active" | "declined" | "missed" | "ended"
                ├── roomName: string
                ├── startedAt: Timestamp
                ├── answeredAt: Timestamp | null
                ├── endedAt: Timestamp | null
                └── durationSeconds: number
```

---

## 3. Realtime Presence & Typing (Realtime Database)

To minimize Firestore document write quotas for fast typing updates:
```text
presence/{spaceId}/{uid}/
 ├── isTyping: boolean
 ├── isOnline: boolean
 └── lastSeen: ServerValue.TIMESTAMP
```
Configured with `.onDisconnect()` to reset status automatically upon network interruption.
