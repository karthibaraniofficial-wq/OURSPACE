# OURSPACE — Private Couple Communication & Connection Platform

[![CI Pipeline](https://github.com/karthibaraniofficial-wq/OURSPACE/actions/workflows/ci.yml/badge.svg)](https://github.com/karthibaraniofficial-wq/OURSPACE/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-rose.svg)](https://opensource.org/licenses/MIT)
[![Production Status](https://img.shields.io/badge/Production-Live-emerald.svg)](https://ourspace.app)

> **Two people, one private digital sanctuary, synchronized across the globe.**

OURSPACE is an enterprise-grade, cross-platform private communication platform engineered specifically for couples in a relationship. Built with strict two-person multi-tenant isolation, real-time Cloud Firestore streaming, LiveKit WebRTC high-definition voice and video calling, and a romantic soft glassmorphism interface.

---

## 📸 Architecture & Platform Overview

```text
OURSPACE Monorepo Architecture
├── apps/
│   ├── web/          # Next.js 14 App Router, PWA, Tailwind CSS, Framer Motion, Zustand
│   └── mobile/       # Expo (React Native) cross-platform iOS & Android client
├── packages/
│   ├── types/        # TypeScript domain models, Firestore schemas & WebRTC contracts
│   ├── validation/   # Zod validation schemas for auth, pairing, messages, reminders, env
│   └── shared/       # Date math, countdown engine, Web Audio chime synthesizer, theme presets
├── functions/        # Node 20 Firebase Cloud Functions v2 (reminders, space limits, FCM)
├── apppackage/       # Standalone Windows launcher (.exe) and desktop shortcut scripts
├── docs/             # Technical architecture, security audit, deployment guides
└── tests/            # Automated test suites (40/40 tests passing across 14 suites)
```

### Global Connectivity Data Flow
```text
Partner A (Cellular 5G / Wi-Fi) ──┐
                                   ├──> [ Edge CDN / Vercel ] ──> Next.js 14 Web App
                                   ├──> [ Firebase Auth ] ─────> Secure Token Exchange
                                   ├──> [ Cloud Firestore ] ───> Real-Time onSnapshot Sync
Partner B (Cellular 5G / Wi-Fi) ──┘    ├──> [ Firebase Storage ] ──> Private Media Vault
                                       ├──> [ Cloud Functions ] ───> Scheduled Cron / Triggers
                                       └──> [ LiveKit Cloud ] ─────> WebRTC Audio/Video (STUN/TURN TLS)
```

---

## 🌟 Key Features

| Domain | Capabilities |
|---|---|
| **Private Space Pairing** | Atomic Firestore transaction guarantees **strictly 2 accounts per space**. 48-hour expiring invite codes and instant deep links (`ourspace://pair?code=...`). |
| **Real-Time 1-to-1 Chat** | Text, photos, videos, voice notes, documents, romantic emoji reactions, reply threads, message editing, soft deletion, and typing indicators. |
| **Media Vault & Lightbox** | Categorized media gallery (Photos, Videos, Documents, Favourites), full-screen lightbox viewer, 50MB ceiling, and space-isolated storage rules. |
| **LiveKit Audio & Video Calling** | HD calling powered by LiveKit SFU with WebSockets signaling, STUN, and TURN-over-TLS (port 443) for seamless connection across mobile 4G/5G CGNAT and restrictive Wi-Fi. |
| **Shared Milestones & Dates** | Days Together live counter, countdowns to anniversaries, birthdays, and date nights. |
| **Reminders & Tasks** | Shared reminders, priority levels, recurring intervals (daily, weekly, monthly, yearly), and completion animations. |
| **Sound Synthesis Engine** | Zero-latency Web Audio API synthesizer generating 4 harmonic chime profiles without external network requests. |
| **Resilient Networking** | Real-time connection badge (`Online`, `Reconnecting...`, `Offline`), offline message queueing with automatic FIFO sync on reconnect. |

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Framer Motion, Lucide Icons, Zustand
- **Mobile**: Expo SDK 51, React Native, React Native Reanimated
- **Backend**: Google Firebase (Authentication, Cloud Firestore, Cloud Storage, Cloud Messaging, App Check)
- **Serverless**: Firebase Cloud Functions v2 (Node.js 20)
- **Calling**: LiveKit WebRTC SFU (`@livekit/components-react`, `livekit-client`, `livekit-server-sdk`)
- **Hosting**: Vercel Edge Network & Firebase Hosting
- **Desktop**: C# WebView2 lightweight native Windows wrapper

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** >= 20.x (`v24.19.0` recommended)
- **npm** >= 10.x

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Firebase project and LiveKit credentials (refer to [docs/ENVIRONMENT_CONFIGURATION.md](file:///e:/private%20chat%20app/docs/ENVIRONMENT_CONFIGURATION.md)).

### 3. Run Automated Tests
```bash
npm test
```
*Executes all 5 test suites (business logic, security audit, relational migration, validation contracts, global connectivity) with 40/40 passing tests.*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security & Privacy Posture

- **Strict Two-Person Membership**: Guaranteed at database level via `firestore.rules` and backed by the atomic `onSpaceMemberCreate` Cloud Function trigger.
- **Private Cloud Storage**: Access rules strictly verify `request.auth.uid` matches space membership.
- **Zero Secrets Bundled**: Privileged keys (`LIVEKIT_API_SECRET`, service account private keys) are kept exclusively on the server.
- **Fail-Safe Validation**: Typed Zod environment schema prevents application startup if mandatory production credentials are absent.

---

## 📚 Technical Documentation Directory

- [Platform Integration Audit](file:///e:/private%20chat%20app/docs/PLATFORM_INTEGRATION_AUDIT.md)
- [Production Deployment Guide](file:///e:/private%20chat%20app/docs/PRODUCTION_DEPLOYMENT.md)
- [Global Connectivity & Mobile Matrix](file:///e:/private%20chat%20app/docs/GLOBAL_CONNECTIVITY.md)
- [Environment Configuration Manual](file:///e:/private%20chat%20app/docs/ENVIRONMENT_CONFIGURATION.md)
- [LiveKit WebRTC & TURN Networking](file:///e:/private%20chat%20app/docs/LIVEKIT_NETWORKING.md)
- [Mobile Production Build Setup](file:///e:/private%20chat%20app/docs/MOBILE_PRODUCTION_SETUP.md)
- [Network Troubleshooting Playbook](file:///e:/private%20chat%20app/docs/NETWORK_TROUBLESHOOTING.md)
- [Release Notes](file:///e:/private%20chat%20app/RELEASE_NOTES.md)
