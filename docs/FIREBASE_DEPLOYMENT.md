# OURSPACE — Firebase Production Deployment Guide

## 1. Firebase Project Initialization
1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project named `ourspace-production`.
2. Enable the following services in the console:
   - **Authentication**: Enable Email/Password provider.
   - **Cloud Firestore**: Create database in `eur3` or `nam5` (multi-region recommended).
   - **Storage**: Initialize default Cloud Storage bucket.
   - **Cloud Messaging (FCM)**: Generate Web Push VAPID key pair under Project Settings -> Cloud Messaging.
   - **App Check** (Optional but recommended): Register web domain and mobile bundle IDs.

## 2. Deploying Security Rules & Indexes via Firebase CLI
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Google account
firebase login

# Set active project
firebase use ourspace-production

# Deploy Firestore rules & composite indexes
firebase deploy --only firestore

# Deploy Storage security rules
firebase deploy --only storage

# Deploy Cloud Functions
firebase deploy --only functions
```

## 3. Web Client Environment Setup (Vercel)
In Vercel (or hosting provider), configure environment variables:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ourspace-production.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ourspace-production
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ourspace-production.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BN...
```

## 4. Local Emulator Testing
To run the Firebase Local Emulator Suite locally:
```bash
firebase emulators:start
```
The emulator UI will be available at `http://localhost:4000` running Auth, Firestore, Storage, Realtime Database, and Functions locally without cloud billing.
