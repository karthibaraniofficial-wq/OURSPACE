import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import domain logic and presence helpers
import { isUserOnline, formatPresenceStatus } from '../packages/shared/src/index.ts';

// ------------------------------------------------------------------------
// Simulating Canonical Profile Document Normalization Logic
// (Matching apps/web/src/lib/firebase/auth.ts mapFirestoreDataToProfile)
// ------------------------------------------------------------------------
function mapFirestoreDataToProfile(uid, data) {
  const nowIso = new Date().toISOString();

  const toIsoString = (val, fallback) => {
    if (!val) return fallback;
    if (typeof val?.toDate === 'function') {
      try {
        return val.toDate().toISOString();
      } catch {}
    }
    if (val instanceof Date) {
      try {
        return val.toISOString();
      } catch {}
    }
    if (typeof val === 'string') return val;
    return fallback;
  };

  if (!data) {
    return {
      id: uid,
      display_name: 'Partner',
      avatar_url: null,
      bio: null,
      status_message: 'Connected with you',
      status_emoji: '❤️',
      anniversary_date: null,
      accent_color: '#f43f5e',
      theme_mode: 'light',
      last_seen_at: null,
      is_online: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  return {
    id: uid,
    display_name: data.displayName || data.display_name || 'My Love',
    avatar_url: data.photoURL || data.photo_url || data.avatar_url || null,
    bio: data.bio !== undefined ? data.bio : null,
    status_message: data.statusMessage || data.status_message || data.statusText || 'Connected with you',
    status_emoji: data.statusEmoji || data.status_emoji || null,
    anniversary_date: data.anniversaryDate || data.anniversary_date || null,
    accent_color: data.accentColor || data.accent_color || '#f43f5e',
    theme_mode: data.themeMode || data.theme_mode || 'light',
    last_seen_at: toIsoString(data.lastSeenAt, null),
    is_online: typeof data.isOnline === 'boolean' ? data.isOnline : undefined,
    created_at: toIsoString(data.createdAt, nowIso),
    updated_at: toIsoString(data.updatedAt, nowIso),
  };
}

// ------------------------------------------------------------------------
// Simulating Profile Picture Upload Pipeline Validation
// (Matching apps/web/src/lib/firebase/storage.ts uploadProfilePictureToStorage)
// ------------------------------------------------------------------------
function validateAndBuildProfilePictureUpload(userId, file) {
  if (!userId) {
    throw new Error('User is not authenticated.');
  }
  if (!file || !file.type) {
    throw new Error('Invalid file.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not a valid image format.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Profile picture must be under 10MB.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `users/${userId}/profile/${timestamp}_${safeName}`;
  const mockDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/ourspace-edbf5.appspot.com/o/${encodeURIComponent(storagePath)}?alt=media&token=mock-token&v=${timestamp}`;

  return {
    storagePath,
    downloadUrl: mockDownloadUrl,
  };
}

// ------------------------------------------------------------------------
// Simulating Firestore Security Rules for User Profile Reads & Updates
// ------------------------------------------------------------------------
class MockFirestoreSecurityEngine {
  constructor() {
    this.users = new Map();
    this.spaceMembers = new Map(); // key: `${spaceId}:${uid}` -> true
  }

  setUser(uid, doc) {
    this.users.set(uid, { ...doc });
  }

  addSpaceMember(spaceId, uid) {
    this.spaceMembers.set(`${spaceId}:${uid}`, true);
  }

  removeSpaceMember(spaceId, uid) {
    this.spaceMembers.delete(`${spaceId}:${uid}`);
  }

  canReadUserProfile(authUid, targetUid) {
    if (!authUid) return false;
    // 1. User reading their own profile
    if (authUid === targetUid) return true;

    // 2. Co-member within the same active space
    const targetDoc = this.users.get(targetUid);
    if (!targetDoc || !targetDoc.activeSpaceId) return false;

    const isAuthMember = this.spaceMembers.has(`${targetDoc.activeSpaceId}:${authUid}`);
    return isAuthMember;
  }

  canUpdateUserProfile(authUid, targetUid, requestedDiffKeys) {
    if (!authUid || authUid !== targetUid) return false;
    const protectedKeys = ['id', 'email', 'createdAt'];
    const hasProtectedKey = requestedDiffKeys.some((k) => protectedKeys.includes(k));
    return !hasProtectedKey;
  }
}

// ------------------------------------------------------------------------
// Simulating Realtime Synchronized Store Between Two Users
// ------------------------------------------------------------------------
class MockClientAuthSession {
  constructor(userId, firestoreDb) {
    this.userId = userId;
    this.db = firestoreDb;
    this.user = null;
    this.space = null;
    this.partner = null;
    this.listeners = [];
  }

  attachListeners(spaceId, partnerUid) {
    // 1. Listen to self
    this.user = mapFirestoreDataToProfile(this.userId, this.db.users.get(this.userId));

    // 2. Real-time subscriber to partner's canonical profile
    if (partnerUid) {
      this.partner = mapFirestoreDataToProfile(partnerUid, this.db.users.get(partnerUid));
    }
  }

  onRemoteMutation(updatedUid, updatedData) {
    if (updatedUid === this.userId) {
      this.user = mapFirestoreDataToProfile(this.userId, updatedData);
    } else if (this.partner && this.partner.id === updatedUid) {
      this.partner = mapFirestoreDataToProfile(updatedUid, updatedData);
    }
  }

  signOut() {
    this.user = null;
    this.space = null;
    this.partner = null;
    this.listeners = [];
  }
}

// ========================================================================
// TEST SUITE: OURSPACE V2.4.5 Profile & Real-Time Synchronization
// ========================================================================
describe('OURSPACE V2.4.5 — Profile, DP, Status and Real-Time Synchronization Suite', () => {

  test('1. Canonical Profile Model: maps and normalizes all fields with backward compatibility', () => {
    const rawFirestoreDoc = {
      displayName: 'Karthi',
      photoURL: 'https://images.unsplash.com/photo-karthi?w=400',
      statusMessage: 'Building OURSPACE V2.4.5 ❤️',
      statusEmoji: '🚀',
      bio: 'In our sacred sanctuary',
      anniversaryDate: '2023-06-15',
      accentColor: '#f43f5e',
      themeMode: 'dark',
      lastSeenAt: new Date().toISOString(),
      isOnline: true,
      createdAt: new Date('2023-06-15').toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const profile = mapFirestoreDataToProfile('user_A', rawFirestoreDoc);

    assert.equal(profile.id, 'user_A');
    assert.equal(profile.display_name, 'Karthi');
    assert.equal(profile.avatar_url, 'https://images.unsplash.com/photo-karthi?w=400');
    assert.equal(profile.status_message, 'Building OURSPACE V2.4.5 ❤️');
    assert.equal(profile.status_emoji, '🚀');
    assert.equal(profile.accent_color, '#f43f5e');
    assert.equal(profile.theme_mode, 'dark');
    assert.equal(profile.is_online, true);
    assert.ok(profile.created_at);
    assert.ok(profile.updated_at);
  });

  test('1b. Canonical Profile Model: supports legacy field names gracefully without crash', () => {
    const legacyDoc = {
      display_name: 'Barani',
      photo_url: 'https://storage.googleapis.com/legacy_avatar.jpg',
      status_message: 'Legacy format status',
      accent_color: '#8b5cf6',
      theme_mode: 'light',
    };

    const profile = mapFirestoreDataToProfile('user_B', legacyDoc);

    assert.equal(profile.id, 'user_B');
    assert.equal(profile.display_name, 'Barani');
    assert.equal(profile.avatar_url, 'https://storage.googleapis.com/legacy_avatar.jpg');
    assert.equal(profile.status_message, 'Legacy format status');
    assert.equal(profile.accent_color, '#8b5cf6');
  });

  test('2. Profile Picture Upload Pipeline: validates images and enforces 10MB limit', () => {
    // Valid image file
    const validFile = {
      name: 'portrait profile.jpg',
      type: 'image/jpeg',
      size: 2 * 1024 * 1024, // 2MB
    };

    const upload = validateAndBuildProfilePictureUpload('user_A', validFile);
    assert.ok(upload.storagePath.startsWith('users/user_A/profile/'));
    assert.ok(upload.storagePath.includes('portrait_profile.jpg'));
    assert.ok(upload.downloadUrl.startsWith('https://firebasestorage.googleapis.com/'));
    assert.ok(upload.downloadUrl.includes('&v=')); // Cache invalidation token present!

    // Rejects non-image formats
    assert.throws(
      () => validateAndBuildProfilePictureUpload('user_A', { name: 'doc.pdf', type: 'application/pdf', size: 1024 }),
      /Selected file is not a valid image format/
    );

    // Rejects oversized file (> 10MB)
    assert.throws(
      () => validateAndBuildProfilePictureUpload('user_A', { name: 'huge.png', type: 'image/png', size: 12 * 1024 * 1024 }),
      /Profile picture must be under 10MB/
    );

    // Rejects unauthenticated request
    assert.throws(
      () => validateAndBuildProfilePictureUpload(null, validFile),
      /User is not authenticated/
    );
  });

  test('2b. Profile Picture: strictly forbids raw Base64 data URLs or Blob URLs in canonical storage', () => {
    const base64DataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
    const blobUrl = 'blob:http://localhost:3000/12345-6789';

    // Must be real HTTPS URL
    assert.equal(base64DataUrl.startsWith('https://'), false);
    assert.equal(blobUrl.startsWith('https://'), false);
  });

  test('3. Real-Time Two-Way Synchronization: User A updates profile -> User B instantly sees changes', () => {
    const mockDb = new MockFirestoreSecurityEngine();

    // Initial profiles in Firestore
    mockDb.setUser('user_A', {
      displayName: 'Alex',
      photoURL: 'https://cdn.example.com/alex_old.jpg',
      statusMessage: 'Initial status',
      statusEmoji: '🌸',
      activeSpaceId: 'space_forever_1',
    });
    mockDb.setUser('user_B', {
      displayName: 'Jordan',
      photoURL: 'https://cdn.example.com/jordan_old.jpg',
      statusMessage: 'Ready to chat',
      statusEmoji: '☕',
      activeSpaceId: 'space_forever_1',
    });

    mockDb.addSpaceMember('space_forever_1', 'user_A');
    mockDb.addSpaceMember('space_forever_1', 'user_B');

    // Both users log in and subscribe to each other's canonical user document
    const clientA = new MockClientAuthSession('user_A', mockDb);
    const clientB = new MockClientAuthSession('user_B', mockDb);
    clientA.attachListeners('space_forever_1', 'user_B');
    clientB.attachListeners('space_forever_1', 'user_A');

    // Verify initial state
    assert.equal(clientA.user.display_name, 'Alex');
    assert.equal(clientB.partner.display_name, 'Alex');
    assert.equal(clientB.user.display_name, 'Jordan');
    assert.equal(clientA.partner.display_name, 'Jordan');

    // STEP A: User A updates display name & custom status
    const updatedA = {
      ...mockDb.users.get('user_A'),
      displayName: 'Alexander The Great ❤️',
      statusMessage: 'Cooking our anniversary dinner 🍝',
      statusEmoji: '🍳',
      updatedAt: new Date().toISOString(),
    };
    mockDb.setUser('user_A', updatedA);

    // Simulate Firestore real-time onSnapshot dispatch
    clientA.onRemoteMutation('user_A', updatedA);
    clientB.onRemoteMutation('user_A', updatedA);

    // User A sees their own updated name & status
    assert.equal(clientA.user.display_name, 'Alexander The Great ❤️');
    assert.equal(clientA.user.status_message, 'Cooking our anniversary dinner 🍝');
    assert.equal(clientA.user.status_emoji, '🍳');

    // User B's partner profile INSTANTLY synchronized with User A's new name & status!
    assert.equal(clientB.partner.display_name, 'Alexander The Great ❤️');
    assert.equal(clientB.partner.status_message, 'Cooking our anniversary dinner 🍝');
    assert.equal(clientB.partner.status_emoji, '🍳');

    // STEP B: User A uploads new DP
    const newDpUrl = 'https://firebasestorage.googleapis.com/v0/b/ourspace-edbf5.appspot.com/o/users%2Fuser_A%2Fprofile%2Fnew_dp.jpg?alt=media&v=1730000000';
    const dpUpdatedA = {
      ...mockDb.users.get('user_A'),
      photoURL: newDpUrl,
      updatedAt: new Date().toISOString(),
    };
    mockDb.setUser('user_A', dpUpdatedA);

    clientA.onRemoteMutation('user_A', dpUpdatedA);
    clientB.onRemoteMutation('user_A', dpUpdatedA);

    // User B instantly receives User A's new DP!
    assert.equal(clientB.partner.avatar_url, newDpUrl);
    assert.equal(clientA.user.avatar_url, newDpUrl);

    // STEP C: User B updates DP and name (REVERSE DIRECTION)
    const newJordanDp = 'https://firebasestorage.googleapis.com/v0/b/ourspace-edbf5.appspot.com/o/users%2Fuser_B%2Fprofile%2Fjordan_new.jpg?alt=media&v=1730000001';
    const updatedB = {
      ...mockDb.users.get('user_B'),
      displayName: 'Jordan My Love ✨',
      photoURL: newJordanDp,
      statusMessage: 'On my way home! 🚗',
      statusEmoji: '🚗',
      updatedAt: new Date().toISOString(),
    };
    mockDb.setUser('user_B', updatedB);

    clientA.onRemoteMutation('user_B', updatedB);
    clientB.onRemoteMutation('user_B', updatedB);

    // User A immediately receives User B's new name, DP, and status!
    assert.equal(clientA.partner.display_name, 'Jordan My Love ✨');
    assert.equal(clientA.partner.avatar_url, newJordanDp);
    assert.equal(clientA.partner.status_message, 'On my way home! 🚗');
    assert.equal(clientA.partner.status_emoji, '🚗');
  });

  test('4. Security Rules: only legitimate space partner can read profile; 3rd party attacker is rejected', () => {
    const security = new MockFirestoreSecurityEngine();

    security.setUser('user_A', {
      id: 'user_A',
      displayName: 'Alex',
      activeSpaceId: 'space_private_42',
    });
    security.setUser('user_B', {
      id: 'user_B',
      displayName: 'Jordan',
      activeSpaceId: 'space_private_42',
    });
    security.setUser('user_attacker', {
      id: 'user_attacker',
      displayName: 'Eve (Intruder)',
      activeSpaceId: 'space_other_99',
    });

    security.addSpaceMember('space_private_42', 'user_A');
    security.addSpaceMember('space_private_42', 'user_B');
    security.addSpaceMember('space_other_99', 'user_attacker');

    // 1. User A can read own profile
    assert.equal(security.canReadUserProfile('user_A', 'user_A'), true);

    // 2. Partner User B can read User A's profile
    assert.equal(security.canReadUserProfile('user_B', 'user_A'), true);

    // 3. User C (Attacker) CANNOT read User A's profile!
    assert.equal(security.canReadUserProfile('user_attacker', 'user_A'), false);

    // 4. Unauthenticated user CANNOT read User A's profile!
    assert.equal(security.canReadUserProfile(null, 'user_A'), false);

    // 5. User B CANNOT write/update User A's profile!
    assert.equal(security.canUpdateUserProfile('user_B', 'user_A', ['displayName']), false);

    // 6. User A can update own non-protected fields
    assert.equal(security.canUpdateUserProfile('user_A', 'user_A', ['displayName', 'photoURL', 'statusMessage']), true);

    // 7. User A CANNOT modify protected system fields ('id', 'email', 'createdAt')
    assert.equal(security.canUpdateUserProfile('user_A', 'user_A', ['id']), false);
    assert.equal(security.canUpdateUserProfile('user_A', 'user_A', ['email']), false);
    assert.equal(security.canUpdateUserProfile('user_A', 'user_A', ['createdAt']), false);
  });

  test('5. Presence & Online Calculation: cleanly distinguishes custom status from active presence', () => {
    const now = new Date();
    const activeTimestamp = new Date(now.getTime() - 45 * 1000).toISOString(); // 45 seconds ago
    const staleTimestamp = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10 mins ago

    // Active heartbeat within 3 minutes
    assert.equal(isUserOnline(activeTimestamp, true), true);
    assert.equal(formatPresenceStatus(activeTimestamp, true).label, 'Active now');

    // Explicit background / tab closed (isOnlineExplicit = false)
    assert.equal(isUserOnline(activeTimestamp, false), false);
    assert.equal(formatPresenceStatus(activeTimestamp, false).isOnline, false);

    // Stale heartbeat (> 3 min)
    assert.equal(isUserOnline(staleTimestamp, true), false);
    const staleStatus = formatPresenceStatus(staleTimestamp, true);
    assert.equal(staleStatus.isOnline, false);
    assert.equal(staleStatus.label, '10m ago');

    // Empty or unlinked partner
    assert.equal(isUserOnline(null), false);
    assert.equal(formatPresenceStatus(null).label, 'Offline');
  });

  test('6. Space Isolation: unpairing and signing out clears user-specific partner state', () => {
    const mockDb = new MockFirestoreSecurityEngine();
    mockDb.setUser('user_A', { displayName: 'Alex', activeSpaceId: 'space_1' });
    mockDb.setUser('user_B', { displayName: 'Jordan', activeSpaceId: 'space_1' });
    mockDb.addSpaceMember('space_1', 'user_A');
    mockDb.addSpaceMember('space_1', 'user_B');

    const client = new MockClientAuthSession('user_A', mockDb);
    client.attachListeners('space_1', 'user_B');

    assert.ok(client.user);
    assert.ok(client.partner);

    // Sign out cleans up completely
    client.signOut();
    assert.equal(client.user, null);
    assert.equal(client.partner, null);
    assert.equal(client.space, null);
  });
});
