# OURSPACE — Firebase Cloud Storage Production Configuration Guide

**Project**: OURSPACE (Private Couple Communication Platform)  
**Firebase Project ID**: `ourspace-edbf5`  
**Project Number**: `681255809395`  
**Target Bucket Name**: `ourspace-edbf5.firebasestorage.app` (or legacy `ourspace-edbf5.appspot.com`)  
**Billing Plan Requirement**: Blaze (Pay as you go) — Required by Firebase for Cloud Storage as of February 3, 2026.  

---

## 1. Firebase Cloud Storage Billing & Provisioning Status

### 1.1 Current Project Status
- **Current Plan**: Spark (Free tier without billing account).
- **Billing API Status**: `cloudbilling.googleapis.com` is **not enabled** on project `681255809395`.
- **Cloud Storage Bucket Status**: **0 buckets provisioned** (`gcloud storage buckets list --project=ourspace-edbf5` returned 0 items).

### 1.2 The February 3, 2026 Firebase Requirement
Google Cloud and Firebase now require projects to be linked to an active Cloud Billing account (the **Blaze plan**) to create and operate Firebase Cloud Storage buckets.

> **Important**: Operating on the Blaze plan does not automatically incur costs if your usage remains within the Firebase Free Tier allowance:
> - **5 GB** total stored data.
> - **1 GB/day** downloaded data.
> - **20,000 upload operations/day**.
> - **50,000 download operations/day**.
>
> However, a valid billing instrument must be linked in Google Cloud / Firebase Console to enable the bucket.

---

## 2. Step-by-Step Manual Upgrade & Provisioning Action

Per security guidelines and project rules, billing accounts cannot be activated autonomously by AI agents. Follow these manual steps:

### Step 1: Upgrade to Blaze Plan
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **`ourspace-edbf5`**.
3. In the lower-left navigation corner, click **Upgrade** (next to the "Spark plan" badge).
4. Select the **Blaze (Pay as you go)** plan.
5. Choose or link your existing Google Cloud Billing account and click **Purchase / Confirm**.
6. Set a **Budget Alert** (e.g. $1 or $5/month) to ensure zero unexpected charges.

### Step 2: Initialize Firebase Cloud Storage
1. In the left navigation menu of Firebase Console, click **Build** -> **Storage**.
2. Click **Get Started**.
3. When prompted to select security rules, choose **Start in production mode** (our repository's `storage.rules` will govern access).
4. Select your Cloud Storage location:
   - Recommended: **`us-central1`** or **`nam5`** (matches typical Firestore instance locations).
5. Click **Done**.
6. Note the exact bucket name shown in the Console header. It will appear as:
   ```text
   gs://ourspace-edbf5.firebasestorage.app
   ```
   *(Or `gs://ourspace-edbf5.appspot.com` if created with legacy naming).*

---

## 3. Verify Vercel Production Environment Variables

Ensure the Vercel project (`ourspace-app`) environment variables match the newly provisioned bucket:

| Environment Variable | Required Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `ourspace-edbf5` | Authoritative Firebase Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `ourspace-edbf5.firebasestorage.app` | Actual provisioned bucket URL (without `gs://`) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `ourspace-edbf5.firebaseapp.com` | Firebase Auth Domain |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | *(Production Web API Key)* | From Firebase Project Settings |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `681255809395` | Project Number |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:681255809395:web:...` | Web App Client ID |

---

## 4. Deploy Storage Security Rules

The repository includes hardened, space-isolated Storage Security Rules in [storage.rules](file:///e:/private%20chat%20app/storage.rules).

### 4.1 Storage Rules Architecture
```rules
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isMemberOfSpace(spaceId) {
      return isAuthenticated() &&
        firestore.exists(/databases/(default)/documents/privateSpaces/$(spaceId)/members/$(request.auth.uid));
    }

    function isValidFileSize() {
      return request.resource.size < 50 * 1024 * 1024; // 50MB ceiling
    }

    function isValidMimeType() {
      return request.resource.contentType.matches('image/.*') ||
             request.resource.contentType.matches('video/.*') ||
             request.resource.contentType.matches('audio/.*') ||
             request.resource.contentType.matches('application/pdf') ||
             request.resource.contentType.matches('application/msword') ||
             request.resource.contentType.matches('application/vnd.openxmlformats-officedocument.*') ||
             request.resource.contentType.matches('text/plain') ||
             request.resource.contentType.matches('application/zip');
    }

    // Space-isolated media directory (Images, Videos, Audio, Documents)
    match /spaces/{spaceId}/{category}/{allFiles=**} {
      allow read: if isMemberOfSpace(spaceId);
      allow create, update: if isMemberOfSpace(spaceId) && isValidFileSize() && isValidMimeType();
      allow delete: if isMemberOfSpace(spaceId);
    }

    // User-isolated encrypted locker / personal vault files
    match /users/{uid}/vault/{allVaultFiles=**} {
      allow read, write, delete: if isAuthenticated() && request.auth.uid == uid;
    }

    // User profile pictures
    match /users/{uid}/profile/{fileName} {
      allow read: if isAuthenticated();
      allow write, delete: if isAuthenticated() && request.auth.uid == uid && isValidFileSize();
    }

    // Default deny for all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 4.2 Deploy Rules via Firebase CLI
Once the bucket is provisioned in the console, deploy the rules directly:
```bash
firebase deploy --only storage --project ourspace-edbf5
```

---

## 5. Storage CORS Configuration for Web Browser Uploads

To allow web browsers on `https://ourspace-app-two.vercel.app` and `localhost:3000` to upload binary streams directly to Google Cloud Storage with resumable chunks, apply a CORS policy:

Create `cors.json`:
```json
[
  {
    "origin": [
      "https://ourspace-app-two.vercel.app",
      "https://ourspace.app",
      "http://localhost:3000"
    ],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": [
      "Content-Type",
      "Authorization",
      "Content-Length",
      "User-Agent",
      "x-goog-resumable"
    ],
    "maxAgeSeconds": 3600
  }
]
```

Apply via Google Cloud CLI:
```bash
gcloud storage buckets update gs://ourspace-edbf5.firebasestorage.app --cors-file=cors.json
```

---

## 6. Verification Checklist

- [ ] `gcloud storage buckets list --project=ourspace-edbf5` returns `gs://ourspace-edbf5.firebasestorage.app`.
- [ ] Vercel environment variable `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` matches the bucket name.
- [ ] `storage.rules` deployed without syntax errors.
- [ ] Chat upload test file (`Man_leaning_on_mot...`, 773.8 KB) moves through `CONNECTING TO FIREBASE` -> `UPLOADING X%` -> `SAVING MESSAGE` -> `SENT`.
- [ ] Uploaded image renders as a photograph in sender and recipient chat windows.
