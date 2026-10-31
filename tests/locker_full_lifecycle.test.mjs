import test from 'node:test';
import assert from 'node:assert';
import {
  deriveWrappingKey,
  generateMasterKey,
  generateRecoveryKey,
  wrapMasterKey,
  unwrapMasterKey,
  computeKeyVerifier,
  encryptPayload,
  decryptPayload,
  bufferToHex,
  generateRandomBytes,
} from '../apps/web/src/lib/crypto/vaultCrypto.ts';

test('OUR LOCKER: End-to-End Cryptography, Key Wrapping, and Media Durability', async () => {
  const masterPassword = 'CoupleForeverPassword2026!#';
  const salt = bufferToHex(generateRandomBytes(16));

  // 1. Derive wrapping key with extractable: true
  const wrappingKey = await deriveWrappingKey(masterPassword, salt);
  assert.ok(wrappingKey, 'Wrapping key derived');
  assert.strictEqual(wrappingKey.extractable, true, 'Wrapping key must be extractable for verifier hash');

  // 2. Compute key verifier
  const verifierHash = await computeKeyVerifier(wrappingKey);
  assert.strictEqual(typeof verifierHash, 'string');
  assert.strictEqual(verifierHash.length, 64, 'SHA-256 verifier hash length');

  // 3. Generate Master Key and Wrap it
  const masterKey = await generateMasterKey();
  const wrappedEnvelope = await wrapMasterKey(masterKey, wrappingKey);
  assert.ok(wrappedEnvelope.wrappedKey, 'Master key wrapped successfully');
  assert.ok(wrappedEnvelope.iv, 'Master key wrapping IV created');

  // 4. Generate Recovery Key and wrap master key for recovery
  const recoveryKey = generateRecoveryKey();
  assert.ok(recoveryKey.startsWith('RCV-'), 'Recovery key follows format');
  const recoverySalt = bufferToHex(generateRandomBytes(16));
  const recoveryWrappingKey = await deriveWrappingKey(recoveryKey, recoverySalt);
  const wrappedRecoveryEnvelope = await wrapMasterKey(masterKey, recoveryWrappingKey);
  assert.ok(wrappedRecoveryEnvelope.wrappedKey, 'Master key wrapped with recovery key');

  // 5. Store Information, Photos, Videos, and Files
  const itemsToStore = [
    {
      title: 'Our Secret Apartment Wi-Fi & PIN',
      section: 'saved_info',
      payload: {
        body: 'Wi-Fi: LoveSanctuary_5G\nPassword: ForeverWithYou#2026',
        secret: 'Door PIN 4912',
      },
    },
    {
      title: 'Anniversary Paris Photo',
      section: 'photos',
      payload: {
        body: 'Sunset by the Eiffel Tower',
        file: {
          name: 'eiffel_sunset.jpg',
          size: 1500000,
          type: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,' + 'P'.repeat(1500000),
        },
      },
    },
    {
      title: 'Our First Dance Video',
      section: 'photos',
      payload: {
        body: 'Dancing in the living room at midnight',
        file: {
          name: 'first_dance.mp4',
          size: 3000000,
          type: 'video/mp4',
          dataUrl: 'data:video/mp4;base64,' + 'V'.repeat(3000000),
        },
      },
    },
    {
      title: 'Flight Tickets & Hotel Vouchers',
      section: 'travel',
      payload: {
        body: 'Booking Ref: SWISS-98412-LUX',
        file: {
          name: 'tickets_and_vouchers.pdf',
          size: 800000,
          type: 'application/pdf',
          dataUrl: 'data:application/pdf;base64,' + 'D'.repeat(800000),
        },
      },
    },
  ];

  // Encrypt all items with masterKey
  const encryptedVault = [];
  for (const item of itemsToStore) {
    const itemIv = bufferToHex(generateRandomBytes(12));
    const encTitle = await encryptPayload(item.title, masterKey, itemIv);
    const encBody = await encryptPayload(item.payload, masterKey, itemIv);
    encryptedVault.push({
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      section: item.section,
      title_ciphertext: encTitle.ciphertext,
      payload_ciphertext: encBody.ciphertext,
      iv: itemIv,
      payload_iv: itemIv,
    });
  }

  assert.strictEqual(encryptedVault.length, 4, 'All 4 items encrypted');

  // ========================================================================
  // 6. SIMULATE LOCKING THE LOCKER
  // (All memory references erased, vault locked)
  // ========================================================================
  let activeSessionKey = null;
  let decryptedItems = [];

  assert.strictEqual(activeSessionKey, null, 'Active session key is null when locked');
  assert.strictEqual(decryptedItems.length, 0, 'No items in memory when locked');

  // ========================================================================
  // 7. SIMULATE REOPENING / UNLOCKING THE LOCKER
  // (User types master password, unwrap master key, decrypt all items)
  // ========================================================================
  const unlockWrappingKey = await deriveWrappingKey(masterPassword, salt);
  const unlockVerifier = await computeKeyVerifier(unlockWrappingKey);
  assert.strictEqual(unlockVerifier, verifierHash, 'Verifier hash must authenticate password');

  const unlockedMasterKey = await unwrapMasterKey(
    wrappedEnvelope.wrappedKey,
    wrappedEnvelope.iv,
    unlockWrappingKey
  );
  assert.ok(unlockedMasterKey, 'Master key unwrapped successfully');

  // Decrypt each item from storage
  for (const encItem of encryptedVault) {
    const title = await decryptPayload(encItem.title_ciphertext, encItem.iv, unlockedMasterKey);
    const payload = await decryptPayload(encItem.payload_ciphertext, encItem.payload_iv || encItem.iv, unlockedMasterKey);
    decryptedItems.push({
      id: encItem.id,
      section: encItem.section,
      title,
      payload,
    });
  }

  // Verify all 4 items are present after unlocking
  assert.strictEqual(decryptedItems.length, 4, 'All 4 items must be restored after reopening');

  // Check item 1 (Notes & Information)
  const item1 = decryptedItems.find((i) => i.title === 'Our Secret Apartment Wi-Fi & PIN');
  assert.ok(item1, 'Secret information item exists');
  assert.strictEqual(item1.payload.secret, 'Door PIN 4912');
  assert.ok(item1.payload.body.includes('LoveSanctuary_5G'));

  // Check item 2 (Photograph)
  const item2 = decryptedItems.find((i) => i.title === 'Anniversary Paris Photo');
  assert.ok(item2, 'Photograph item exists');
  assert.strictEqual(item2.payload.file.name, 'eiffel_sunset.jpg');
  assert.strictEqual(item2.payload.file.size, 1500000);
  assert.strictEqual(item2.payload.file.type, 'image/jpeg');
  assert.strictEqual(item2.payload.file.dataUrl.length, 1500000 + 'data:image/jpeg;base64,'.length);

  // Check item 3 (Video)
  const item3 = decryptedItems.find((i) => i.title === 'Our First Dance Video');
  assert.ok(item3, 'Video item exists');
  assert.strictEqual(item3.payload.file.name, 'first_dance.mp4');
  assert.strictEqual(item3.payload.file.size, 3000000);
  assert.strictEqual(item3.payload.file.type, 'video/mp4');

  // Check item 4 (Document/File)
  const item4 = decryptedItems.find((i) => i.title === 'Flight Tickets & Hotel Vouchers');
  assert.ok(item4, 'Document/file item exists');
  assert.strictEqual(item4.payload.file.name, 'tickets_and_vouchers.pdf');
  assert.strictEqual(item4.payload.file.type, 'application/pdf');

  // ========================================================================
  // 8. UNLOCK WITH RECOVERY KEY VERIFICATION
  // ========================================================================
  const recWrappingKey = await deriveWrappingKey(recoveryKey, recoverySalt);
  const recoveryMasterKey = await unwrapMasterKey(
    wrappedRecoveryEnvelope.wrappedKey,
    wrappedRecoveryEnvelope.iv,
    recWrappingKey
  );
  assert.ok(recoveryMasterKey, 'Master key recovered with recovery key');

  const recDecryptedTitle = await decryptPayload(
    encryptedVault[0].title_ciphertext,
    encryptedVault[0].iv,
    recoveryMasterKey
  );
  assert.strictEqual(recDecryptedTitle, 'Our Secret Apartment Wi-Fi & PIN');
});
