#!/usr/bin/env python3
"""
OURSPACE v2.3.0 Package Verification & Checksum Generator
Computes SHA-256 checksums and produces the official PACKAGE_MANIFEST.json
and CHECKSUMS.sha256 files for the v2.3.0 release.
"""

import os
import hashlib
import json
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPPACKAGE_DIR = os.path.join(BASE_DIR, "apppackage")

artifacts = [
    {
        "platform": "Windows",
        "category": "Setup Installer",
        "rel_path": os.path.join("windows", "OURSPACE-Windows-Setup-v2.3.0.exe"),
        "format": "PE32+ Executable (Native WinForms GUI)",
        "architecture": "x64 / x86 / ARM64 (emulated)",
        "minOs": "Windows 10 (Build 1809+) / Windows 11",
        "targetOs": "Windows 11 (23H2+)",
        "buildConfiguration": "Release (CSC Native Standalone)",
        "signingStatus": "Self-Signed Test Certificate / Pre-Release",
        "buildProvenance": "Compiled from apppackage/src/Installer.cs via Microsoft .NET Framework 4.8 csc.exe",
        "description": "Full Windows Setup Wizard with directory selection, Desktop & Start Menu shortcuts, uninstaller registration, and launch support."
    },
    {
        "platform": "Windows",
        "category": "Portable Executable",
        "rel_path": os.path.join("windows", "OURSPACE-Windows-Portable-v2.3.0.exe"),
        "format": "PE32+ Executable (Native WinForms GUI)",
        "architecture": "x64 / x86 / ARM64 (emulated)",
        "minOs": "Windows 10 (Build 1809+) / Windows 11",
        "targetOs": "Windows 11 (23H2+)",
        "buildConfiguration": "Release (CSC Native Standalone)",
        "signingStatus": "Self-Signed Test Certificate / Pre-Release",
        "buildProvenance": "Compiled from apppackage/src/Program.cs via Microsoft .NET Framework 4.8 csc.exe",
        "description": "Zero-install portable desktop sanctuary running entirely within its own native desktop window frame with romantic navigation bar and notification tray."
    },
    {
        "platform": "Android",
        "category": "Direct Installation APK",
        "rel_path": os.path.join("android", "OURSPACE-Android-v2.3.0.apk"),
        "format": "APK (Android Application Package)",
        "architecture": "Universal (arm64-v8a, armeabi-v7a, x86_64)",
        "minOs": "Android 7.0 (API Level 24)",
        "targetOs": "Android 14 (API Level 34)",
        "buildConfiguration": "Release (Expo / React Native)",
        "signingStatus": "V1 + V2 Scheme Signed",
        "buildProvenance": "Packaged from apps/mobile Expo React Native source, assets, and Android manifest",
        "description": "Genuine native Android application with hardware camera, audio recording, photo picker, FCM push notifications, and biometric locker authentication."
    },
    {
        "platform": "Android",
        "category": "Google Play App Bundle",
        "rel_path": os.path.join("android", "OURSPACE-Android-v2.3.0.aab"),
        "format": "AAB (Android App Bundle)",
        "architecture": "Dynamic Split Bundles (Google Play Delivery)",
        "minOs": "Android 7.0 (API Level 24)",
        "targetOs": "Android 14 (API Level 34)",
        "buildConfiguration": "Release (Expo / React Native)",
        "signingStatus": "Play App Signing Compatible",
        "buildProvenance": "Packaged from apps/mobile Expo React Native source, assets, and Android manifest",
        "description": "Android App Bundle ready for Google Play Store console upload and optimized per-device artifact delivery."
    },
    {
        "platform": "Web (PWA)",
        "category": "Progressive Web App Bundle",
        "rel_path": os.path.join("web", "OURSPACE-Web-PWA-v2.3.0.zip"),
        "format": "ZIP Archive",
        "architecture": "Cross-Platform (Modern Browsers / Chromium / WebKit)",
        "minOs": "Any OS with Modern Browser (Chrome 90+, Safari 15+, Edge 90+, Firefox 90+)",
        "targetOs": "Cross-Platform",
        "buildConfiguration": "Production PWA Distribution",
        "signingStatus": "HTTPS TLS Web PKI Required",
        "buildProvenance": "Generated from apps/web PWA manifest, service worker shell, and romantic offline sanctuary",
        "description": "Installable Progressive Web App distribution bundle with offline service worker, Web App Manifest, and background sync."
    }
]

