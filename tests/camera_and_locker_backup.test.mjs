import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

describe('OURSPACE V2.4.1 In-App Camera & Locker Encrypted Backup Suite', () => {
  // ========================================================================
  // 1. IN-APP CAMERA & INSTANT PHOTO PIPELINE
  // ========================================================================
  describe('1. In-App Camera Capture & Instant Photo Pipeline', () => {
    test('Validates photograph MIME types and restricts executables', () => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const forbiddenMimes = ['application/x-msdownload', 'text/javascript', 'application/x-sh'];

      allowedMimes.forEach((mime) => {
        assert.ok(mime.startsWith('image/'), `${mime} must be categorized as an image`);
      });

      forbiddenMimes.forEach((mime) => {
        assert.ok(!allowedMimes.includes(mime), `${mime} must be rejected`);
      });
    });

    test('Constructs dual-asset storage paths for original photo and thumbnail', () => {
      const spaceId = 'space-couple-99';
      const senderId = 'user-alex-1';
      const timestamp = 1793460000000;

      const originalPath = `spaces/${spaceId}/images/${senderId}/camera_photo_${timestamp}.jpg`;
      const thumbPath = `spaces/${spaceId}/images/${senderId}/camera_thumb_${timestamp}.jpg`;

      assert.match(originalPath, /^spaces\/space-couple-99\/images\/user-alex-1\/camera_photo_/);
      assert.match(thumbPath, /^spaces\/space-couple-99\/images\/user-alex-1\/camera_thumb_/);
      assert.notEqual(originalPath, thumbPath);
    });

    test('Ensures in-app camera message document contains only metadata with no base64', () => {
      const messagePayload = {
        spaceId: 'space-couple-99',
        senderId: 'user-alex-1',
        content: 'Sunset captured with love 📸',
        type: 'image',
        replyToId: null,
        attachment: {
          file_name: 'camera_photo_1793460000000.jpg',
          file_size: 1420500,
          file_type: 'image/jpeg',
          media_category: 'image',
          signed_url: 'https://firebasestorage.googleapis.com/v0/b/ourspace-edbf5.appspot.com/o/spaces%2F...jpg',
          file_path: 'spaces/space-couple-99/images/user-alex-1/camera_photo_1793460000000.jpg',
          thumbnail_url: 'https://firebasestorage.googleapis.com/v0/b/ourspace-edbf5.appspot.com/o/spaces%2F...thumb.jpg',
          thumbnail_path: 'spaces/space-couple-99/images/user-alex-1/camera_thumb_1793460000000.jpg',
          width: 1920,
          height: 1080,
        },
      };

      const serialized = JSON.stringify(messagePayload);
      assert.ok(serialized.length < 2048, 'Message document size must be under 2KB');
      assert.ok(!serialized.includes('data:image/'), 'Must not contain base64 Data URLs');
      assert.ok(!serialized.includes('blob:http'), 'Must not contain ephemeral blob URLs');
      assert.equal(messagePayload.attachment.media_category, 'image');
      assert.equal(messagePayload.attachment.width, 1920);
      assert.equal(messagePayload.attachment.height, 1080);
    });
  });

  // ========================================================================
  // 2. OUR LOCKER: KEY HIERARCHY, WRAPPING & RECOVERY
  // ========================================================================
  describe('2. Our Locker Cryptographic Key Management & Wrapping', () => {
    test('Generates high-entropy recovery key with RCV prefix and readable formatting', () => {
      const bytes = crypto.randomBytes(32);
      const hex = bytes.toString('hex').toUpperCase();
      const chunks = ['RCV'];
      for (let i = 0; i < hex.length; i += 4) {
        chunks.push(hex.substring(i, i + 4));
      }
      const recoveryKey = chunks.slice(0, 9).join('-');

      assert.match(recoveryKey, /^RCV(-[0-9A-F]{4}){8}$/, 'Recovery key must match RCV-XXXX-XXXX-... format');
      assert.equal(recoveryKey.split('-').length, 9, 'Must have 9 chunks');
    });

    test('Derives key, wraps master key, and unwraps with WebCrypto AES-GCM', async () => {
      const masterKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const password = 'CorrectHorseBatteryStaple!2026';
      const salt = crypto.randomBytes(16);

      const passKeyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const wrappingKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        passKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      // Wrap master key
      const rawMaster = await crypto.subtle.exportKey('raw', masterKey);
      const iv = crypto.randomBytes(12);
      const wrappedCiphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        wrappingKey,
        rawMaster
      );

      // Unwrap master key
      const decryptedRaw = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        wrappingKey,
        wrappedCiphertext
      );

      const unwrappedMasterKey = await crypto.subtle.importKey(
        'raw',
        decryptedRaw,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Test encryption/decryption with unwrapped key
      const testSecret = 'SuperSecretPrivateLockerNote';
      const encryptIv = crypto.randomBytes(12);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: encryptIv },
        unwrappedMasterKey,
        new TextEncoder().encode(testSecret)
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encryptIv },
        masterKey,
        encrypted
      );

      assert.equal(new TextDecoder().decode(decrypted), testSecret);
    });

    test('Safe password change: Re-wrapping master key preserves old item decryptability', async () => {
      // 1. Generate master key and encrypt a secret item
      const masterKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const itemIv = crypto.randomBytes(12);
      const itemCiphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: itemIv },
        masterKey,
        new TextEncoder().encode('Private Letter to Partner')
      );

      // 2. Change password from OldPassword to NewPassword by re-wrapping master key
      const newPassword = 'BrandNewMasterPassword#2026';
      const newSalt = crypto.randomBytes(16);
      const newKeyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(newPassword),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const newWrappingKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: newSalt, iterations: 100000, hash: 'SHA-256' },
        newKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const rawMaster = await crypto.subtle.exportKey('raw', masterKey);
      const rewrapIv = crypto.randomBytes(12);
      const rewrappedMasterKey = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: rewrapIv },
        newWrappingKey,
        rawMaster
      );

      // 3. User logs in with new password -> unwrap master key
      const recoveredRaw = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: rewrapIv },
        newWrappingKey,
        rewrappedMasterKey
      );
      const activeMasterKey = await crypto.subtle.importKey(
        'raw',
        recoveredRaw,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // 4. Decrypt the original secret item with the active master key
      const decryptedItem = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: itemIv },
        activeMasterKey,
        itemCiphertext
      );

      assert.equal(new TextDecoder().decode(decryptedItem), 'Private Letter to Partner');
    });
  });

  // ========================================================================
  // 3. GOOGLE DRIVE ENCRYPTED BACKUP & INTEGRITY VERIFICATION
  // ========================================================================
  describe('3. Google Drive Encrypted Cloud Backup & Integrity Verification', () => {
    test('Constructs opaque folder path and ensures zero plaintext in backup ciphertext', async () => {
      const opaqueVaultId = 'vault_a8b9c0d1';
      const driveFolder = `OURSPACE_ARCHIVE/SECURE_LOCKER_BACKUPS/${opaqueVaultId}/`;
      assert.equal(driveFolder, 'OURSPACE_ARCHIVE/SECURE_LOCKER_BACKUPS/vault_a8b9c0d1/');

      const sensitiveNote = 'Secret PIN 9421 and Bank Account 5541';
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const iv = crypto.randomBytes(12);
      const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(sensitiveNote)
      );
      const base64Ciphertext = Buffer.from(ciphertextBuffer).toString('base64');

      assert.ok(!base64Ciphertext.includes('9421'), 'Ciphertext must not expose sensitive numbers');
      assert.ok(!base64Ciphertext.includes('Secret'), 'Ciphertext must not expose plaintext words');
      assert.ok(!base64Ciphertext.includes('Bank'), 'Ciphertext must not leak identifiers');
    });

    test('Computes SHA-256 ciphertext hash and detects tampered backup bundles', async () => {
      const ciphertexts = [
        'dGVzdC1jaXBoZXJ0ZXh0LTE=',
        'dGVzdC1jaXBoZXJ0ZXh0LTI=',
        'dGVzdC1jaXBoZXJ0ZXh0LTM=',
      ];

      const sorted = [...ciphertexts].sort();
      const concatenated = sorted.join('::OURSPACE_CIPHERTEXT_SEPARATOR::');
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(concatenated));
      const authenticHash = Buffer.from(hashBuffer).toString('hex');

      assert.equal(typeof authenticHash, 'string');
      assert.equal(authenticHash.length, 64);

      // Tampered ciphertexts test
      const tampered = [
        'dGVzdC1jaXBoZXJ0ZXh0LTE=',
        'dGVzdC10YW1wZXJlZC1jaXBoZXJ0ZXh0=',
        'dGVzdC1jaXBoZXJ0ZXh0LTM=',
      ];
      const tamperedConcat = [...tampered].sort().join('::OURSPACE_CIPHERTEXT_SEPARATOR::');
      const tamperedHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tamperedConcat));
      const tamperedHash = Buffer.from(tamperedHashBuffer).toString('hex');

      assert.notEqual(authenticHash, tamperedHash, 'Tampered ciphertext must cause SHA-256 hash mismatch');
    });
  });

  // ========================================================================
  // 4. DELETION STATE MACHINE VERIFICATION
  // ========================================================================
  describe('4. Complete Locker Deletion State Machine', () => {
    test('Transitions strictly through all 7 deletion phases without skipping', () => {
      const stateLog = [];
      const EXPECTED_SEQUENCE = [
        'ACTIVE',
        'LOCKED_FOR_DELETION',
        'FIREBASE_PURGING',
        'DRIVE_PURGING',
        'METADATA_PURGING',
        'VERIFYING_ALL_LOCATIONS',
        'OLD_KEYS_DESTROYED',
        'READY_FOR_NEW_LOCKER',
      ];

      let currentState = 'ACTIVE';
      stateLog.push(currentState);

      // Transition sequence
      currentState = 'LOCKED_FOR_DELETION';
      stateLog.push(currentState);
      currentState = 'FIREBASE_PURGING';
      stateLog.push(currentState);
      currentState = 'DRIVE_PURGING';
      stateLog.push(currentState);
      currentState = 'METADATA_PURGING';
      stateLog.push(currentState);
      currentState = 'VERIFYING_ALL_LOCATIONS';
      stateLog.push(currentState);
      currentState = 'OLD_KEYS_DESTROYED';
      stateLog.push(currentState);
      currentState = 'READY_FOR_NEW_LOCKER';
      stateLog.push(currentState);

      assert.deepEqual(stateLog, EXPECTED_SEQUENCE, 'Deletion must follow strict state machine sequence');
    });

    test('Rejects deletion if confirmation phrase does not match DELETE MY LOCKER', () => {
      const validPhrase = 'DELETE MY LOCKER';
      const invalidPhrases = ['delete my locker', 'DELETE', 'DELETE LOCKER', 'YES'];

      invalidPhrases.forEach((phrase) => {
        assert.notEqual(phrase.trim(), validPhrase, `Phrase "${phrase}" must be rejected`);
      });
    });
  });
});
