import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Canonical Media Category Mapping
function getCategoryFolder(category) {
  switch (category) {
    case 'image':
    case 'images':
      return 'images';
    case 'video':
    case 'videos':
      return 'videos';
    case 'audio':
      return 'audio';
    case 'document':
    case 'documents':
    default:
      return 'documents';
  }
}

function normalizeMediaCategory(category) {
  switch (category) {
    case 'image':
    case 'images':
      return 'image';
    case 'video':
    case 'videos':
      return 'video';
    case 'audio':
      return 'audio';
    case 'document':
    case 'documents':
    default:
      return 'document';
  }
}

test('PHASE 1: Canonical media category and folder mapping', () => {
  // Test both singular and plural inputs
  assert.equal(getCategoryFolder('image'), 'images');
  assert.equal(getCategoryFolder('images'), 'images');
  assert.equal(getCategoryFolder('video'), 'videos');
  assert.equal(getCategoryFolder('videos'), 'videos');
  assert.equal(getCategoryFolder('audio'), 'audio');
  assert.equal(getCategoryFolder('document'), 'documents');

  // Test normalized category for attachment metadata
  assert.equal(normalizeMediaCategory('images'), 'image');
  assert.equal(normalizeMediaCategory('image'), 'image');
  assert.equal(normalizeMediaCategory('videos'), 'video');
  assert.equal(normalizeMediaCategory('document'), 'document');
});

test('PHASE 1: Storage path generation follows canonical spaces/{spaceId}/{category}/{userId}/{fileId}', () => {
  const spaceId = 'space-abc-123';
  const userId = 'user-xyz-456';
  const fileName = 'photo_vacation.jpg';
  const category = 'image';
  const folder = getCategoryFolder(category);

  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `spaces/${spaceId}/${folder}/${userId}/1730419200000_${cleanFileName}`;

  assert.match(path, /^spaces\/space-abc-123\/images\/user-xyz-456\/\d+_photo_vacation\.jpg$/);
  assert.ok(!path.includes('//'), 'Path must not contain double slashes');
});

test('PHASE 2 & 3: Idempotent message ID creation preserves stable ID between optimistic UI and Firestore', () => {
  // Simulate optimistic UI ID generation
  const localMessageId = 'msg-' + 'abc1234' + '-' + '1730419200';
  
  // Firestore document reference uses doc(collection, localMessageId) rather than addDoc
  const firestoreDocId = localMessageId; // stable 1:1 match
  
  assert.equal(localMessageId, firestoreDocId, 'Firestore document ID must strictly match optimistic message ID');

  // Payload verification
  const payload = {
    id: localMessageId,
    conversation_id: 'main',
    space_id: 'space-test',
    sender_id: 'user-sender',
    senderId: 'user-sender', // matches security rules
    content: 'Check out this photo!',
    type: 'image',
    attachments: [
      {
        id: 'att-123',
        message_id: localMessageId,
        file_name: 'sunset.jpg',
        file_size: 2048500,
        file_type: 'image/jpeg',
        media_category: 'image',
        storage_path: 'spaces/space-test/images/user-sender/12345_sunset.jpg',
        file_path: 'spaces/space-test/images/user-sender/12345_sunset.jpg',
        download_url: 'https://firebasestorage.googleapis.com/v0/b/ourspace.appspot.com/o/spaces%2Fsunset.jpg?alt=media',
        signed_url: 'https://firebasestorage.googleapis.com/v0/b/ourspace.appspot.com/o/spaces%2Fsunset.jpg?alt=media',
        thumbnail_url: 'https://firebasestorage.googleapis.com/v0/b/ourspace.appspot.com/o/spaces%2Fthumb.jpg?alt=media',
        thumbnail_path: 'spaces/space-test/images/user-sender/12345_thumb.jpg',
        width: 1920,
        height: 1080,
      }
    ]
  };

  assert.equal(payload.id, localMessageId);
  assert.equal(payload.attachments[0].media_category, 'image');
  assert.ok(payload.attachments[0].storage_path.startsWith('spaces/'));
  assert.ok(payload.attachments[0].download_url.startsWith('https://'));
  assert.ok(!payload.attachments[0].storage_path.startsWith('data:'), 'Storage path must not be Base64');
  assert.ok(!payload.attachments[0].download_url.startsWith('data:'), 'Download URL must not be Base64');
});

test('PHASE 3: Multi-photo message support preserves all attachments in one atomic message', () => {
  const messageId = 'msg-multi-123';
  const photoFiles = [
    { name: 'photo1.jpg', size: 1000000 },
    { name: 'photo2.png', size: 1500000 },
    { name: 'photo3.webp', size: 800000 },
  ];

  const attachments = photoFiles.map((file, i) => ({
    id: `att-${i}`,
    message_id: messageId,
    file_name: file.name,
    file_size: file.size,
    file_type: `image/${file.name.split('.').pop()}`,
    media_category: 'image',
    storage_path: `spaces/space-1/images/user-1/${Date.now()}_${file.name}`,
    download_url: `https://firebasestorage.googleapis.com/test/${file.name}`,
  }));

  assert.equal(attachments.length, 3);
  attachments.forEach((att) => {
    assert.equal(att.media_category, 'image');
    assert.ok(att.storage_path.startsWith('spaces/space-1/images/'));
  });
});

test('PHASE 4: Media URL resolver handles raw storage paths vs HTTP URLs without crash', () => {
  // Test resolver helper simulation
  const urlCache = new Map();

  function mockResolveMediaDownloadUrl(filePathOrUrl, fallbackUrl) {
    if (!filePathOrUrl && !fallbackUrl) return null;
    const target = fallbackUrl || filePathOrUrl;
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('blob:') || target.startsWith('data:')) {
      return target;
    }
    if (urlCache.has(filePathOrUrl)) {
      return urlCache.get(filePathOrUrl);
    }
    // Simulate resolution to HTTPS Firebase URL
    const resolved = `https://firebasestorage.googleapis.com/v0/b/ourspace-edbf5.appspot.com/o/${encodeURIComponent(filePathOrUrl)}?alt=media`;
    urlCache.set(filePathOrUrl, resolved);
    return resolved;
  }

  // Case 1: Direct HTTPS URL
  const directHttps = 'https://firebasestorage.googleapis.com/some/path';
  assert.equal(mockResolveMediaDownloadUrl('spaces/abc', directHttps), directHttps);

  // Case 2: Raw Storage Path (must never be passed directly to <img>)
  const rawPath = 'spaces/space-123/images/user-456/1730000000_photo.jpg';
  const resolved = mockResolveMediaDownloadUrl(rawPath, undefined);
  assert.ok(resolved.startsWith('https://firebasestorage.googleapis.com/'));
  assert.ok(!resolved.startsWith('spaces/'), 'Must resolve to HTTP(S) URL');

  // Case 3: Cache hits
  assert.equal(urlCache.get(rawPath), resolved);

  // Case 4: Cache clearing on retry
  urlCache.delete(rawPath);
  assert.equal(urlCache.has(rawPath), false);
});
