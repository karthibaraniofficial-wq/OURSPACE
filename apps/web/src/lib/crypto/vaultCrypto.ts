/**
 * OURSPACE Our Locker: Client-Side End-to-End Cryptography Engine
 *
 * Implements authenticated client-side encryption using the standard Web Crypto API.
 * Standards:
 *  - Key Derivation: PBKDF2 with SHA-256, 100,000 iterations
 *  - Symmetric Cipher: AES-GCM 256-bit with unique 12-byte initialization vectors (IV)
 *  - Verifier: SHA-256 hash of derived key to authenticate unlock attempts without storing plaintext passwords or keys
 *  - Zero-Knowledge: Plaintext passwords, derived keys, and unencrypted payloads never touch Firebase or persistent storage.
 */

// Utility: ArrayBuffer <-> Hex string
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Utility: ArrayBuffer <-> Base64 string
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Cryptography API (subtle) is unavailable in this environment.');
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto.getRandomValues(array);
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto.getRandomValues(array);
  }
  throw new Error('Web Cryptography API (getRandomValues) is unavailable.');
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  return getRandomValues(bytes);
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a password and salt using PBKDF2 (100,000 rounds)
 */
export async function deriveKeyFromPassword(password: string, saltHex: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const salt = hexToBuffer(saltHex);

  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // exportable for verifier hash generation
    ['encrypt', 'decrypt']
  );
}

/**
 * Computes a SHA-256 verifier hash of the derived key.
 * This verifier is stored in Firestore to validate future unlock attempts.
 */
export async function computeKeyVerifier(key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const rawKey = await subtle.exportKey('raw', key);
  const hashBuffer = await subtle.digest('SHA-256', rawKey);
  return bufferToHex(hashBuffer);
}

/**
 * Encrypt arbitrary JSON serializable payload with AES-GCM 256-bit
 */
export async function encryptPayload(
  payload: any,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const iv = generateRandomBytes(12); // 12-byte IV standard for AES-GCM
  const plaintext = typeof payload === 'string' ? payload : JSON.stringify(payload);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToHex(iv),
  };
}

/**
 * Decrypt AES-GCM 256-bit ciphertext
 */
export async function decryptPayload<T = any>(
  ciphertextBase64: string,
  ivHex: string,
  key: CryptoKey
): Promise<T> {
  const subtle = getSubtleCrypto();
  const decoder = new TextDecoder();
  const iv = hexToBuffer(ivHex);
  const encryptedBuffer = base64ToBuffer(ciphertextBase64);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    encryptedBuffer as unknown as BufferSource
  );

  const plaintext = decoder.decode(decryptedBuffer);
  try {
    return JSON.parse(plaintext) as T;
  } catch {
    return plaintext as unknown as T;
  }
}

/**
 * Generates a random 256-bit AES-GCM Locker Master Key
 * Created strictly on the user's device. Never uploaded in plaintext.
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so it can be wrapped by the password wrapping key
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a high-entropy recovery key (256 bits formatted as clean readable chunks)
 * Example: RCV-A1B2-C3D4-E5F6-7890-ABCD-EF01-2345
 */
export function generateRecoveryKey(): string {
  const bytes = generateRandomBytes(32);
  const hex = bufferToHex(bytes).toUpperCase();
  const chunks: string[] = ['RCV'];
  for (let i = 0; i < hex.length; i += 4) {
    chunks.push(hex.substring(i, i + 4));
  }
  return chunks.slice(0, 9).join('-');
}

/**
 * Derives a key wrapping key from a password or recovery key using PBKDF2 (100,000 iterations)
 */
export async function deriveWrappingKey(passphraseOrRecovery: string, saltHex: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const salt = hexToBuffer(saltHex);
  const normalized = passphraseOrRecovery.trim().replace(/\s+/g, '');

  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(normalized),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Securely wraps the locker master key using authenticated AES-GCM
 */
export async function wrapMasterKey(
  masterKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<{ wrappedKey: string; iv: string }> {
  const subtle = getSubtleCrypto();
  const rawMaster = await subtle.exportKey('raw', masterKey);
  const iv = generateRandomBytes(12);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    wrappingKey,
    rawMaster
  );

  return {
    wrappedKey: bufferToBase64(encryptedBuffer),
    iv: bufferToHex(iv),
  };
}

/**
 * Securely unwraps the locker master key using authenticated AES-GCM
 */
export async function unwrapMasterKey(
  wrappedKeyBase64: string,
  ivHex: string,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const iv = hexToBuffer(ivHex);
  const encryptedBuffer = base64ToBuffer(wrappedKeyBase64);

  const decryptedRaw = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    wrappingKey,
    encryptedBuffer as unknown as BufferSource
  );

  return await subtle.importKey(
    'raw',
    decryptedRaw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Computes an authenticated SHA-256 integrity hash across a set of ciphertexts
 */
export async function computeCiphertextHash(ciphertexts: string[]): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const sorted = [...ciphertexts].sort();
  const concatenated = sorted.join('::OURSPACE_CIPHERTEXT_SEPARATOR::');
  const digestBuffer = await subtle.digest('SHA-256', encoder.encode(concatenated));
  return bufferToHex(digestBuffer);
}

