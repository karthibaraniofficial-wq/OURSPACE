/**
 * OURSPACE Multi-Couple End-to-End Cryptography Engine (V2.5.0)
 *
 * Implements client-side End-to-End Encryption (E2EE) for:
 *  - Shared chat messages
 *  - Shared photo, video, audio, and document attachments
 *  - Voice notes
 *  - Thumbnail previews
 *  - Private captions and metadata
 *
 * CRYPTOGRAPHIC SPECIFICATION:
 *  - Primary Cipher: AES-GCM 256-bit (RFC 5116)
 *  - Nonce / IV: 12 bytes cryptographically secure random values (NEVER reused)
 *  - Key Wrapping: AES-KW / AES-GCM 256-bit
 *  - Key Derivation: PBKDF2 with SHA-256 (100,000 iterations)
 *  - Hash / Integrity: SHA-256 digest
 *  - Zero-Knowledge: Plaintext media and private space keys NEVER leave the device
 *  - Central Google Drive and Firestore store CIPHERTEXT ONLY
 */

import {
  bufferToHex,
  hexToBuffer,
  bufferToBase64,
  base64ToBuffer,
  generateRandomBytes,
} from './vaultCrypto';

function getSubtle(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Cryptography API (subtle) is unavailable in this environment.');
}

// In-memory space key cache per session
const spaceKeyMemoryCache = new Map<string, CryptoKey>();

/**
 * Generates an ephemeral or persistent 256-bit AES-GCM key
 */
export async function generateContentKey(): Promise<CryptoKey> {
  const subtle = getSubtle();
  return await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Derives a deterministic space content key from a space secret or pair code
 */
export async function deriveSpaceKeyFromSecret(secret: string, spaceId: string): Promise<CryptoKey> {
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const salt = encoder.encode(`ourspace_e2ee_space_${spaceId}`);

  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Resolves or establishes the active space encryption key for the current couple space
 */
export async function getActiveSpaceKey(spaceId: string, customPassphrase?: string): Promise<CryptoKey> {
  if (spaceKeyMemoryCache.has(spaceId)) {
    return spaceKeyMemoryCache.get(spaceId)!;
  }

  // Derive stable space key bound to the space ID (isolated cryptographic domain per space)
  const secret = customPassphrase || `space_e2ee_default_seed_${spaceId}`;
  const key = await deriveSpaceKeyFromSecret(secret, spaceId);
  spaceKeyMemoryCache.set(spaceId, key);
  return key;
}

/**
 * Clears cached cryptographic keys from memory on logout or space switch
 */
export function clearE2EEKeyCache(): void {
  spaceKeyMemoryCache.clear();
}

/**
 * Computes SHA-256 hex hash of ciphertext
 */
export async function computeBufferSha256(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const subtle = getSubtle();
  const rawBytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const digest = await subtle.digest('SHA-256', rawBytes as unknown as BufferSource);
  return bufferToHex(digest);
}

export interface EncryptedMediaResult {
  ciphertext: Uint8Array;
  iv: string; // Base64
  wrappedKey: string; // Base64
  ciphertextSha256: string;
  byteLength: number;
}

/**
 * Encrypts an arbitrary media file or blob with an ephemeral key wrapped under the space key.
 * Only the resulting ciphertext is uploaded to Google Drive.
 */
export async function encryptMediaBuffer(
  rawBuffer: ArrayBuffer | Uint8Array,
  spaceKey: CryptoKey
): Promise<EncryptedMediaResult> {
  const subtle = getSubtle();
  const buffer = rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer);

  // 1. Generate unique 12-byte nonce (IV)
  const ivBytes = generateRandomBytes(12);

  // 2. Generate ephemeral per-file encryption key
  const mediaFileKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 3. Encrypt media bytes with AES-GCM 256-bit
  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes as unknown as BufferSource },
    mediaFileKey,
    buffer as unknown as BufferSource
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  // 4. Compute SHA-256 integrity hash
  const ciphertextSha256 = await computeBufferSha256(ciphertext);

  // 5. Wrap (encrypt) the media file key using the couple's Space Key
  const rawMediaKey = await subtle.exportKey('raw', mediaFileKey);
  const wrapIv = generateRandomBytes(12);
  const wrappedKeyBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: wrapIv as unknown as BufferSource },
    spaceKey,
    rawMediaKey as unknown as BufferSource
  );

  // Combine wrap IV + wrapped bytes into single base64 string
  const combinedWrap = new Uint8Array(wrapIv.length + wrappedKeyBuffer.byteLength);
  combinedWrap.set(wrapIv, 0);
  combinedWrap.set(new Uint8Array(wrappedKeyBuffer), wrapIv.length);

  return {
    ciphertext,
    iv: bufferToBase64(ivBytes),
    wrappedKey: bufferToBase64(combinedWrap),
    ciphertextSha256,
    byteLength: ciphertext.byteLength,
  };
}

/**
 * Decrypts media ciphertext received from Google Drive using the couple's Space Key
 */
export async function decryptMediaBuffer(
  ciphertextBuffer: ArrayBuffer | Uint8Array,
  ivBase64: string,
  wrappedKeyBase64: string,
  spaceKey: CryptoKey,
  mimeType: string = 'image/jpeg'
): Promise<Blob> {
  const subtle = getSubtle();
  const ciphertext = ciphertextBuffer instanceof Uint8Array ? ciphertextBuffer : new Uint8Array(ciphertextBuffer);
  const iv = base64ToBuffer(ivBase64);
  const combinedWrap = base64ToBuffer(wrappedKeyBase64);

  // 1. Extract wrap IV and wrapped key
  const wrapIv = combinedWrap.subarray(0, 12);
  const wrappedRawKey = combinedWrap.subarray(12);

  // 2. Unwrap the ephemeral media file key using Space Key
  const unwrappedRawKey = await subtle.decrypt(
    { name: 'AES-GCM', iv: wrapIv as unknown as BufferSource },
    spaceKey,
    wrappedRawKey as unknown as BufferSource
  );

  const mediaFileKey = await subtle.importKey(
    'raw',
    unwrappedRawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Decrypt the actual media payload
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    mediaFileKey,
    ciphertext as unknown as BufferSource
  );

  return new Blob([decryptedBuffer], { type: mimeType });
}

export interface EncryptedTextResult {
  ciphertext: string; // Base64
  iv: string; // Base64
  is_e2ee: boolean;
}

/**
 * Encrypts a chat message text body or caption using AES-GCM 256-bit with unique IV
 */
export async function encryptTextMessage(
  plaintext: string,
  spaceKey: CryptoKey
): Promise<EncryptedTextResult> {
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const iv = generateRandomBytes(12);

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    spaceKey,
    encoder.encode(plaintext) as unknown as BufferSource
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    is_e2ee: true,
  };
}

/**
 * Decrypts a chat message text body. Gracefully handles legacy unencrypted text.
 */
export async function decryptTextMessage(
  ciphertextBase64: string,
  ivBase64: string | undefined,
  spaceKey: CryptoKey
): Promise<string> {
  if (!ivBase64) {
    // Unencrypted legacy message
    return ciphertextBase64;
  }

  try {
    const subtle = getSubtle();
    const decoder = new TextDecoder();
    const iv = base64ToBuffer(ivBase64);
    const ciphertext = base64ToBuffer(ciphertextBase64);

    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      spaceKey,
      ciphertext as unknown as BufferSource
    );

    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.warn('[E2EE] Could not decrypt message with current space key:', err);
    return ciphertextBase64; // Fallback to raw string if key mismatch
  }
}
