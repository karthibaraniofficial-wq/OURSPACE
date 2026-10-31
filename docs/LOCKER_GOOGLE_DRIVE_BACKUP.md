# OUR LOCKER — Google Drive Encrypted Cloud Backup Specification

## 1. Overview
OUR LOCKER contents are excluded from normal, unencrypted couple media archival. Instead, OUR LOCKER uses an **authenticated client-side encrypted backup engine** that synchronizes opaque ciphertext snapshots to Google Drive.

---

## 2. Target Folder Structure

```
OURSPACE_ARCHIVE/
└── SECURE_LOCKER_BACKUPS/
    └── {opaque-vault-id}/
        ├── encrypted-snapshot-1793460000000
        ├── encrypted-snapshot-1793460120000
        └── encrypted-manifest
```

### Privacy & Data Exposure Prevention:
- **Folder Names**: `{opaque-vault-id}` is derived from a one-way salt hash (e.g. `vault_a8b9c0d1`).
- **File Names**: Snapshots use opaque identifiers (`encrypted-snapshot-{timestamp}`).
- **Zero Plaintext**: Note titles, folder names, personal letters, passwords, and file extensions are encrypted **before** uploading.
- Google Drive metadata displays only binary ciphertext streams.

---

## 3. Backup Pipeline & Verification Lifecycle

```
[User Locker Items]
        │
        ▼ Client-Side AES-GCM 256-bit Encryption
[Encrypted Bundle + Manifest]
        │
        ▼ Compute SHA-256 Digest of All Ciphertexts
[Ciphertext Integrity Hash]
        │
        ▼ Resumable Chunked Upload
[Google Drive & Firebase Backup Store]
        │
        ▼ Read-back & Verification
[Status Marked: VERIFIED]
```

### Verification Standard:
Before a backup is marked as `VERIFIED`:
1. All individual ciphertext blocks are concatenated in deterministic sorted order and hashed using SHA-256.
2. The manifest payload is encrypted with the Master Key and contains the item count and ciphertext hash.
3. The server/cloud storage confirms receipt of the complete byte length.
4. If integrity verification succeeds, the vault status transitions to `VERIFIED`.
5. If Google Drive is temporarily unreachable, local and Firebase encrypted copies are retained and a retry queue is maintained without data loss.

---

## 4. Exclusion from Standard Media Archival
Normal chat images and gallery memories follow the 6-day photo archival rule when Google Drive is connected. **OUR LOCKER is explicitly exempt from standard media archival**; it is only backed up as an authenticated encrypted snapshot and will never have its contents decrypted or deleted by background media cleaning routines.
