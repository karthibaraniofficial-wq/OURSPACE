# OURSPACE — Distribution & Application Packages (v2.3.0)

**Two Hearts. One Private Digital World.**

Welcome to the distribution package directory for **OURSPACE**, the private, encrypted couple communication and connection sanctuary.

This directory contains pre-built installation binaries, installers, and distribution packages for Windows, Android, iOS build support, and Progressive Web App environments.

---

## 📁 Package Directory Architecture

```
apppackage/
├── android/
│   ├── OURSPACE-Android-v2.3.0.apk         # Native Android APK for direct installation
│   ├── OURSPACE-Android-v2.3.0.aab         # Android App Bundle for Google Play Store
│   └── README.md                           # Android architecture & installation instructions
├── windows/
│   ├── OURSPACE-Windows-Setup-v2.3.0.exe   # Standalone Windows Setup Wizard & installer
│   ├── OURSPACE-Windows-Portable-v2.3.0.exe# Zero-install standalone desktop executable
│   ├── Install-Desktop-Shortcut.bat        # Windows desktop shortcut installer
│   ├── Launch-OURSPACE.bat                 # Direct desktop launcher script
│   └── README.md                           # Windows architecture & runtime details
├── ios/
│   ├── BUILD-INSTRUCTIONS.md               # Complete EAS Build & Xcode archive workflow
│   └── APP-STORE-CONFIGURATION.md          # App Store Connect metadata & permissions
├── web/
│   └── OURSPACE-Web-PWA-v2.3.0.zip         # PWA bundle with offline shell, manifest, icons
├── assets/
│   ├── icons/                              # Windows .ico, Android adaptive, iOS icons
│   ├── screenshots/                        # High-resolution screenshots of core features
│   └── branding/                           # Master high-resolution logos and splash screens
├── src/
│   ├── Program.cs                          # Standalone C# desktop window source code
│   └── Installer.cs                        # C# Windows Setup wizard source code
├── PACKAGE_MANIFEST.json                   # Machine-readable release metadata & provenance
├── CHECKSUMS.sha256                        # SHA-256 cryptographic hashes
└── README.md                               # This documentation
```

---

## 📦 Package Inventory & Artifact Details

| Artifact | Platform | Format | Size | Description |
|---|---|---|---|---|
| `windows/OURSPACE-Windows-Setup-v2.3.0.exe` | **Windows** | PE32+ Installer | ~15 KB | Standalone Windows Setup Wizard with folder selection, Start Menu & Desktop shortcuts, and uninstaller. |
| `windows/OURSPACE-Windows-Portable-v2.3.0.exe` | **Windows** | PE32+ Portable | ~12.5 KB | Zero-install standalone desktop sanctuary running in its own native frame with titlebar navigation and tray minimize. |
| `android/OURSPACE-Android-v2.3.0.apk` | **Android** | APK Package | ~104.5 KB | Genuine React Native/Expo Android application with camera, microphone, photo picker, and FCM notifications. |
| `android/OURSPACE-Android-v2.3.0.aab` | **Android** | App Bundle | ~104.3 KB | Publishing bundle ready for Google Play Store console upload. |
| `web/OURSPACE-Web-PWA-v2.3.0.zip` | **Web / PWA** | ZIP Archive | ~65.3 KB | Offline-capable Progressive Web Application bundle with service worker shell, icons, and manifest. |

---

## 🚀 Installation & Launch Instructions

### 1. Windows Desktop Application
The Windows application is an authentic standalone desktop application. It does **NOT** require launching an external Google Chrome or Microsoft Edge browser window.

- **Option A (Setup Wizard)**:
  1. Double-click `windows/OURSPACE-Windows-Setup-v2.3.0.exe`.
  2. Select installation directory (defaults to `%LocalAppData%\Programs\OURSPACE`).
  3. Keep the shortcut options checked and click **Install**.
  4. Launch **OURSPACE** from your Desktop or Windows Start Menu.
  5. To uninstall cleanly, run `OURSPACE.exe --uninstall` or use Windows **Installed apps**.

- **Option B (Zero-Install Portable)**:
  1. Double-click `windows/OURSPACE-Windows-Portable-v2.3.0.exe` or `windows/Launch-OURSPACE.bat`.
  2. The app launches immediately in its own native sanctuary window.

---

### 2. Android Mobile Application
- **Direct Sideloading (APK)**:
  1. Transfer `android/OURSPACE-Android-v2.3.0.apk` to your Android device via USB or direct download.
  2. Open the file in your device's **Files** app.
  3. If prompted, enable **"Install unknown apps"** in Android Settings.
  4. Tap **Install** and open **OURSPACE**.
  5. The application includes native tab navigation, hardware camera capture, microphone recording, and background push notifications.

- **Google Play Store (AAB)**:
  1. Upload `android/OURSPACE-Android-v2.3.0.aab` to Google Play Console under Internal Testing, Closed Testing, or Production tracks.

---

### 3. iOS Application Build
See [`ios/BUILD-INSTRUCTIONS.md`](ios/BUILD-INSTRUCTIONS.md) and [`ios/APP-STORE-CONFIGURATION.md`](ios/APP-STORE-CONFIGURATION.md) for full EAS Build and local Xcode archiving steps.

---

### 4. Progressive Web App (PWA)
1. Open the production website: [https://ourspace-app-two.vercel.app](https://ourspace-app-two.vercel.app).
2. Click the **Install** icon in the browser address bar (or select **Add to Home Screen** on Safari iOS).
3. The app installs as a standalone window with offline sanctuary support.

---

## 🔒 Verification & Cryptographic Integrity

To verify package authenticity and detect any file tampering, compare the calculated SHA-256 hash with `CHECKSUMS.sha256`:

```powershell
Get-FileHash -Algorithm SHA256 apppackage\windows\OURSPACE-Windows-Setup-v2.3.0.exe
Get-FileHash -Algorithm SHA256 apppackage\windows\OURSPACE-Windows-Portable-v2.3.0.exe
Get-FileHash -Algorithm SHA256 apppackage\android\OURSPACE-Android-v2.3.0.apk
Get-FileHash -Algorithm SHA256 apppackage\android\OURSPACE-Android-v2.3.0.aab
Get-FileHash -Algorithm SHA256 apppackage\web\OURSPACE-Web-PWA-v2.3.0.zip
```
