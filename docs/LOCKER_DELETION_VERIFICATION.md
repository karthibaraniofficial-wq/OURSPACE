# OUR LOCKER — Permanent Deletion & Verification State Machine

## 1. Requirement & Threat Model
In zero-knowledge storage systems, resetting a vault without fully deleting existing encrypted payloads can leave orphaned ciphertext in cloud databases.

To eliminate this vulnerability, OUR LOCKER enforces a **7-stage atomic deletion state machine**:

```
ACTIVE
  │
  ▼ User types exact confirmation: "DELETE MY LOCKER"
LOCKED_FOR_DELETION
  │
  ▼ Delete all Firestore encrypted items, folders, and notes
FIREBASE_PURGING
  │
  ▼ Delete all Google Drive and cloud encrypted backup snapshots
DRIVE_PURGING
  │
  ▼ Erase vault metadata, verifier hashes, and key wrappers
METADATA_PURGING
  │
  ▼ Verify zero residual records exist across all collections
VERIFYING_ALL_LOCATIONS
  │
  ▼ Zeroize in-memory cryptographic key references
OLD_KEYS_DESTROYED
  │
  ▼ Vault unlocked for fresh initialization
READY_FOR_NEW_LOCKER
```

---

## 2. Verification Guarantees
Before `READY_FOR_NEW_LOCKER` is reached:
1. `users/{uid}/personalVault/default/items` query returns `empty == true`.
2. `users/{uid}/secureLockerBackups` query returns `empty == true`.
3. `users/{uid}/personalVault/default` document is confirmed non-existent (`exists == false`).
4. If any location retains residual data, the wipe operation aborts and displays an error, preventing the creation of a new locker key until complete deletion is verified.
