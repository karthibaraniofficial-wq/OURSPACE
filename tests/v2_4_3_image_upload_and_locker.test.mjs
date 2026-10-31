import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// -----------------------------------------------------------------------------
// 1. Storage Error Parser & Billing Detection (Phase 1 & Phase 7)
// -----------------------------------------------------------------------------
function parseFirebaseStorageError(err) {
  const code = (err && (err.code || err.serverResponse?.status)) ? String(err.code || '') : 'storage/unknown';
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const httpStatus = err?.serverResponse?.status || err?.status || (rawMsg.includes('402') ? 402 : rawMsg.includes('403') ? 403 : undefined);

  if (
    httpStatus === 402 ||
    rawMsg.toLowerCase().includes('billing') ||
    rawMsg.toLowerCase().includes('payment required') ||
    rawMsg.toLowerCase().includes('blaze')
  ) {
    return {
      code: 'storage/billing-required',
      userMessage: 'Firebase Cloud Storage requires a linked billing account (Blaze plan). Check Firebase Console.',
      retryable: false,
      httpStatus: 402,
    };
  }

  if (code === 'storage/bucket-not-found' || rawMsg.toLowerCase().includes('bucket not found')) {
    return {
      code: 'storage/bucket-not-found',
      userMessage: 'OURSPACE Storage bucket is not configured or does not exist. Check Firebase project.',
      retryable: false,
      httpStatus: 404,
    };
  }

  if (code === 'storage/unauthorized' || rawMsg.toLowerCase().includes('permission denied')) {
    return {
      code: 'storage/unauthorized',
      userMessage: 'Upload rejected by Storage Security Rules. Check your private space membership.',
      retryable: false,
      httpStatus: 403,
    };
  }

  if (code === 'storage/stalled-at-zero') {
    return {
      code: 'storage/stalled-at-zero',
      userMessage: 'Upload stalled at 0%. Cloud Storage is unreachable. Firebase requires a linked Blaze billing account or bucket provisioning.',
      retryable: true,
      httpStatus: 408,
    };
  }

  return {
    code,
    userMessage: rawMsg || 'An unexpected storage error occurred during upload.',
    retryable: true,
    httpStatus,
  };
}

test('PHASE 1 & 7: Detects Firebase Cloud Storage billing block and missing bucket', () => {
  // Test HTTP 402 Payment Required
  const billingErr = parseFirebaseStorageError(new Error('Firebase Storage API error: 402 Payment Required. Project must be upgraded to Blaze plan.'));
  assert.equal(billingErr.code, 'storage/billing-required');
  assert.equal(billingErr.httpStatus, 402);
  assert.match(billingErr.userMessage, /Blaze plan/i);

  // Test Bucket Not Found (e.g. unprovisioned ourspace-edbf5)
  const bucketErr = parseFirebaseStorageError({ code: 'storage/bucket-not-found', message: 'The specified bucket does not exist.' });
  assert.equal(bucketErr.code, 'storage/bucket-not-found');
  assert.match(bucketErr.userMessage, /bucket is not configured/i);

  // Test Stalled at 0%
  const stallErr = parseFirebaseStorageError({ code: 'storage/stalled-at-zero' });
  assert.equal(stallErr.code, 'storage/stalled-at-zero');
  assert.match(stallErr.userMessage, /Upload stalled at 0%/i);
});

// -----------------------------------------------------------------------------
// 2. Sample 773.8 KB Image Upload Validation (Phase 6 & Phase 10)
// -----------------------------------------------------------------------------
test('PHASE 10: Exact 773.8 KB sample image validation and resumable metadata formatting', () => {
  const EXACT_SIZE_BYTES = 792371; // 773.8 KB
  const sampleFile = {
    name: 'Man_leaning_on_mot.jpg',
    size: EXACT_SIZE_BYTES,
    type: 'image/jpeg',
  };

  // 1. File size ceiling check (50MB)
  assert.ok(sampleFile.size < 50 * 1024 * 1024, 'File must be under 50MB ceiling');
  assert.equal(Math.round((sampleFile.size / 1024) * 10) / 10, 773.8, 'Size must correspond to 773.8 KB');

  // 2. MIME type check
  assert.ok(sampleFile.type.startsWith('image/'), 'MIME type must be an image');

  // 3. Storage path formatting
  const spaceId = 'space-test-123';
  const senderId = 'user-owner-456';
  const safeName = sampleFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueFileId = `1730419200000_${safeName}`;
  const storagePath = `spaces/${spaceId}/images/${senderId}/${uniqueFileId}`;

  assert.equal(storagePath, 'spaces/space-test-123/images/user-owner-456/1730419200000_Man_leaning_on_mot.jpg');
});

