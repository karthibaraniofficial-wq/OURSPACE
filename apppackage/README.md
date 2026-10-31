# OURSPACE — Distribution & Application Packages (v2.0.0)

Welcome to the distribution package directory for **OURSPACE**, the private couple communication and connection sanctuary.

This directory contains pre-built installation binaries, installers, and distribution packages for Android, Windows, and Progressive Web App environments.

---

## 📦 Package Inventory

| File Name | Platform | Description |
|---|---|---|
| `OURSPACE-Windows-v2.0.0.exe` | **Windows** | Native x64 Windows Desktop Application (GUI) with one-click sanctuary browser and local service launcher. |
| `OURSPACE-Android-v2.0.0.apk` | **Android** | Installable Android Package (`app.ourspace.client`) supporting camera, microphone, calling, and push notifications. |
| `OURSPACE-Web-PWA.zip` | **Web / PWA** | Progressive Web Application offline bundle with manifest, icons, and service worker. |
| `Install-Desktop-Shortcut.bat` | **Windows Installer** | Double-click to automatically create an `OURSPACE` shortcut on your Windows Desktop. |
| `Launch-OURSPACE.bat` | **Quick Launcher** | Double-click to instantly launch the desktop application. |
| `CHECKSUMS.sha256` | **Integrity** | SHA-256 cryptographic hashes for verifying package authenticity. |
| `PACKAGE_MANIFEST.json` | **Metadata** | Machine-readable release specifications, permissions, and minimum OS requirements. |

---

## 🚀 Installation & Launch Instructions

### 1. Windows Installation
1. To launch directly:
   - Double-click `OURSPACE-Windows-v2.0.0.exe` or `Launch-OURSPACE.bat`.
2. To create a Desktop Shortcut:
   - Double-click `Install-Desktop-Shortcut.bat`.
   - A shortcut titled **OURSPACE** will appear on your desktop.
3. The desktop app provides one-click access to open the couple sanctuary, launch the local development server, or inspect security documentation.

---

### 2. Android Installation (Sideloading)
1. Transfer `OURSPACE-Android-v2.0.0.apk` to your Android device via USB, Google Drive, or local file sharing.
2. Open your device's **Files** or **Downloads** app and tap `OURSPACE-Android-v2.0.0.apk`.
3. If prompted, toggle **Allow from this source** in Settings (standard for sideloaded APKs).
4. Tap **Install**.
5. Once installed, tap **Open** to launch OURSPACE with full camera, microphone, and calling support.

---

### 3. Progressive Web App (PWA)
1. Unzip `OURSPACE-Web-PWA.zip` or open the live web app in Google Chrome, Microsoft Edge, or Apple Safari.
2. In the browser address bar, click the **Install App** icon (or tap **Add to Home Screen** on iOS/Android).
3. The app will install as a standalone desktop or mobile application with zero browser navigation bars.

---

## 🔒 Verification & Integrity
To verify package integrity against tampering, check the SHA-256 checksums in `CHECKSUMS.sha256`:

```powershell
Get-FileHash -Algorithm SHA256 apppackage\OURSPACE-Windows-v2.0.0.exe
Get-FileHash -Algorithm SHA256 apppackage\OURSPACE-Android-v2.0.0.apk
```
