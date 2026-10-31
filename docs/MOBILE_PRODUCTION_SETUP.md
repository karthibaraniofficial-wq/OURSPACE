# OURSPACE — Mobile Production Deployment & Connectivity Guide

This document defines the production build and deployment pipeline for the OURSPACE native mobile applications (Android and iOS). It ensures direct, zero-localhost connectivity to public cloud services (Firebase, Cloud Functions, and LiveKit Cloud).

---

## 1. Architecture & Network Overview

The mobile apps communicate directly with public cloud infrastructure:
```text
Mobile Device (Android / iOS)
  ├── Cellular 4G/5G (Jio, Airtel, T-Mobile, AT&T) / Wi-Fi
  │     ├── Firebase Auth (HTTPS: identitytoolkit.googleapis.com)
  │     ├── Cloud Firestore (WSS/gRPC: firestore.googleapis.com)
  │     ├── Firebase Storage (HTTPS: firebasestorage.googleapis.com)
  │     ├── Cloud Functions v2 (HTTPS: https://<region>-<project>.cloudfunctions.net)
  │     └── LiveKit SFU (WSS/WebRTC: wss://ourspace.livekit.cloud)
  └── Push Notifications
        ├── Android: Firebase Cloud Messaging (FCM HTTP v1)
        └── iOS: Apple Push Notification service (APNs via Firebase FCM)
```

No local servers or private IP addresses are referenced in production mobile builds.

---

## 2. Android Production Configuration

### 2.1 Firebase Configuration (`google-services.json`)
1. In the **Firebase Console** -> **Project Settings** -> **General** -> **Your apps**:
   - Add Android App with package name: `app.ourspace.client`
   - Download the production `google-services.json`.
2. Place the file at:
   ```text
   apps/mobile/android/app/google-services.json
   ```
3. Never commit real production `google-services.json` to public repositories.

### 2.2 Release Keystore Generation
Generate a cryptographically secure production signing key:
```bash
keytool -genkey -v -keystore ourspace-release.keystore \
  -alias ourspace -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_SECURE_PASSWORD -keypass YOUR_SECURE_PASSWORD \
  -dname "CN=OURSPACE, OU=Engineering, O=Ourspace App, L=San Francisco, ST=CA, C=US"
```
Place `ourspace-release.keystore` securely in your CI/CD secrets vault or local secret storage.

Configure `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=ourspace-release.keystore
MYAPP_RELEASE_KEY_ALIAS=ourspace
MYAPP_RELEASE_STORE_PASSWORD=YOUR_SECURE_PASSWORD
MYAPP_RELEASE_KEY_PASSWORD=YOUR_SECURE_PASSWORD
```

### 2.3 Notification Channels
Android 8.0+ requires notification channels for high-priority alerts:
- Channel ID: `ourspace_messages`
  - Name: "Messages & Memories"
  - Importance: `HIGH` (Sound + Heads-up display)
- Channel ID: `ourspace_calls`
  - Name: "Incoming Calls"
  - Importance: `MAX` (Full-screen intent, continuous ring)

### 2.4 Proguard / R8 Rules for LiveKit & WebRTC
In `android/app/proguard-rules.pro`, protect WebRTC reflection:
```proguard
-keep class io.livekit.** { *; }
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
```

### 2.5 Building Android Release APK & AAB
Using Expo Application Services (EAS):
```bash
cd apps/mobile
npx eas-cli build --platform android --profile production
```
Or native Gradle standalone build:
```bash
cd apps/mobile/android
./gradlew bundleRelease  # For Google Play (.aab)
./gradlew assembleRelease # For direct APK distribution (.apk)
```

---

## 3. iOS Production Configuration

### 3.1 Firebase Configuration (`GoogleService-Info.plist`)
1. In the **Firebase Console**, add an iOS app with bundle identifier:
   `app.ourspace.client`
2. Download `GoogleService-Info.plist` and place it at:
   ```text
   apps/mobile/ios/GoogleService-Info.plist
   ```

### 3.2 Apple Push Notification service (APNs) & VoIP
1. In the **Apple Developer Portal** (`developer.apple.com`):
   - Under **Certificates, Identifiers & Profiles** -> **Keys**:
   - Create an **APNs Auth Key** (`.p8` file) with **Apple Push Notifications service (APNs)** enabled.
   - Note the **Key ID** and your **Team ID**.
2. In the **Firebase Console**:
   - Go to **Project Settings** -> **Cloud Messaging** -> **Apple app configuration**.
   - Upload the APNs `.p8` Auth Key, Key ID, and Team ID.
3. For incoming video calls:
   - Configure **PushKit** framework with VoIP service certificate to ensure calls ring even when the app is killed or locked.

### 3.3 Required Capabilities in Xcode
- **Background Modes**:
  - `Remote notifications` (Background FCM data packets)
  - `Voice over IP` (VoIP call signaling)
  - `Audio, AirPlay, and Picture in Picture` (Background audio in calls)
- **Camera & Microphone Usage Descriptions**:
  - `NSCameraUsageDescription`: "OURSPACE requires camera access for private video calls with your partner."
  - `NSMicrophoneUsageDescription`: "OURSPACE requires microphone access for crystal-clear voice calls and audio notes."

### 3.4 Building iOS Release via EAS / Fastlane
```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
```

---

## 4. Deep Linking & Instant Pairing

OURSPACE supports seamless pairing across internet networks via custom URL schemes and Universal Links:

### 4.1 URL Schemes
- Custom Scheme: `ourspace://pair?code=ABC123XY`
- Universal Link (iOS): `https://ourspace.app/pair?code=ABC123XY`
- Android App Link: `https://ourspace.app/.well-known/assetlinks.json`

When a user taps an invite link from WhatsApp, SMS, or Email on any network:
1. The OS opens the OURSPACE app directly.
2. The invite code is extracted from the URL params.
3. The app authenticates and calls `redeemInviteCode` Cloud Function over HTTPS.
4. The two users are instantly linked to their private space without manual typing.

---

## 5. Mobile App Lifecycle & Network Recovery

Mobile devices experience frequent network handovers (leaving home Wi-Fi -> switching to 5G -> elevator dead zone -> re-connecting).

The mobile client implements automatic recovery:
1. **AppState Monitoring**:
   ```typescript
   AppState.addEventListener('change', (nextAppState) => {
     if (nextAppState === 'active') {
       // Refresh Firestore listeners and verify auth token validity
       reconnectServices();
     }
   });
   ```
2. **NetInfo Monitoring**:
   - Watches `NetInfo.addEventListener(state => ...)`
   - On connection restoration, triggers LiveKit `room.reconnect()` with ICE restart.
   - Flushes queued offline messages sequentially with idempotency keys.
