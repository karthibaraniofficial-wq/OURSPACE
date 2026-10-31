# OUR LOCKER — Key Management & Key Lifecycle Specification

## 1. Key Hierarchy
OUR LOCKER uses a 3-layer key hierarchy:

```
[Master Password] ──> PBKDF2(100k, salt) ──> [Password Wrapping Key] ──┐
                                                                         ├──> [Master Key Envelope]
[Recovery Key]    ──> PBKDF2(100k, salt) ──> [Recovery Wrapping Key] ──┘         │
                                                                                 │ Unwraps
                                                                                 ▼
                                                                       [Locker Master Key (AES-GCM 256)]
                                                                                 │
                                                                                 ▼
                                                                      [Item Payloads & Snapshots]
```

---

## 2. Key Lifecycle Operations

### A. Vault Initialization
1. Generate random 256-bit AES-GCM Master Key `K_m`.
2. Generate 256-bit high-entropy Recovery Key `K_r`.
3. Generate 16-byte random salt `S_p` for password and `S_r` for recovery key.
4. Derive Password Wrapping Key `W_p = PBKDF2(password, S_p, 100000, SHA-256)`.
5. Derive Recovery Wrapping Key `W_r = PBKDF2(K_r, S_r, 100000, SHA-256)`.
6. Wrap `K_m` with `W_p` -> `E_p = AES-GCM-Encrypt(W_p, K_m, IV_p)`.
7. Wrap `K_m` with `W_r` -> `E_r = AES-GCM-Encrypt(W_r, K_m, IV_r)`.
8. Store `{ E_p, IV_p, S_p, E_r, IV_r, S_r }` in Firestore `users/{uid}/personalVault/default`.

### B. Safe Password Rotation
1. Authenticate user with current password or recovery key.
2. Unwrap `K_m`.
3. Prompt user for new password (minimum 8 characters).
4. Generate new 16-byte salt `S_p_new`.
5. Derive new wrapping key `W_p_new`.
6. Wrap `K_m` with `W_p_new` using fresh 12-byte IV `IV_p_new`.
7. Update metadata envelope in Firestore.
8. **Result**: Vault password is changed; no items or backup files require re-encryption.

### C. In-Memory Key Hygiene
- The Master Key is stored only in an ephemeral module-scoped variable (`activeSessionKey`).
- When the vault is locked, `activeSessionKey` is set to `null` immediately.
- Auto-lock timer triggers after 5 minutes of operator inactivity, clearing `activeSessionKey`.
