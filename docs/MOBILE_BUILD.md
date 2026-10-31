# OURSPACE — Mobile Application Build Guide (Expo / React Native)

## 1. Prerequisites
- Node.js >= 20
- EAS CLI: `npm install -g eas-cli`
- Expo account for cloud builds (or local Android Studio / Xcode)

## 2. Local Development
```bash
cd apps/mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on Android or iOS.

## 3. Production Cloud Build (EAS)
1. Log in: `eas login`
2. Configure project: `eas build:configure`
3. Build for Android APK / AAB:
   ```bash
   eas build --platform android --profile production
   ```
4. Build for iOS IPA:
   ```bash
   eas build --platform ios --profile production
   ```
