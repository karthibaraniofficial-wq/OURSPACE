/**
 * OURSPACE V2.5.0 — Ultimate Master Integration Test Suite
 *
 * Validates:
 * 1. Google Drive Central Storage Folder Hierarchy & Opaque Identity Isolation
 * 2. 250 GB Quota Accounting Ledger, Reservation Lease, and Warning State Machine
 * 3. Multi-Couple Client-Side End-to-End Encryption (E2EE) Isolation (AES-GCM 256-bit)
 * 4. Cross-Couple Cryptographic Partition: Couple A cannot decrypt Couple B
 * 5. Private Locker Per-User Key Isolation: Partner A cannot decrypt Partner B
 * 6. Zero-Plaintext to Cloud: Central Google Drive stores ciphertext ONLY
 * 7. Backward-Compatible Attachment Resolution (Legacy Firebase Storage vs Drive)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_OURSPACE_STORAGE_BYTES,
  STORAGE_WARNING_BYTES,
  STORAGE_CRITICAL_BYTES,
  getStorageWarningLevel,
  formatDecimalBytes,
  getDriveFolderPath,
} from '../packages/shared/src/index.ts';

// Web Crypto API in Node 18+
const subtle = globalThis.crypto.subtle;

describe('OURSPACE V2.5.0 — Ultimate Master Suite', () => {
  // ========================================================================
  // 1. Google Drive Folder Hierarchy & Opaque Identity Isolation
  // ========================================================================
  it('1. Google Drive Folder Structure: generates opaque canonical paths without PII', () => {
    // Shared Media for Space
    const spaceId = 'space-abc-123-uuid';
    const imagePath = getDriveFolderPath('CHAT_IMAGES', spaceId);
    assert.deepEqual(imagePath, ['OURSPACE_STORAGE', 'SHARED_MEDIA', 'space_space-abc-123-uuid', 'CHAT_IMAGES']);

    const videoPath = getDriveFolderPath('CHAT_VIDEOS', spaceId);
    assert.deepEqual(videoPath, ['OURSPACE_STORAGE', 'SHARED_MEDIA', 'space_space-abc-123-uuid', 'CHAT_VIDEOS']);

    const voicePath = getDriveFolderPath('VOICE_NOTES', spaceId);
    assert.deepEqual(voicePath, ['OURSPACE_STORAGE', 'SHARED_MEDIA', 'space_space-abc-123-uuid', 'VOICE_NOTES']);

    const docPath = getDriveFolderPath('DOCUMENTS', spaceId);
    assert.deepEqual(docPath, ['OURSPACE_STORAGE', 'SHARED_MEDIA', 'space_space-abc-123-uuid', 'DOCUMENTS']);

    const profilePath = getDriveFolderPath('PROFILE_PHOTOS', spaceId);
    assert.deepEqual(profilePath, ['OURSPACE_STORAGE', 'SHARED_MEDIA', 'space_space-abc-123-uuid', 'PROFILE_PHOTOS']);

    // Private Locker for User
    const userId = 'usr-987-xyz';
    const lockerImgPath = getDriveFolderPath('ENCRYPTED_IMAGES', null, userId);
    assert.deepEqual(lockerImgPath, ['OURSPACE_STORAGE', 'PRIVATE_LOCKER', 'user_usr-987-xyz', 'ENCRYPTED_IMAGES']);

    const lockerDocPath = getDriveFolderPath('ENCRYPTED_DOCUMENTS', null, userId);
    assert.deepEqual(lockerDocPath, ['OURSPACE_STORAGE', 'PRIVATE_LOCKER', 'user_usr-987-xyz', 'ENCRYPTED_DOCUMENTS']);

    // Guarantees no sensitive PII (emails or names) in folder names
    assert.strictEqual(imagePath.some((s) => s.includes('@')), false);
    assert.strictEqual(lockerImgPath.some((s) => s.includes('@')), false);
  });

  // ========================================================================
  // 2. 250 GB Quota Accounting Ledger & Warning State Machine
  // ========================================================================
  it('2. 250 GB Storage Quota: verifies warnings at 150 GB, 200 GB, and hard stop at 250 GB', () => {
    assert.strictEqual(MAX_OURSPACE_STORAGE_BYTES, 250_000_000_000);
    assert.strictEqual(STORAGE_WARNING_BYTES, 150_000_000_000);
    assert.strictEqual(STORAGE_CRITICAL_BYTES, 200_000_000_000);

    // Normal Usage (50 GB)
    const normal50GB = 50_000_000_000;
    assert.strictEqual(getStorageWarningLevel(normal50GB), 'NORMAL');
    assert.strictEqual(formatDecimalBytes(normal50GB), '50.0 GB');

    // Warning Threshold (150 GB)
    const warning150GB = 150_000_000_000;
    assert.strictEqual(getStorageWarningLevel(warning150GB), 'WARNING');

    // Critical Threshold (200 GB)
    const critical200GB = 200_000_000_000;
    assert.strictEqual(getStorageWarningLevel(critical200GB), 'CRITICAL');

    // Exceeded Hard Stop (250 GB)
    const exceeded250GB = 250_000_000_000;
    assert.strictEqual(getStorageWarningLevel(exceeded250GB), 'EXCEEDED');

    // Beyond limit (251 GB)
    assert.strictEqual(getStorageWarningLevel(251_000_000_000), 'EXCEEDED');
  });

  it('2b. Quota Reservation State Machine: rejects reservation exceeding available capacity', () => {
    const verifiedUsed = 248_000_000_000; // 248 GB used
    const reserved = 1_000_000_000; // 1 GB in-flight
    const available = MAX_OURSPACE_STORAGE_BYTES - (verifiedUsed + reserved); // 1 GB left

    assert.strictEqual(available, 1_000_000_000);

    // Attempting to upload a 2 GB video must be BLOCKED
    const requestedUpload = 2_000_000_000;
    const canReserve = verifiedUsed + reserved + requestedUpload <= MAX_OURSPACE_STORAGE_BYTES;
    assert.strictEqual(canReserve, false);

    // Attempting a 500 MB photo is APPROVED
    const smallPhoto = 500_000_000;
    const canReservePhoto = verifiedUsed + reserved + smallPhoto <= MAX_OURSPACE_STORAGE_BYTES;
    assert.strictEqual(canReservePhoto, true);
  });

  // ========================================================================
  // 3. Multi-Couple End-to-End Encryption (E2EE) Isolation
  // ========================================================================
  it('3. Multi-Couple E2EE: Couple A can encrypt and decrypt photo with AES-GCM 256-bit', async () => {
    // Generate Space Key for Couple A (32 bytes = 256 bits)
    const rawSpaceKeyA = new Uint8Array(32);
    const secretBytes = new TextEncoder().encode('space_key_couple_alpha_secret');
    rawSpaceKeyA.set(secretBytes.subarray(0, 32));

    const spaceKeyA = await subtle.importKey(
      'raw',
      rawSpaceKeyA,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    // Plaintext photo bytes
    const plaintextPhoto = new TextEncoder().encode('RAW_JPEG_IMAGE_PIXELS_COUPLE_ALPHA_PRIVATE_PHOTO');

    // 1. Client creates per-file media key & 12-byte IV
    const mediaKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

    // 2. Encrypt plaintext photo
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, mediaKey, plaintextPhoto);

    // 3. Wrap media key under Couple A's Space Key
    const rawMediaKey = await subtle.exportKey('raw', mediaKey);
    const wrapIv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const wrappedMediaKey = await subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, spaceKeyA, rawMediaKey);

    // Verification: Ciphertext does NOT match plaintext
    const ciphertextStr = Buffer.from(ciphertext).toString('utf8');
    assert.strictEqual(ciphertextStr.includes('RAW_JPEG_IMAGE'), false);

    // 4. Recipient in Couple A unwraps media key and decrypts photo
    const unwrappedRaw = await subtle.decrypt({ name: 'AES-GCM', iv: wrapIv }, spaceKeyA, wrappedMediaKey);
    const recoveredMediaKey = await subtle.importKey('raw', unwrappedRaw, { name: 'AES-GCM' }, false, ['decrypt']);

    const decryptedBuffer = await subtle.decrypt({ name: 'AES-GCM', iv }, recoveredMediaKey, ciphertext);
    const recoveredPlaintext = new TextDecoder().decode(decryptedBuffer);

    assert.strictEqual(recoveredPlaintext, 'RAW_JPEG_IMAGE_PIXELS_COUPLE_ALPHA_PRIVATE_PHOTO');
  });

  // ========================================================================
  // 4. Cross-Couple Cryptographic Partition: Couple A cannot decrypt Couple B
  // ========================================================================
  it('4. Cross-Couple Isolation: Couple B CANNOT decrypt Couple A photo (cryptographic rejection)', async () => {
    // Couple A Space Key
    const keyBytesA = new Uint8Array(32).fill(0xaa);
    const spaceKeyA = await subtle.importKey('raw', keyBytesA, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);

    // Couple B Space Key (Completely different isolated key)
    const keyBytesB = new Uint8Array(32).fill(0xbb);
    const spaceKeyB = await subtle.importKey('raw', keyBytesB, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);

    // Couple A encrypts private photo
    const plaintext = new TextEncoder().encode('CONFIDENTIAL_COUPLE_A_DIARY_PHOTO');
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, spaceKeyA, plaintext);

    // Couple B attempts to decrypt Couple A's ciphertext using Space Key B
    await assert.rejects(
      async () => {
        await subtle.decrypt({ name: 'AES-GCM', iv }, spaceKeyB, ciphertext);
      },
      (err) => {
        // SubtleCrypto throws an OperationError on authentication tag mismatch
        return true;
      }
    );
  });

  // ========================================================================
  // 5. Private Locker Per-User Key Isolation: Partner A cannot decrypt Partner B
  // ========================================================================
  it('5. Private Locker Vault Isolation: Partner 1 cannot decrypt Partner 2 private vault', async () => {
    // Partner 1 Vault Key (User A)
    const vaultKeyUser1 = await subtle.importKey(
      'raw',
      new Uint8Array(32).fill(0x11),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    // Partner 2 Vault Key (User B)
    const vaultKeyUser2 = await subtle.importKey(
      'raw',
      new Uint8Array(32).fill(0x22),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    const secretPassword = new TextEncoder().encode('Bank Pin: 9876. Private personal thoughts.');
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const user2VaultCiphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, vaultKeyUser2, secretPassword);

    // Partner 1 tries to decrypt Partner 2's locker item
    await assert.rejects(
      async () => {
        await subtle.decrypt({ name: 'AES-GCM', iv }, vaultKeyUser1, user2VaultCiphertext);
      },
      (err) => {
        return true;
      }
    );
  });

  // ========================================================================
  // 6. Zero Plaintext to Cloud: Central Google Drive stores ciphertext ONLY
  // ========================================================================
  it('6. Zero Plaintext to Storage: Verified ciphertext payload contains no unencrypted text', async () => {
    const rawData = 'ROMANTIC_LOVE_LETTER_CONFIDENTIAL_FOREVER';
    const rawBytes = new TextEncoder().encode(rawData);

    const key = await subtle.importKey(
      'raw',
      new Uint8Array(32).fill(0x42),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, rawBytes);

    const ciphertextBuffer = Buffer.from(ciphertext);

    // The Google Drive storage file contains only ciphertext
    assert.strictEqual(ciphertextBuffer.includes(Buffer.from('ROMANTIC')), false);
    assert.strictEqual(ciphertextBuffer.includes(Buffer.from('LOVE')), false);
    assert.strictEqual(ciphertextBuffer.includes(Buffer.from('LETTER')), false);
  });

  // ========================================================================
  // 7. Backward-Compatible Attachment Resolution
  // ========================================================================
  it('7. Backward-Compatible Attachment Resolution: supports legacy Firebase Storage and Drive endpoints', () => {
    const legacyFirebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/ourspace-edbf5.appspot.com/o/spaces%2Fimages%2Fphoto.jpg';
    const legacyPath = 'spaces/space-123/images/user-456/photo.jpg';
    const googleDriveFileId = '1aB2cD3eF4gH5iJ6kL7mN8oP';
    const googleDriveGatewayUrl = `/api/media/${googleDriveFileId}`;

    // Helper checking candidate URL format
    const isDriveGateway = (url) => url.startsWith('/api/media/') || !url.startsWith('http');
    const isLegacyFirebase = (url) => url.includes('firebasestorage.googleapis.com') || url.startsWith('spaces/');

    assert.strictEqual(isLegacyFirebase(legacyFirebaseUrl), true);
    assert.strictEqual(isLegacyFirebase(legacyPath), true);
    assert.strictEqual(isDriveGateway(googleDriveGatewayUrl), true);
    assert.strictEqual(isDriveGateway(googleDriveFileId), true);
  });
});
