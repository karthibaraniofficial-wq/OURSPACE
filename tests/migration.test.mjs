import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { transformRelationalToFirestore } from '../scripts/migrate-supabase-to-firebase.mjs';

describe('OURSPACE Relational to Firestore Migration Suite', () => {
  const mockPostgresData = {
    profiles: [
      { id: 'usr-1', display_name: 'Alex', email: 'alex@ourspace.app', accent_color: '#f43f5e' },
      { id: 'usr-2', display_name: 'Jordan', email: 'jordan@ourspace.app', accent_color: '#8b5cf6' },
      { id: 'usr-3', display_name: 'Intruder', email: 'intruder@ourspace.app' },
    ],
    private_spaces: [
      { id: 'sp-1', name: 'Our Sanctuary', created_by: 'usr-1', couple_started_at: '2023-06-15' },
    ],
    space_members: [
      { space_id: 'sp-1', user_id: 'usr-1', role: 'creator' },
      { space_id: 'sp-1', user_id: 'usr-2', role: 'partner' },
      { space_id: 'sp-1', user_id: 'usr-3', role: 'partner' }, // 3rd user attempt!
    ],
    invitations: [
      { code: 'LOVE-TEST', space_id: 'sp-1', created_by: 'usr-1', status: 'accepted' },
    ],
    messages: [
      { id: 'm-1', space_id: 'sp-1', sender_id: 'usr-1', content: 'Hello sweetheart', type: 'text' },
    ],
    message_attachments: [
      { id: 'att-1', message_id: 'm-1', file_name: 'photo.jpg', file_path: 'mock/photo.jpg', file_size: 1024, media_category: 'image' },
    ],
    message_reactions: [
      { message_id: 'm-1', user_id: 'usr-2', emoji: '❤️' },
    ],
    reminders: [
      { id: 'r-1', space_id: 'sp-1', title: 'Date Night', due_date: '2026-11-05', priority: 'high', assigned_to: null },
    ],
    shared_events: [
      { id: 'e-1', space_id: 'sp-1', title: 'Anniversary', event_date: '2027-06-15', event_type: 'anniversary' },
    ],
  };

  test('transforms users and spaces with correct attributes', () => {
    const { firestoreDb, report } = transformRelationalToFirestore(mockPostgresData);

    assert.equal(report.migratedUsers, 3);
    assert.equal(report.migratedSpaces, 1);
    assert.equal(firestoreDb.users['usr-1'].displayName, 'Alex');
    assert.equal(firestoreDb.privateSpaces['sp-1'].name, 'Our Sanctuary');
  });

  test('strictly rejects 3rd member in space_members preserving 2-person invariant', () => {
    const { firestoreDb, report } = transformRelationalToFirestore(mockPostgresData);

    const space = firestoreDb.privateSpaces['sp-1'];
    assert.equal(space.memberCount, 2);
    assert.ok(space.members['usr-1']);
    assert.ok(space.members['usr-2']);
    assert.equal(space.members['usr-3'], undefined); // Rejected!
    assert.equal(report.warnings.length, 1);
  });

  test('correctly embeds attachments and reactions within parent message', () => {
    const { firestoreDb } = transformRelationalToFirestore(mockPostgresData);

    const msg = firestoreDb.privateSpaces['sp-1'].conversations.main.messages['m-1'];
    assert.ok(msg);
    assert.equal(msg.content, 'Hello sweetheart');
    assert.equal(msg.attachments.length, 1);
    assert.equal(msg.attachments[0].fileName, 'photo.jpg');
    assert.equal(msg.reactions.length, 1);
    assert.equal(msg.reactions[0].emoji, '❤️');
  });

  test('transforms reminders and events', () => {
    const { firestoreDb, report } = transformRelationalToFirestore(mockPostgresData);

    assert.equal(report.migratedReminders, 1);
    assert.equal(report.migratedEvents, 1);
    const reminder = firestoreDb.privateSpaces['sp-1'].reminders['r-1'];
    assert.equal(reminder.title, 'Date Night');
    assert.equal(reminder.isShared, true);
  });
});
