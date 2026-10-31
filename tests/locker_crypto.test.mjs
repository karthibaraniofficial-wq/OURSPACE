import test from 'node:test';
import assert from 'node:assert';
import {
  deriveKeyFromPassword,
  computeKeyVerifier,
  encryptPayload,
  decryptPayload,
  generateRandomBytes,
  bufferToHex,
} from '../apps/web/src/lib/crypto/vaultCrypto.ts';

test('Locker Cryptography: Derivation, Encryption, and Decryption', async () => {
  const password = 'SuperSecretCouplePassword2026!';
  const salt = bufferToHex(generateRandomBytes(16));

  // 1. Derive Key
  const key = await deriveKeyFromPassword(password, salt);
  assert.ok(key, 'Key should be derived successfully');

  // 2. Compute Verifier Hash
  const verifierHash = await computeKeyVerifier(key);
  assert.strictEqual(typeof verifierHash, 'string');
  assert.strictEqual(verifierHash.length, 64, 'SHA-256 hex verifier should be 64 characters');

  // 3. Re-derive from same password + salt must produce matching verifier
  const key2 = await deriveKeyFromPassword(password, salt);
  const verifierHash2 = await computeKeyVerifier(key2);
  assert.strictEqual(verifierHash, verifierHash2, 'Same password + salt must yield identical verifier');

  // 4. Wrong password must produce differing verifier
  const wrongKey = await deriveKeyFromPassword('WrongPassword123!', salt);
  const wrongVerifier = await computeKeyVerifier(wrongKey);
  assert.notStrictEqual(verifierHash, wrongVerifier, 'Different password must yield different verifier');

  // 5. Encrypt sensitive payload
  const sensitiveNote = {
    title: 'Our Secret Trip to Switzerland',
    hotelReservation: 'CH-48912-LUX',
    personalNotes: 'Remember to pack warm sweaters and secret anniversary gift 💍',
  };

  const { ciphertext, iv } = await encryptPayload(sensitiveNote, key);
  assert.ok(ciphertext, 'Ciphertext must be generated');
  assert.ok(iv, 'IV must be generated');
  assert.notStrictEqual(ciphertext, JSON.stringify(sensitiveNote), 'Ciphertext must not contain plaintext');

  // 6. Decrypt payload with key
  const decrypted = await decryptPayload(ciphertext, iv, key);
  assert.deepStrictEqual(decrypted, sensitiveNote, 'Decrypted object must match original plaintext exactly');

  // 7. Decryption with wrong key must fail
  await assert.rejects(
    async () => {
      await decryptPayload(ciphertext, iv, wrongKey);
    },
    /operation failed|bad signature|decryption failed/i,
    'Decryption with wrong key must throw an error'
  );
});
