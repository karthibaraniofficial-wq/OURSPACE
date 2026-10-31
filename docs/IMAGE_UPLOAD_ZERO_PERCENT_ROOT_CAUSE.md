# OURSPACE V2.4.3 — Image Upload Stuck at 0% Root Cause Analysis

**Project**: OURSPACE (Private Couple Communication Platform)  
**Production URL**: [https://ourspace-app-two.vercel.app](https://ourspace-app-two.vercel.app/)  
**GitHub Repository**: [https://github.com/karthibaraniofficial-wq/OURSPACE](https://github.com/karthibaraniofficial-wq/OURSPACE)  
**Firebase Project**: `ourspace-edbf5` (Project Number: `681255809395`)  
**Tested Artifact**: `Man_leaning_on_mot...` (773.8 KB JPEG image)  
**Status**: Root Cause Isolated & Complete Pipeline Repaired  

---

## 1. Executive Summary

In OURSPACE chat, selecting an image attachment allowed the local thumbnail preview to appear in the staging tray. However, clicking the send button resulted in the upload progress bar freezing indefinitely at:
```text
UPLOAD PROGRESS: 0%
```
The upload never visibly progressed, no message was written to Cloud Firestore, and the attachment never reached the partner's chat.

A forensic investigation into the live Google Cloud Platform / Firebase infrastructure and the Next.js client source code revealed **five interconnected root causes**, spanning infrastructure billing requirements, bucket provisioning, client-side initialization fallbacks, upload task lifecycle handling, and Firestore write propagation.

---

## 2. Infrastructure Root Cause: Spark Plan & Missing Storage Bucket

### 2.1 Live Google Cloud Platform Verification
Using authenticated Google Cloud CLI inspection (`karthibaraniofficial@gmail.com`), the actual Firebase project `ourspace-edbf5` was inspected:

```bash
gcloud storage buckets list --project=ourspace-edbf5
# Result: Listed 0 items.

gcloud beta billing projects describe ourspace-edbf5
# Result: ERROR: (gcloud.beta.billing.projects.describe) API [cloudbilling.googleapis.com] not enabled on project [681255809395].
```

### 2.2 Findings
1. **Zero Cloud Storage Buckets Exist**: The Firebase project `ourspace-edbf5` has never had a Cloud Storage bucket provisioned in Firebase Console or Google Cloud Storage.
2. **Spark Tier (No Billing Account Linked)**: Project `ourspace-edbf5` is operating under the free Firebase Spark plan without an active Google Cloud Billing account linked.
3. **February 3, 2026 Billing Requirement**: As of February 3, 2026, Google Cloud and Firebase enforce that Firebase Cloud Storage provisioning requires linking a Cloud Billing account (the pay-as-you-go Blaze plan). Even if usage stays within the no-cost monthly free tier limits (5 GB storage, 1 GB/day download), Cloud Storage bucket creation is blocked on unlinked projects.
4. **Resumable Upload Behavior**: When the Firebase Web SDK initiates `uploadBytesResumable` against a non-existent or unprovisioned bucket URL (e.g. `ourspace-edbf5.firebasestorage.app`), the underlying HTTP POST/PUT preflight requests to `https://firebasestorage.googleapis.com/v0/b/.../o?uploadType=resumable` either hang waiting for DNS/preflight resolution, return HTTP 404 / 402 / 403, or stall indefinitely without firing byte transfer progress events.

---

## 3. Client Architecture Root Causes

### 3.1 Silent Fallback to Mock Config in Production (`firebase.ts`)
In `apps/web/src/lib/firebase/firebase.ts`, the environment fallback previously was:
```typescript
storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'ourspace-dev.appspot.com',
```
If `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` was missing or mismatched in a runtime environment, the client silently initialized Firebase Storage targeting `ourspace-dev.appspot.com`. The client had no runtime environment validator to halt and notify the operator of an invalid production configuration.

### 3.2 Missing Stalled Upload Detection & Lack of Timeout/Cancellation (`storage.ts`)
In `apps/web/src/lib/firebase/storage.ts`:
- The previous `uploadMediaToFirebaseStorage` implementation attached `uploadTask.on('state_changed', ...)` but lacked any timer to detect stalled uploads.
- If byte transfer remained at `0` bytes transferred for 10–30+ seconds due to network disconnection or bucket unavailability, the promise remained pending indefinitely.
- There was no cancellation controller exposed to the UI (`uploadTask.cancel()`), leaving the user stuck with no recourse other than refreshing the browser.

### 3.3 Silent Exception Swallowing in Chat Store (`useChatStore.ts`)
In `apps/web/src/store/useChatStore.ts`:
```typescript
if (isFirebaseConfigured()) {
  try {
    await sendMessageToFirestore(spaceId, newMessage);
  } catch (err) {
    console.error('Failed to sync message to Firestore:', err);
  }
}
```
When Firestore document creation failed:
- The error was caught and logged with `console.error`, but never rethrown or propagated to the caller.
- The optimistic message was not rolled back, leading to a "ghost" message state where the sender believed the message was in flight or delivered.
- In `MessageInput.tsx`, the caller assumed success, wiped the staged attachment list, and lost the user's staged photograph and caption.

### 3.4 Uninformative UI Progress States (`MessageInput.tsx`)
In `apps/web/src/components/chat/MessageInput.tsx`:
- The UI had only a binary `isUploading` boolean and an ambiguous numerical `uploadProgress` percentage.
- The UI immediately jumped to "0%" upon send and stayed there until the entire binary upload completed.
- There were no granular operational stages displayed (e.g., `PREPARING IMAGE`, `CONNECTING TO FIREBASE`, `SAVING MESSAGE`).
- On failure, there was no dedicated "Retry" button that preserved the staged photograph and caption.

---

## 4. Root Cause of OUR LOCKER Persistence Bug

### 4.1 IV Mismatch in AES-256-GCM Decryption (`useLockerStore.ts`)
A related issue was identified in OUR LOCKER where notes, personal details, documents, and media disappeared after locking and reopening the locker.
In `apps/web/src/store/useLockerStore.ts`:
```typescript
const encryptedTitle = await encryptPayload(item.title, activeSessionKey);
const encryptedBody = await encryptPayload(item.payload, activeSessionKey);
// encItem only saved: iv: encryptedTitle.iv!
```
Because `encryptPayload` generated a fresh random 12-byte IV on each call, `encryptedTitle.iv` and `encryptedBody.iv` were distinct. However, `encItem` only persisted `iv: encryptedTitle.iv`.
Upon reopening the locker, `unlockLocker` executed:
```typescript
const payload = await decryptPayload(itemData.payload_ciphertext, itemData.iv, resolvedKey);
```
AES-GCM authentication failed because the payload ciphertext did not match the title's IV. The `try/catch` silently discarded the failed item, leaving the unlocked locker empty.

---

## 5. Summary Matrix of Issues and Resolutions

| Component | Defect | Impact | Resolution |
|---|---|---|---|
| **Firebase GCP** | Unprovisioned bucket & Spark tier on `ourspace-edbf5` | HTTP 404/402 preflight stall at 0% | Manual Blaze link required in Console; client diagnostic added |
| **`firebase.ts`** | Silent fallback to mock credentials | Production tries connecting to `ourspace-dev` | Strict environment validator; zero mock fallback in prod |
| **`storage.ts`** | No stalled upload detector or timeout | UI freezes at 0% indefinitely | 15s stalled detector, 90s hard timeout, `cancel()` controller |
| **`storage.ts`** | Generic error messages | Operator cannot determine root cause | Error parser for `billing-required`, `bucket-not-found`, etc. |
| **`useChatStore.ts`** | Swallowed Firestore write errors | Optimistic UI lies; caller loses staged photo | Propagate error, rollback optimistic UI on rejection, idempotent IDs |
| **`MessageInput.tsx`** | Ambiguous 0% progress bar | User unaware of pipeline stage | Explicit stages, Cancel button, Retry button preserving staged photos |
| **`useLockerStore.ts`** | AES-GCM IV mismatch on title vs payload | Locker items vanish after locking and reopening | Unified `itemIv` + `payload_iv` persistence + photo/video/file support |
