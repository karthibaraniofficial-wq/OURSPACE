# OUR LOCKER: CLIENT-SIDE CRYPTOGRAPHIC SECURITY ARCHITECTURE

## 1. Executive Summary
**OUR LOCKER** is an end-to-end client-side encrypted vault designed to safeguard sensitive couple data, personal identification, private letters, credentials, and confidential memories. Security is enforced through authenticated encryption where neither Google Firebase nor server intermediaries possess plaintext keys or unencrypted records.

---

## 2. Cryptographic Specifications

| Component | Standard / Algorithm | Parameters |
|---|---|---|
| **Key Derivation Function** | PBKDF2 (RFC 2898) | 100,000 rounds, SHA-256 pseudo-random function |
| **Symmetric Cipher** | AES-GCM (NIST SP 800-38D) | 256-bit key length, 128-bit authentication tag |
| **Initialization Vector (IV)** | Cryptographic Nonce | 12 bytes (96 bits) per-payload via `getRandomValues` |
| **User Salt** | Cryptographic Salt | 16 bytes (128 bits) per-vault |
| **Verifier Digest** | SHA-256 (FIPS 180-4) | Key-derived hash for password validation |
| **Runtime Environment** | Web Cryptography API | Native browser `crypto.subtle` / Node `globalThis.crypto` |

---

## 3. Key Hierarchy & Derivation Flow

```
User Master Password
        │
        ├── + User Salt (16 bytes random)
        ▼
   PBKDF2-HMAC-SHA256 (100,000 iterations)
        │
        ▼
  AES-GCM 256-bit CryptoKey (held in volatile RAM only)
        │
        ├── SHA-256 Hash ──────► Key Verifier String (Stored in Firestore)
        │
        ▼
  Per-Item Encryption
  (Unique 12-byte IV generated for every item)
        │
        ▼
  AES-GCM Authenticated Ciphertext (Base64)
```

### Zero-Knowledge Guarantees
1. **Master Password Never Transmitted**: The plaintext master password is never sent to Firebase, Cloud Functions, or logs.
2. **Key Material Never Persisted**: The derived `CryptoKey` exists exclusively in volatile memory within the active browser tab. Refreshing or locking the tab immediately drops the reference.
3. **Verifier Validation**: On unlock, the entered password is used to re-derive the key, compute its SHA-256 hash, and compare it with the stored verifier. If a match occurs, access is granted.

---

## 4. Vault Sections & Field-Level Encryption
The locker organizes sensitive records into 10 structured categories:
1. **Private Notes**: Long-form secret reflections and personal notes.
2. **Important Personal Details**: Identifiers, policy numbers, account details (disclosed as personal companion storage, not an audited enterprise password manager).
3. **Private Documents**: Encrypted document payloads.
4. **Important Dates**: Secret anniversaries and surprise dates.
5. **Saved Information**: WiFi codes, apartment access pins, gate instructions.
6. **Personal Letters**: Confidential correspondence.
7. **Travel Information**: Passports, visa numbers, flight booking codes.
8. **Emergency Information**: Emergency contacts, medical directives.
9. **Private Photographs**: Encrypted photo data URLs.
10. **Custom Categories**: User-defined custom folders.

---

## 5. Session Security & Failed Attempt Protection
- **Auto-Lock Timeout**: Automatically clears active session key after 5 minutes of operator inactivity.
- **Progressive Lockout**:
  - 3 failed attempts: 15-second temporary lockout.
  - 5 failed attempts: 60-second lockout.
- **Exporting Decrypted Data**: An explicit "Export Data" action generates an unencrypted JSON snapshot upon user confirmation for personal backups.