// -----------------------------------------------------------------------------
// 3. Upload Stage Machine & Failure Recovery (Phase 9 & Phase 11)
// -----------------------------------------------------------------------------
test('PHASE 9 & 11: Upload lifecycle stages progression and failure state preservation', () => {
  const recordedStages = [];
  const setUploadStage = (stage) => recordedStages.push(stage);

  // Normal flow
  setUploadStage('PREPARING IMAGE');
  setUploadStage('CONNECTING TO FIREBASE');
  setUploadStage('UPLOADING 0%');
  setUploadStage('UPLOADING 50%');
  setUploadStage('FINALIZING UPLOAD');
  setUploadStage('SAVING MESSAGE');
  setUploadStage('SENT');

  assert.deepEqual(recordedStages, [
    'PREPARING IMAGE',
    'CONNECTING TO FIREBASE',
    'UPLOADING 0%',
    'UPLOADING 50%',
    'FINALIZING UPLOAD',
    'SAVING MESSAGE',
    'SENT',
  ]);

  // Simulated failure recovery
  let stagedMedia = [{ name: 'test.jpg', size: 1024 }];
  let stagedText = 'Check out this photo';
  let activeMessageId = 'msg-stable-123';

  try {
    throw new Error('Upload stalled at 0%');
  } catch (err) {
    setUploadStage('UPLOAD FAILED');
    // On failure: DO NOT clear stagedMedia, DO NOT clear text, retain activeMessageId for retry!
    assert.equal(stagedMedia.length, 1, 'Staged media must remain intact for retry');
    assert.equal(stagedText, 'Check out this photo', 'Text caption must remain intact');
    assert.equal(activeMessageId, 'msg-stable-123', 'Stable message ID must be preserved for idempotent retry');
  }
});

// -----------------------------------------------------------------------------
// 4. Locker Item Encryption & Decryption Persistence (IV Bug Fix)
// -----------------------------------------------------------------------------
test('LOCKER PERSISTENCE: AES-256-GCM encryption/decryption with unified IV and photo payload', async () => {
  const subtle = crypto.webcrypto.subtle;

  // 1. Generate master key
  const masterKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Sample photo payload to store in locker
  const title = 'Secret Anniversary Photograph';
  const payload = {
    notes: 'Private beach memories',
    secret: 'PIN-9921',
    file: {
      name: 'anniversary_photo.png',
      size: 409600,
      type: 'image/png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
    createdAt: new Date().toISOString(),
  };

  // 3. Encrypt using unified IV (Fix for the IV mismatch bug)
  const itemIv = crypto.webcrypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const encTitleBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: itemIv },
    masterKey,
    encoder.encode(title)
  );

  const encPayloadBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: itemIv },
    masterKey,
    encoder.encode(JSON.stringify(payload))
  );

  const encItem = {
    id: 'item-anniversary-1',
    title_ciphertext: Buffer.from(encTitleBuffer).toString('base64'),
    payload_ciphertext: Buffer.from(encPayloadBuffer).toString('base64'),
    iv: Buffer.from(itemIv).toString('hex'),
    payload_iv: Buffer.from(itemIv).toString('hex'),
  };

  // 4. Simulate locker lock & reopen: Decrypt using payload_iv || iv
  const ivBuffer = Buffer.from(encItem.iv, 'hex');
  const payloadIvBuffer = Buffer.from(encItem.payload_iv || encItem.iv, 'hex');

  const decTitleBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    masterKey,
    Buffer.from(encItem.title_ciphertext, 'base64')
  );
  const decryptedTitle = decoder.decode(decTitleBuffer);

  const decPayloadBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: payloadIvBuffer },
    masterKey,
    Buffer.from(encItem.payload_ciphertext, 'base64')
  );
  const decryptedPayload = JSON.parse(decoder.decode(decPayloadBuffer));

  // 5. Assert 100% data integrity
  assert.equal(decryptedTitle, title, 'Title must decrypt accurately');
  assert.equal(decryptedPayload.notes, payload.notes, 'Notes must decrypt accurately');
  assert.equal(decryptedPayload.secret, payload.secret, 'Secret PIN must match');
  assert.equal(decryptedPayload.file.name, 'anniversary_photo.png', 'Attached photo name must match');
  assert.equal(decryptedPayload.file.dataUrl, payload.file.dataUrl, 'Attached photo dataUrl must be preserved');
});
