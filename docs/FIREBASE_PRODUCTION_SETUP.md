# OURSPACE — Firebase Production Setup & Deployment Manual

This manual provides the step-by-step procedure for provisioning, configuring, and verifying the production Google Firebase backend for OURSPACE.

---

## 1. Project Initialization & Regional Placement

1. Navigate to the **[Firebase Console](https://console.firebase.google.com/)**.
2. Click **Add project** -> Name: `ourspace-production` (or your preferred identifier).
3. Select Google Analytics (recommended for crash and telemetry insights) or skip.
4. **Choose Regional Location**:
   - For lowest latency across North America: `us-central1` (Iowa).
   - For lowest latency across Asia: `asia-south1` (Mumbai) or `asia-east1`.
   - Ensure Cloud Firestore, Cloud Storage, and Cloud Functions are co-located in the same region.

---

## 2. Firebase Authentication Production Setup

1. In the left navigation, click **Build** -> **Authentication** -> **Get started**.
2. **Sign-in method**:
   - Enable **Email/Password**.
   - (Optional) Enable Email link (passwordless) or keep email/password standard.
3. **Authorized Domains**:
   Under **Settings** -> **Authorized domains**, add:
   - `ourspace.app`
   - `www.ourspace.app`
   - `<your-vercel-deployment>.vercel.app`
4. **Action URL & Password Reset**:
   Under **Templates** -> **Password reset**:
   - Customize sender name: "OURSPACE Sanctuary"
   - Action URL: `https://ourspace.app/auth?mode=resetPassword`

---

## 3. Cloud Firestore Production Setup

1. In Firebase Console, click **Build** -> **Firestore Database** -> **Create database**.
2. Select **Production mode** (Security rules will be deployed via CLI).
3. Select your co-located database region.
4. **Deploy Security Rules & Composite Indexes**:
   From your terminal in the workspace root:
   ```bash
   firebase login
   firebase use ourspace-production
   firebase deploy --only firestore:rules,firestore:indexes
   ```
5. **Verify Rules Enforcement**:
   - Rules strictly enforce authentication, space isolation (`isMemberOfSpace`), and 2-member limit ceiling.
   - Run verification tests locally: `npm test`.

---

## 4. Firebase Cloud Storage Production Setup

1. Click **Build** -> **Storage** -> **Get started**.
2. Choose **Production mode** and co-located region.
3. **Deploy Storage Rules**:
   ```bash
   firebase deploy --only storage
   ```
4. **Configure CORS for Web Lightbox & Resumable Uploads**:
   Create a local file `cors.json`:
   ```json
   [
     {
       "origin": ["https://ourspace.app", "https://*.vercel.app"],
       "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "x-goog-resumable"]
     }
   ]
   ```
   Deploy via Google Cloud SDK:
   ```bash
   gcloud storage buckets update gs://your-project.appspot.com --cors-file=cors.json
   ```

---

## 5. Firebase Cloud Functions (v2) Deployment

1. Install dependencies in `functions/`:
   ```bash
   cd functions
   npm install
   cd ..
   ```
2. **Store LiveKit Production Secrets**:
   ```bash
   firebase functions:secrets:set LIVEKIT_API_KEY
   firebase functions:secrets:set LIVEKIT_API_SECRET
   ```
3. **Deploy All Functions**:
   ```bash
   firebase deploy --only functions
   ```
4. **Deployed Function Endpoints**:
   - `onSpaceMemberCreate`: Eventarc trigger on Firestore document creation.
   - `onNewMessageNotification`: Background trigger for instant partner notification.
   - `checkScheduledReminders`: Cloud Scheduler cron triggering every 1 minute.
   - `getLiveKitToken`: Callable HTTPS function issuing short-lived room tokens.

---

## 6. Firebase Cloud Messaging (FCM) & Web Push VAPID

1. In Firebase Console, go to **Project Settings** -> **Cloud Messaging**.
2. Under **Web configuration**, click **Generate key pair**.
3. Copy the public key string (e.g. `BN...`) and set it as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. Ensure `apps/web/public/firebase-messaging-sw.js` is served from the root domain.

---

## 7. Firebase App Check (Anti-Abuse Protection)

1. Under **Build** -> **App Check**, register your apps:
   - **Web**: Register reCAPTCHA v3. Set your secret key in Google Cloud Console.
   - **Android**: Register Play Integrity.
   - **iOS**: Register DeviceCheck or App Attest.
2. **Monitoring Mode**: Keep enforcement in **Monitoring** mode for the first 48 hours to confirm legitimate users are not blocked, then switch to **Enforce**.
