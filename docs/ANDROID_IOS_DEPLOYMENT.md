# OURSPACE — Android & iOS Production Deployment Manual

This guide outlines the production packaging, code signing, and store submission process for the OURSPACE cross-platform mobile application (`apps/mobile`), powered by Expo SDK 51 and React Native.

---

## 1. Prerequisites

1. **Expo CLI & EAS CLI**:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. **Android Developer Account**: Google Play Console account ($25 one-time registration).
3. **Apple Developer Account**: Apple Developer Program enrollment ($99/year).
4. **Firebase Configuration**:
   - Android: `apps/mobile/android/app/google-services.json`
   - iOS: `apps/mobile/ios/GoogleService-Info.plist`

---

## 2. Project Identification & Manifest (`app.json`)

Verified configuration in [apps/mobile/app.json](file:///e:/private%20chat%20app/apps/mobile/app.json):
- **App Name**: `OURSPACE`
- **Slug**: `ourspace`
- **Bundle Identifier (iOS)**: `app.ourspace.client`
- **Package Name (Android)**: `app.ourspace.client`
- **Scheme**: `ourspace` (Universal URL and Deep Link scheme)
- **Permissions**:
  - `CAMERA`: Private video calling and photo sharing.
  - `RECORD_AUDIO`: Voice calling and voice notes.
  - `POST_NOTIFICATIONS`: Instant partner alerts.
  - `WAKE_LOCK`: Keeps call active during lockscreen.

---

## 3. EAS Build Configuration (`eas.json`)

Create `apps/mobile/eas.json`:
```json
{
  "cli": {
    "version": ">= 9.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "env": {
        "NEXT_PUBLIC_APP_URL": "https://ourspace.app",
        "NEXT_PUBLIC_LIVEKIT_URL": "wss://ourspace.livekit.cloud"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## 4. Building Android Release (.aab & .apk)

### 4.1 Cloud Build via EAS
Run inside `apps/mobile`:
```bash
eas build --platform android --profile production
```
- EAS automatically manages the production keystore and signs the Android App Bundle (`.aab`).
- Download the generated `.aab` file from the Expo dashboard.

### 4.2 Local Standalone Build via Gradle
```bash
cd apps/mobile/android
./gradlew bundleRelease  # Generates app-release.aab for Google Play
./gradlew assembleRelease # Generates standalone .apk for direct testing
```

### 4.3 Google Play Submission
1. Go to **Google Play Console** -> **Create app** -> Name: `OURSPACE`.
2. Under **Internal testing** or **Closed testing**:
   - Upload the `.aab` file.
   - Fill in Privacy Policy URL: `https://ourspace.app/privacy`.
   - Complete Data Safety Questionnaire (declare camera/mic for user-initiated calling).

---

## 5. Building iOS Release (.ipa)

### 5.1 Cloud Build via EAS
```bash
eas build --platform ios --profile production
```
- Prompts you to log into your Apple Developer account.
- Automatically provisions the Distribution Certificate and Provisioning Profile.
- Generates the signed `.ipa` binary.

### 5.2 TestFlight & App Store Submission
```bash
eas submit --platform ios
```
- Directly uploads the `.ipa` to Apple TestFlight.
- Partner can accept the TestFlight invite to test real-world notifications, WebRTC calls, and background sync.

---

## 6. Verification Checklist Before Submission

- [x] Application points to public cloud endpoints (`https://ourspace.app`, `wss://ourspace.livekit.cloud`).
- [x] Zero references to `localhost` in release bundle.
- [x] Push notification entitlements configured for APNs and FCM HTTP v1.
- [x] Background modes enabled: `Audio, AirPlay`, `Voice over IP`, `Remote notifications`.
- [x] Deep link handling verified for `ourspace://pair?code=...`.
