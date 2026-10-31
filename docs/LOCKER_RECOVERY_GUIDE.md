# OUR LOCKER — Multi-Device Recovery & Restoration Guide

## 1. Multi-Device Recovery Scenarios
OUR LOCKER supports zero-knowledge recovery across:
- New Android or iOS smartphones.
- Laptops, PCs, and web browsers.
- Fresh installations of OURSPACE.
- Password change or forgotten master password scenarios.

---

## 2. Recovery Prerequisites
To restore an encrypted locker on a new device, the user must provide:
1. **Authenticated Account**: Login via Firebase Authentication (email/password or verified credentials).
2. **One of the Following Secrets**:
   - Master Vault Password, **OR**
   - 256-Bit High-Entropy Recovery Key (`RCV-XXXX-XXXX-XXXX-...`).

---

## 3. Restoration Step-by-Step

### Scenario A: Unlocking on a Secondary Device with Master Password
1. Navigate to `/dashboard/locker`.
2. Enter the Master Password.
3. The device retrieves the user's `LockerMetadata` and `key_envelope`.
4. The device derives the wrapping key using PBKDF2 (100k rounds) with the stored salt.
5. The device unwraps the 256-bit AES-GCM Master Key.
6. The Master Key decrypts all personal vault records locally in memory.

### Scenario B: Recovering Vault When Master Password is Forgotten
1. Navigate to `/dashboard/locker`.
2. Click **"Lost Password? Use Recovery Key"**.
3. Paste the 256-bit recovery key (`RCV-XXXX-XXXX-...`).
4. The device derives the recovery wrapping key using PBKDF2 with `recovery_salt`.
5. The device unwraps the Master Key from `recovery_wrapped_master_key`.
6. The vault unlocks immediately.
7. The user can navigate to **Settings → Change Master Password** to establish a new password without losing any encrypted notes or cloud backups.

### Scenario C: Restoring from Cloud Backup
1. Inside the unlocked locker, click **"Cloud Backup"**.
2. Click **"Restore from Backup"**.
3. The application downloads the most recent verified encrypted snapshot.
4. The Master Key decrypts the snapshot bundle and verifies the SHA-256 ciphertext hash against the manifest.
5. Restored items populate the user's personal vault with full folder hierarchy and secret attributes preserved.
