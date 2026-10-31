# OURSPACE V2.4.1 — OUR LOCKER Cryptographic Encryption Architecture

## 1. Executive Summary
OURSPACE V2.4.1 extends the privacy-first couple sanctuary with a Zero-Knowledge Cryptographic Key Hierarchy for **OUR LOCKER** and automated client-side encrypted Google Drive backups.

Under this architecture:
- Encryption nonces (IVs) and Master Keys are generated entirely on the user's client device.
- Plaintext notes, passwords, credentials, and recovery keys **never** leave the browser/native app.
- Google Drive and Firebase receive **only opaque identifiers and authenticated AES-GCM 256-bit ciphertext**.
- System administrators, Firebase Functions, and external cloud storage providers cannot decrypt locker payloads.

---

## 2. Cryptographic Standards & Primitives

| Component | Primitive / Standard | Parameters / Details |
| :--- | :--- | :--- |
| **Symmetric Cipher** | AES-GCM (Authenticated Encryption) | 256-bit key, unique 12-byte initialization vector (IV) per encryption operation. |
| **Key Derivation (KDF)** | PBKDF2 with SHA-256 | 100,000 iterations, 16-byte cryptographically secure random salt. |
| **Master Key** | Random AES-GCM 256-bit CryptoKey | Generated via `crypto.subtle.generateKey`, extractable only for client-side wrapping. |
| **Key Wrapping** | Authenticated AES-GCM Key Envelope | Master key is encrypted with the password-derived wrapping key using a dedicated IV. |
| **Recovery Key** | High-Entropy 256-Bit Token | Formatted as `RCV-XXXX-XXXX-XXXX-...`, wraps master key with separate salt & IV. |
| **Integrity Verification** | SHA-256 Digest | Authenticates concatenated ciphertext records before marking backups as verified. |

---

## 3. Key Hierarchy & Envelope Model

```
                    ┌────────────────────────────┐
                    │ Master Password (User)     │
                    └─────────────┬──────────────┘
                                  │ PBKDF2 (100k rounds + Salt)
                                  ▼
                    ┌────────────────────────────┐
                    │ Key Wrapping Key (AES-GCM) │
                    └─────────────┬──────────────┘
                                  │ Wraps (Encrypts)
                                  ▼
 ┌──────────────────────────────────────────────────────────────┐
 │               Locker Master Key (256-bit AES-GCM)            │
 └──────┬──────────────────────┬──────────────────────────┬─────┘
        │                      │                          │
        ▼                      ▼                          ▼
  Private Notes        Secret Documents          Encrypted Backups
```

### Advantages of the Envelope Design:
1. **Zero-Knowledge**: Master password is never stored anywhere; only a SHA-256 verifier hash of the wrapping key is recorded to validate entry attempts.
2. **Safe Password Changes**: When a user changes their vault password, only the **Master Key Envelope** is re-wrapped with the new password's wrapping key. All existing encrypted notes, photographs, and Google Drive backup snapshots remain 100% valid without requiring a full re-encryption of all stored assets.
3. **Multi-Device Recovery**: A user can restore on a new phone or laptop by providing their Firebase authentication credentials plus either their Master Password or their 256-bit Recovery Key.

---

## 4. Encryption Invariants & Safeguards
- **Unique IV Nonce Guarantee**: Every item encryption invokes `crypto.getRandomValues(new Uint8Array(12))` to ensure nonces are never reused with the same key.
- **Zero Base64 Payloads in Firestore**: Large image and binary attachments are saved in Firebase Storage or Google Drive as encrypted streams, saving only lightweight cryptographic metadata in Firestore documents.
- **Ephemeral Session Key**: Active CryptoKey references are held strictly in memory during an active session and wiped after 5 minutes of inactivity or upon manual lock.
