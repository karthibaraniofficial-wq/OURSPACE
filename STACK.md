# OURSPACE — Technology Stack (Firebase Edition)

## 1. Web Frontend
- **Framework**: Next.js 14+ (App Router, Server Components & Client Components)
- **Language**: TypeScript 5+ (Strict Mode)
- **Styling**: CSS Custom Properties for Theme Tokens, Responsive Grid & Flexbox
- **Design System**: Soft Glassmorphism, Rounded UI, Rose/Lavender/Cream/Night Velvet palettes
- **Icons**: Lucide React
- **Animations**: CSS Keyframes & Micro-transitions
- **State Management**: Zustand
- **Media & Audio**: HTML5 Audio & Web Audio API (zero-latency synthetic chimes)
- **Calling**: LiveKit WebRTC SDK (`livekit-client`, `@livekit/components-react`)

## 2. Mobile Frontend
- **Framework**: React Native with Expo SDK 51+
- **Navigation**: Expo Router (file-based navigation)
- **Icons**: Lucide React Native
- **State Management**: Zustand
- **WebRTC Calling**: LiveKit React Native SDK (`@livekit/react-native`)

## 3. Shared Packages (Monorepo)
- `@ourspace/types`: Database schema types, domain models, WebRTC payloads
- `@ourspace/validation`: Zod schemas for auth, pairing, messages, media, reminders
- `@ourspace/shared`: Date utilities, days together counter, sound synthesizers, formatters, color palettes

## 4. Backend & Firebase Services
- **BaaS / Database**: Google Cloud Firestore (NoSQL Document Store with atomic transactions)
- **Authentication**: Firebase Authentication (Email/Password, persistent sessions, token verification)
- **Realtime Engine**: Cloud Firestore `onSnapshot` real-time listeners & Firebase Realtime Database (presence)
- **Storage**: Firebase Cloud Storage with space-isolated security rules and 50MB ceiling
- **Serverless Compute**: Firebase Cloud Functions (v2) for scheduled tasks, Firestore triggers, and LiveKit token minting
- **Push Notifications**: Firebase Cloud Messaging (FCM) across Web Push, Android, and iOS
- **App Security**: Firebase App Check (reCAPTCHA v3 / Play Integrity)

## 5. Third-Party Integrations
- **WebRTC SFU**: LiveKit Cloud / LiveKit Server (preserved media transport)
- **GIFs**: GIPHY API (Search, Trending, Categories) with server-side proxy
- **PWA**: Web App Manifest with dynamic romantic icons
