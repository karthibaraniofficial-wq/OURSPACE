# OURSPACE — LiveKit WebRTC Global Networking Specification

## 1. Overview

OURSPACE uses **LiveKit** as its real-time audio and video infrastructure. Unlike raw peer-to-peer WebRTC (which fails across mobile carriers with symmetric NATs), LiveKit uses an enterprise-grade Selective Forwarding Unit (SFU) with integrated TURN/STUN relays.

---

## 2. Recommended: LiveKit Cloud (Managed Global Anycast)

For production without managing bare-metal media servers, LiveKit Cloud is the recommended global solution:
- Global Anycast network automatically connects each partner to the geographically closest edge data center.
- Automated TURN relay servers in 20+ global regions.
- Built-in adaptive bitrate, noise suppression, and simulcast streaming.

### 2.1 Configuration
Add to `.env.production`:
```env
NEXT_PUBLIC_LIVEKIT_URL=wss://ourspace.livekit.cloud
LIVEKIT_API_KEY=API_your_cloud_key
LIVEKIT_API_SECRET=SEC_your_cloud_secret
```

---

## 3. Self-Hosted LiveKit Deployment (Alternative)

If self-hosting on AWS EC2, DigitalOcean, or Hetzner:

### 3.1 Network Port & Firewall Matrix

| Port | Protocol | Purpose | Access Required |
|---|---|---|---|
| `443` | `TCP` | HTTPS web traffic & TURN over TLS fallback | Public Internet |
| `7880` | `TCP` | LiveKit Signaling WebSockets (`wss://`) | Public Internet (or via Reverse Proxy) |
| `7881` | `TCP` | WebRTC TCP fallback for restrictive networks | Public Internet |
| `3478` | `UDP` | STUN / TURN port | Public Internet |
| `50000-60000` | `UDP` | WebRTC ICE Media Range (RTP / RTCP audio & video) | Public Internet |

### 3.2 Docker Compose Configuration (`docker-compose.livekit.yml`)
```yaml
version: '3.9'

services:
  livekit:
    image: livekit/livekit-server:v1.6
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
    command: --config /etc/livekit.yaml
    environment:
      - LIVEKIT_KEYS=ourspace_key: your_production_secret_32_chars_long

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
```

### 3.3 Server Configuration (`livekit.yaml`)
```yaml
port: 7880
bind_addresses:
  - ""
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  stun_servers:
    - stun.l.google.com:19302
    - stun1.l.google.com:19302

keys:
  ourspace_key: "your_production_secret_32_chars_long"
```

---

## 4. Secure Token Minting Flow

LiveKit room tokens are generated in the Cloud Function `getLiveKitToken` in [functions/index.js](file:///e:/private%20chat%20app/functions/index.js) and Next.js route [apps/web/src/app/api/livekit/token/route.ts](file:///e:/private%20chat%20app/apps/web/src/app/api/livekit/token/route.ts):

1. **Authentication Check**: Verifies caller's Firebase Auth ID Token.
2. **Space Membership Assertion**: Queries Firestore to confirm the caller belongs to `privateSpaces/{spaceId}`.
3. **Room Permission Grant**:
   - `roomJoin: true`
   - `room: spaceId` (couples can only join their own private room)
   - `canPublish: true`
   - `canSubscribe: true`
4. **Token Expiration**: Token expires automatically after 6 hours to prevent replay attacks.
