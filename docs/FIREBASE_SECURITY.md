# OURSPACE — Firebase Security Architecture & Threat Model

## 1. Zero-Trust Couple Isolation
OURSPACE provides extreme privacy protection for couples. Security is enforced at:
1. **Persistent Persisted Rules**: `firestore.rules` and `storage.rules` validate space membership on every document and file read/write.
2. **Atomic Invariant Enforcement**: The maximum 2-member space cap is verified atomically on invitation acceptance.
3. **Private File Storage**: Files stored in Firebase Cloud Storage are accessible only when `firestore.exists(/databases/(default)/documents/privateSpaces/$(spaceId)/members/$(request.auth.uid))` evaluates to true.
4. **Credential Isolation**: Firebase Admin credentials and LiveKit server secrets are restricted to trusted server environments (Cloud Functions / API routes).

---

## 2. Firestore Rule Assertions

```javascript
function isMemberOfSpace(spaceId) {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/privateSpaces/$(spaceId)/members/$(request.auth.uid));
}
```

This guarantees:
- Non-members cannot read chat messages, attachments, reactions, or receipts.
- Non-members cannot view or join WebRTC call sessions.
- Non-members cannot view shared reminders, anniversaries, or media vault items.

---

## 3. Storage Security Assertions
```javascript
match /spaces/{spaceId}/{category}/{fileName} {
  allow read: if isMemberOfSpace(spaceId);
  allow create: if isMemberOfSpace(spaceId) && isValidFileSize() && isValidMimeType();
  allow delete: if isMemberOfSpace(spaceId);
}
```
- Maximum file size: 50MB.
- Permitted types: images, videos, audio, PDF, office documents.

---

## 4. App Check & Abuse Protection
Firebase App Check verifies requests originate from authentic OURSPACE web clients (using reCAPTCHA v3 or Enterprise) and native mobile apps (using Play Integrity on Android and DeviceCheck/App Attest on iOS), blocking spoofed requests.
