# OURSPACE Android Native Application (v2.3.0)

**Two Hearts. One Private Digital World.**

Official native Android distribution package for Android 7.0+ (API Level 24 to 34).

---

## Artifacts in this Release

| File | Type | Target | Description |
|---|---|---|---|
| `OURSPACE-Android-v2.3.0.apk` | Android Application Package | Direct Installation / Sideloading | Production release APK for direct installation on Android devices. |
| `OURSPACE-Android-v2.3.0.aab` | Android App Bundle | Google Play Console | Publishing bundle with dynamic feature delivery and split-APK optimizations. |

---

## Native Architecture & Capabilities

Built with React Native & Expo native architecture:
- **Application ID**: `com.ourspace.app`
- **Version Name**: `2.3.0`
- **Version Code**: `23`
- **Native Hardware Integrations**:
  - Camera (`android.permission.CAMERA`)
  - Microphone (`android.permission.RECORD_AUDIO`)
  - Photo Picker (`android.permission.READ_MEDIA_IMAGES`)
  - Audio & Video sharing (`android.permission.READ_MEDIA_AUDIO`, `READ_MEDIA_VIDEO`)
  - Notification Channels (`ourspace_messages`, `ourspace_calls`, `ourspace_alerts`)
  - Hardware Haptic Feedback (`android.permission.VIBRATE`)
- **Deep Linking**:
  - `ourspace://pair?code={INVITE_CODE}`
  - `https://ourspace-app-two.vercel.app/pair?code={INVITE_CODE}`
- **Production Backend Endpoint**: `https://ourspace-app-two.vercel.app/api`
- **Firebase Project**: `ourspace-edbf5`

---

## Sideload Installation Instructions

1. Transfer `OURSPACE-Android-v2.3.0.apk` to your Android device via USB or direct download.
2. If prompted, enable **"Install unknown apps"** in your Android device Settings for your file manager.
3. Tap the APK file to complete installation.
4. Launch **OURSPACE** from your home screen or app drawer.
