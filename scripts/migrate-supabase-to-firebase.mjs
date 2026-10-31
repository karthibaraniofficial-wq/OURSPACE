/**
 * ==============================================================================
 * OURSPACE: Supabase PostgreSQL to Google Cloud Firestore Migration Engine
 * ==============================================================================
 *
 * This script transforms relational PostgreSQL tables from Supabase into
 * hierarchical Cloud Firestore documents and subcollections while preserving:
 *  - User UIDs & Display Profiles
 *  - Space Boundaries & Atomic Membership (Max 2 Members)
 *  - Messages, Attachments, Reactions & Chronological Ordering
 *  - Media Vault records & Storage paths
 *  - Reminders, Recurrence, Priorities & Completion states
 *  - Milestones, Events & Countdowns
 */

import fs from 'node:fs';
import path from 'node:path';

export function transformRelationalToFirestore(supabaseExportData) {
  const {
    profiles = [],
    private_spaces = [],
    space_members = [],
    invitations = [],
    messages = [],
    message_attachments = [],
    message_reactions = [],
    reminders = [],
    shared_events = [],
    media_files = [],
  } = supabaseExportData;

  const firestoreDb = {
    users: {},
    invitations: {},
    privateSpaces: {},
  };

  const report = {
    migratedUsers: 0,
    migratedSpaces: 0,
    migratedMessages: 0,
    migratedReminders: 0,
    migratedEvents: 0,
    migratedMedia: 0,
    warnings: [],
  };

  // 1. Transform Users
  for (const prof of profiles) {
    firestoreDb.users[prof.id] = {
      id: prof.id,
      displayName: prof.display_name || 'Partner',
      email: prof.email || null,
      photoURL: prof.avatar_url || null,
      bio: prof.bio || null,
      statusMessage: prof.status_message || 'Online',
      anniversaryDate: prof.anniversary_date || null,
      accentColor: prof.accent_color || '#f43f5e',
      themeMode: prof.theme_mode || 'light',
      createdAt: prof.created_at || new Date().toISOString(),
      updatedAt: prof.updated_at || new Date().toISOString(),
      activeSpaceId: null, // linked below
    };
    report.migratedUsers++;
  }

  // 2. Transform Spaces
  for (const space of private_spaces) {
    const spaceId = space.id;
    firestoreDb.privateSpaces[spaceId] = {
      id: spaceId,
      name: space.name || 'Our Space',
      createdBy: space.created_by,
      coupleStartedAt: space.couple_started_at || null,
      themeAccent: space.theme_accent || '#f43f5e',
      wallpaperUrl: space.wallpaper_url || null,
      memberCount: 0,
      createdAt: space.created_at || new Date().toISOString(),
      updatedAt: space.updated_at || new Date().toISOString(),
      members: {},
      conversations: {
        main: {
          title: 'Main Chat',
          messages: {},
        },
      },
      reminders: {},
      events: {},
      mediaFiles: {},
      callSessions: {},
    };
    report.migratedSpaces++;
  }

  // 3. Transform Members & Enforce Strict 2-Member Ceiling
  for (const mem of space_members) {
    const space = firestoreDb.privateSpaces[mem.space_id];
    if (!space) {
      report.warnings.push(`Member ${mem.user_id} belongs to missing space ${mem.space_id}`);
      continue;
    }

    const currentCount = Object.keys(space.members).length;
    if (currentCount >= 2) {
      report.warnings.push(`Space ${mem.space_id} exceeds 2 members! Skipping member ${mem.user_id}`);
      continue;
    }

    space.members[mem.user_id] = {
      userId: mem.user_id,
      role: mem.role || 'partner',
      joinedAt: mem.joined_at || new Date().toISOString(),
    };
    space.memberCount = Object.keys(space.members).length;

    // Link user activeSpaceId
    if (firestoreDb.users[mem.user_id]) {
      firestoreDb.users[mem.user_id].activeSpaceId = mem.space_id;
    }
  }

  // 4. Transform Invitations
  for (const inv of invitations) {
    firestoreDb.invitations[inv.code] = {
      code: inv.code,
      spaceId: inv.space_id,
      createdBy: inv.created_by,
      expiresAt: inv.expires_at,
      acceptedAt: inv.accepted_at || null,
      acceptedBy: inv.accepted_by || null,
      status: inv.status || 'pending',
      createdAt: inv.created_at || new Date().toISOString(),
    };
  }

  // 5. Transform Messages & Attachments
  const attachmentsByMsg = {};
  for (const att of message_attachments) {
    if (!attachmentsByMsg[att.message_id]) attachmentsByMsg[att.message_id] = [];
    attachmentsByMsg[att.message_id].push({
      id: att.id,
      fileName: att.file_name,
      fileSize: att.file_size,
      fileType: att.file_type,
      mediaCategory: att.media_category,
      storagePath: att.file_path,
      downloadUrl: att.file_path,
    });
  }

  const reactionsByMsg = {};
  for (const rx of message_reactions) {
    if (!reactionsByMsg[rx.message_id]) reactionsByMsg[rx.message_id] = [];
    reactionsByMsg[rx.message_id].push({
      userId: rx.user_id,
      emoji: rx.emoji,
    });
  }

  for (const msg of messages) {
    const space = firestoreDb.privateSpaces[msg.space_id];
    if (!space) continue;

    space.conversations.main.messages[msg.id] = {
      id: msg.id,
      senderId: msg.sender_id,
      content: msg.content,
      type: msg.type || 'text',
      replyToId: msg.reply_to_id || null,
      isEdited: msg.is_edited || false,
      editedAt: msg.edited_at || null,
      deletedForAll: msg.deleted_for_all || false,
      pinned: msg.pinned || false,
      attachments: attachmentsByMsg[msg.id] || [],
      reactions: reactionsByMsg[msg.id] || [],
      readBy: [],
      createdAt: msg.created_at || new Date().toISOString(),
    };
    report.migratedMessages++;
  }

  // 6. Transform Reminders
  for (const rem of reminders) {
    const space = firestoreDb.privateSpaces[rem.space_id];
    if (!space) continue;

    space.reminders[rem.id] = {
      id: rem.id,
      title: rem.title,
      description: rem.description || null,
      dueDate: rem.due_date,
      recurrence: rem.recurrence || 'none',
      priority: rem.priority || 'medium',
      isCompleted: rem.is_completed || false,
      isShared: rem.assigned_to === null,
      assignedTo: rem.assigned_to || null,
      createdBy: rem.created_by,
      createdAt: rem.created_at || new Date().toISOString(),
    };
    report.migratedReminders++;
  }

  // 7. Transform Shared Events
  for (const evt of shared_events) {
    const space = firestoreDb.privateSpaces[evt.space_id];
    if (!space) continue;

    space.events[evt.id] = {
      id: evt.id,
      title: evt.title,
      eventDate: evt.event_date,
      eventType: evt.event_type || 'custom',
      notes: evt.notes || null,
      createdBy: evt.created_by,
      createdAt: evt.created_at || new Date().toISOString(),
    };
    report.migratedEvents++;
  }

  // 8. Transform Media Files
  for (const mf of media_files) {
    const space = firestoreDb.privateSpaces[mf.space_id];
    if (!space) continue;

    space.mediaFiles[mf.id] = {
      id: mf.id,
      title: mf.file_name,
      category: mf.category || 'image',
      storagePath: mf.file_path,
      downloadUrl: mf.file_path,
      fileSize: mf.file_size || 0,
      isFavourite: mf.is_favourite || false,
      uploadedBy: mf.uploaded_by,
      createdAt: mf.created_at || new Date().toISOString(),
    };
    report.migratedMedia++;
  }

  return { firestoreDb, report };
}

// CLI runner if invoked directly
if (process.argv[1] && process.argv[1].endsWith('migrate-supabase-to-firebase.mjs')) {
  console.log('OURSPACE Migration Engine ready. Use transformRelationalToFirestore() to process data.');
}
