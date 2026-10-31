# OURSPACE iOS — Native Build & EAS Deployment Guide

**Application:** OURSPACE — Private Couple Communication & Connection Platform  
**Target Release:** v2.3.0  
**Bundle Identifier:** `app.ourspace.client`  
**Framework:** React Native 0.74.5 / Expo SDK 51  

---

## 1. Prerequisites

- **macOS Sonoma (14.x) or Sequoia (15.x)**
- **Xcode 15.3+** with iOS 17 SDK & Command Line Tools (`xcode-select --install`)
- **Apple Developer Program Membership** (Individual or Organization)
- **Node.js**: v20+ or v24+
- **EAS CLI**: `npm install -g eas-cli`

---

## 2. Configuration & Permission Verification

The iOS native capability configuration in `apps/mobile/app.json` enforces strict couple privacy and WebRTC media handling:

```json
{
  "expo": {
    "name": "OURSPACE",
    "slug": "ourspace",
    "version": "2.3.0",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.ourspace.client",
      "infoPlist": {
        "NSCameraUsageDescription": "OURSPACE requires camera access for private video calls with your partner.",
        "NSMicrophoneUsageDescription": "OURSPACE requires microphone access for audio and video calls.",
        "NSPhotoLibraryUsageDescription": "OURSPACE requires photo library access to share memories and photos with your partner.",
        "UIBackgroundModes": ["remote-notification", "audio", "voip"]
      }
    },
    "scheme": "ourspace"
  }
}
```

---

## 3. Cloud Build via Expo Application Services (EAS Build)

### 3.1 Authenticate with Expo
```bash
eas login
```

### 3.2 Initialize / Link EAS Project
```bash
cd apps/mobile
eas project:init --id ourspace-client-mobile
```

### 3.3 Generate Development Build (for Testing on Physical iPhone / iPad)
```bash
eas build --platform ios --profile development
```
- Automatically registers development devices (UDIDs) via Apple Developer API.
- Generates an installable `.tar.gz` Simulator build or ad-hoc `.ipa` for physical testing.

### 3.4 Generate Production Release Build (`.ipa`)
```bash
eas build --platform ios --profile production --auto-submit-with-profile=production
```
- Signs with Apple Distribution Certificate & App Store Provisioning Profile.
- Submits directly to Apple App Store Connect / TestFlight for internal and external testing.

---

## 4. Local Native Compilation (Xcode / Bare Workflow)

If building locally on an Apple Silicon Mac without cloud build quotas:

```bash
cd apps/mobile

# Prebuild native iOS project
npx expo prebuild --platform ios --clean

# Install CocoaPods dependencies
cd ios && pod install

# Open in Xcode
open OURSPACE.xcworkspace
```

In Xcode:
1. Select target **OURSPACE**.
2. Under **Signing & Capabilities**:
   - Check **Automatically manage signing**.
   - Select your registered **Apple Team**.
   - Ensure Capabilities: **Push Notifications**, **Background Modes (Remote notifications, Audio, VoIP)**.
3. Select Destination: **Any iOS Device (arm64)**.
4. Run: **Product → Archive**.
5. Once the Organizer opens, click **Distribute App** → **App Store Connect** → **Upload**.
