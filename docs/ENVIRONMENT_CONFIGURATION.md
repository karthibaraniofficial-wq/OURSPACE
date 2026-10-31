# OURSPACE — Centralized Secure Environment Variable Architecture

This document governs the management, validation, scoping, and deployment of environment variables across development, staging, and production environments for OURSPACE.

---

## 1. Zero-Exposure Security Principles

1. **Separation of Scopes**:
   - Variables prefixed with `NEXT_PUBLIC_` are bundled into client-side JavaScript. Only non-sensitive endpoints, public project identifiers, and public tokens may use this prefix.
   - Privileged server credentials (such as `LIVEKIT_API_SECRET` and `FIREBASE_PRIVATE_KEY`) **must NEVER** use the `NEXT_PUBLIC_` prefix.
2. **Git Hygiene**:
   - Files containing real values (`.env`, `.env.local`, `.env.development`, `.env.production`, `.env.staging`) are strictly excluded in `.gitignore`.
   - Only template files containing placeholders (`.env.example`, `.env.development.example`, `.env.production.example`) may be committed.
3. **Fail-Fast Typed Startup Validation**:
   - The application employs Zod schemas (`clientEnvSchema` and `serverEnvSchema`) from `@ourspace/validation`.
   - If mandatory production credentials are missing or malformed, the process terminates immediately with an explicit validation error, preventing silent degradation or security bypasses.
4. **Zero-Log Policy**:
   - Secrets and tokens must never appear in server logs, client consoles, Sentry crash reports, or error payloads.

---

## 2. Environment Variable Master Catalog

| Variable Name | Scope | Sensitivity | Required | Description |
|---|---|---|---|---|
| `NODE_ENV` | System | Public | Yes | Runtime environment (`development`, `production`, `test`). |
| `NEXT_PUBLIC_APP_URL` | Client | Public | Yes | Canonical base URL (`https://ourspace.app`). |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client | Public | Yes | Firebase Web Client API key. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client | Public | Yes | Firebase Auth domain (`<project>.firebaseapp.com`). |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client | Public | Yes | Firebase project identifier. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Client | Public | Yes | Cloud Storage bucket (`<project>.appspot.com`). |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client | Public | Yes | FCM sender numeric ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client | Public | Yes | Firebase Web Application ID. |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Client | Public | Optional | Google Analytics 4 Measurement ID. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Client | Public | Optional | Web Push VAPID public key. |
| `NEXT_PUBLIC_LIVEKIT_URL` | Client | Public | Yes | LiveKit Cloud WSS endpoint (`wss://ourspace.livekit.cloud`). |
| `LIVEKIT_API_KEY` | Server | **Restricted** | Yes | LiveKit API Key for minting room access tokens. |
| `LIVEKIT_API_SECRET` | Server | **Secret** | Yes | LiveKit API Secret for HMAC token signing. |
| `FIREBASE_CLIENT_EMAIL` | Server | **Restricted** | Optional | Service account email (when using manual credentials). |
| `FIREBASE_PRIVATE_KEY` | Server | **Secret** | Optional | Service account private key (Cloud Functions / Server). |
| `NEXT_PUBLIC_GIPHY_API_KEY` | Client | Public | Optional | GIPHY SDK key for couple GIF sharing. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Client | Public | Optional | reCAPTCHA v3 site key for Firebase App Check. |

---

## 3. Deployment Configuration Instructions

### 3.1 Vercel Production Environment
Configure in **Vercel Dashboard** -> **Project Settings** -> **Environment Variables**:
1. Add `NEXT_PUBLIC_APP_URL` = `https://ourspace.app`
2. Add all `NEXT_PUBLIC_FIREBASE_*` credentials.
3. Add `NEXT_PUBLIC_LIVEKIT_URL` = `wss://your-org.livekit.cloud`.
4. Add `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` (Scoped strictly to **Production** and **Preview** environments, unchecked for Development).

### 3.2 Cloud Functions Secrets (Google Cloud Secret Manager)
For serverless functions in `functions/`:
```bash
firebase functions:secrets:set LIVEKIT_API_KEY
firebase functions:secrets:set LIVEKIT_API_SECRET
```

### 3.3 Rotating Compromised Credentials
If any credential is accidentally exposed:
1. **LiveKit**: Generate a new API Key/Secret in the LiveKit Cloud dashboard; revoke the old key.
2. **Firebase**: In Google Cloud Console -> APIs & Services -> Credentials, regenerate the Web API key and update authorized referrers.
3. **Service Accounts**: In Google Cloud IAM -> Service Accounts, delete the compromised key pair and generate a new key.