checksum_lines = []
manifest_packages = []
build_timestamp = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

print("Calculating SHA-256 checksums for v2.3.0 artifacts...")

for art in artifacts:
    full_path = os.path.join(APPPACKAGE_DIR, art["rel_path"])
    if not os.path.exists(full_path):
        print(f"ERROR: Artifact not found at {full_path}")
        continue
    
    file_size = os.path.getsize(full_path)
    sha256 = hashlib.sha256()
    with open(full_path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    hash_hex = sha256.hexdigest()
    
    # Normalized path for checksums file (using forward slashes)
    norm_path = art["rel_path"].replace("\\", "/")
    checksum_lines.append(f"{hash_hex}  {norm_path}")
    
    pkg_entry = {
        "platform": art["platform"],
        "category": art["category"],
        "fileName": os.path.basename(full_path),
        "relativePath": norm_path,
        "format": art["format"],
        "architecture": art["architecture"],
        "sizeBytes": file_size,
        "sizeFormatted": f"{file_size / 1024:.1f} KB" if file_size < 1048576 else f"{file_size / (1024*1024):.2f} MB",
        "sha256": hash_hex,
        "minSupportedOs": art["minOs"],
        "targetOs": art["targetOs"],
        "buildConfiguration": art["buildConfiguration"],
        "signingStatus": art["signingStatus"],
        "buildProvenance": art["buildProvenance"],
        "description": art["description"]
    }
    manifest_packages.append(pkg_entry)
    print(f"  [OK] {norm_path} -> {hash_hex} ({pkg_entry['sizeFormatted']})")

# Write CHECKSUMS.sha256
checksum_file = os.path.join(APPPACKAGE_DIR, "CHECKSUMS.sha256")
with open(checksum_file, "w", encoding="utf-8") as f:
    f.write("\n".join(checksum_lines) + "\n")
print(f"Wrote checksum file: {checksum_file}")

# Write PACKAGE_MANIFEST.json
manifest_data = {
    "application": "OURSPACE",
    "tagline": "Two Hearts. One Private Digital World.",
    "version": "2.3.0",
    "releaseTag": "v2.3.0-standalone-release",
    "buildTimestamp": build_timestamp,
    "productionUrl": "https://ourspace-app-two.vercel.app",
    "backend": {
        "provider": "Google Firebase",
        "projectId": "ourspace-edbf5",
        "services": [
            "Firebase Authentication",
            "Cloud Firestore",
            "Firebase Cloud Storage",
            "Firebase Cloud Messaging (FCM)",
            "Firebase Cloud Functions (v2)"
        ],
        "mediaTransport": "LiveKit SFU (WebRTC Audio/Video)",
        "security": "AES-GCM-256 Vault Encryption with Zero-Knowledge Master Key"
    },
    "features": [
        "In-App Native Desktop Window Frame (Zero Chrome/Edge Dependency)",
        "Native Android React Native Application with Camera & Audio Recording",
        "Dedicated In-App Camera Button & Instant Photo Capture Pipeline",
        "WebRTC 1-on-1 Audio & Video Calling with LiveKit SFU",
        "Shared Memory Albums with Romantic Date Grouping & Captions",
        "OUR LOCKER Military-Grade Encrypted Vault with Emergency Passcode Recovery",
        "Responsive Aspect Ratio Optimization Across Mobile, Tablet, Laptop & Desktop Displays",
        "Offline Sanctuary with Background Message Queuing & Auto-Sync"
    ],
    "packages": manifest_packages,
    "iosBuildSupport": {
        "bundleId": "com.ourspace.app",
        "version": "2.3.0",
        "easConfigured": True,
        "documentation": "ios/BUILD-INSTRUCTIONS.md",
        "appStoreConfiguration": "ios/APP-STORE-CONFIGURATION.md"
    }
}

manifest_file = os.path.join(APPPACKAGE_DIR, "PACKAGE_MANIFEST.json")
with open(manifest_file, "w", encoding="utf-8") as f:
    json.dump(manifest_data, f, indent=2)
print(f"Wrote manifest file: {manifest_file}")
