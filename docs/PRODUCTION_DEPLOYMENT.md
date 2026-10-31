# OURSPACE — Global Production Deployment Guide

## 1. High-Level Global Architecture

OURSPACE connects two romantic partners across the public internet, whether they are in different cities, states, or continents, using different ISPs (Jio, Airtel, Vodafone, Verizon, T-Mobile, Comcast) or cellular 4G/5G connections.

```text
[Partner A: Mobile (Jio 5G, Mumbai)]           [Partner B: Laptop (Airtel Broadband, Delhi)]
                  │                                                    │
                  │ HTTPS / WSS                                        │ HTTPS / WSS
                  ▼                                                    ▼
     ┌────────────────────────────────────────────────────────────────────────┐
     │           Global Edge Anycast Network / Vercel Global CDN              │
     │                      https://ourspace.app                              │
     └────────────────────────────────────────────────────────────────────────┘
                  │                                                    │
       ┌──────────┴───────────────┐                  ┌─────────────────┴──────────┐
       │                          │                  │                            │
       ▼                          ▼                  ▼                            ▼
[Firebase Auth]          [Cloud Firestore]    [Cloud Storage]         [Cloud Functions v2]
(Global Sessions)        (Realtime Streams)   (Private Vault)         (Reminders & FCM)
       │                          │                  │                            │
       └──────────────────────────┼──────────────────┴────────────────────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │  LiveKit Cloud SFU / TURN │
                    │   wss://ourspace.livekit  │
                    │ (Adaptive Bitrate WebRTC) │
                    └───────────────────────────┘
```

---

## 2. Web Application Production Deployment (Vercel)

Vercel is the primary global hosting engine for the Next.js App Router web application.

### 2.1 One-Click Vercel Deployment via CLI
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login & Link Project
cd apps/web
vercel login
vercel link

# 3. Deploy to Staging Preview
vercel

# 4. Deploy to Production
vercel --prod
```

### 2.2 Vercel Project Environment Variables
Set the following environment variables in the Vercel Dashboard under **Project Settings > Environment Variables**:

| Variable Name | Environment | Value Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Production | `https://ourspace.app` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Production | Google Cloud Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Production | `ourspace-app.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Production | `ourspace-app` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Production | `ourspace-app.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Production | Numerical FCM Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Production | Web App Identifier |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Production | Web Push VAPID Public Key |
| `NEXT_PUBLIC_LIVEKIT_URL` | Production | `wss://ourspace.livekit.cloud` |
| `LIVEKIT_API_KEY` | Production (Secret) | Server token generation key |
| `LIVEKIT_API_SECRET` | Production (Secret) | Server token signing secret |
| `NEXT_PUBLIC_GIPHY_API_KEY` | Production | GIPHY SDK Search API Key |

---

## 3. Custom Domain Configuration (`ourspace.app`)

When binding your custom domain:

### 3.1 DNS Records Table
Configure the following DNS records at your domain registrar (Cloudflare, Namecheap, Google Domains):

| Type | Name | Target / Value | TTL | Proxy / SSL |
|---|---|---|---|---|
| `A` | `@` (apex) | `76.76.21.21` (Vercel Anycast IP) | Auto | DNS only (Vercel handles SSL) |
| `CNAME` | `www` | `cname.vercel-dns.com` | Auto | DNS only |
| `CNAME` | `staging` | `cname.vercel-dns.com` | Auto | Staging preview |
| `TXT` | `@` | `v=spf1 include:_spf.google.com ~all` | Auto | Email delivery |

### 3.2 Firebase Authentication Authorized Domains
In **Firebase Console > Authentication > Settings > Authorized Domains**, add:
- `ourspace.app`
- `www.ourspace.app`
- `staging.ourspace.app`
- `<your-project>.vercel.app`

---

## 4. Firebase Cloud Backend Deployment

### 4.1 Deploying Security Rules & Functions
From the repository root:
```bash
# 1. Login to Firebase CLI
firebase login

# 2. Select the target production project
firebase use ourspace-app

# 3. Deploy Firestore rules and composite indexes
firebase deploy --only firestore:rules,firestore:indexes

# 4. Deploy Storage security rules
firebase deploy --only storage

# 5. Set Cloud Functions production secrets
firebase functions:secrets:set LIVEKIT_API_KEY
firebase functions:secrets:set LIVEKIT_API_SECRET

# 6. Deploy Cloud Functions v2
firebase deploy --only functions
```

---

## 5. Continuous Deployment (GitHub Actions)

Add `.github/workflows/deploy.yml` to trigger automatic production deployments on `git push origin main`:

```yaml
name: Production Deployment
on:
  push:
    branches: [main]

jobs:
  verify-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm install
      - run: npm test
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./apps/web
```
