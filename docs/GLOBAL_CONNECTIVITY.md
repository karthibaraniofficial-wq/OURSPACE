# OURSPACE — Global Internet Connectivity Architecture

## 1. Overview & Multi-Network Matrix

OURSPACE is engineered to operate without requiring both partners to be on the same Wi-Fi network or even in the same country. The platform communicates exclusively through public HTTPS, WSS (Secure WebSockets), and WebRTC over STUN/TURN relays.

### Real-World Network Scenarios Supported

| Partner A Network | Partner B Network | Traffic Protocol | NAT Traversal Mechanism |
|---|---|---|---|
| **Home Wi-Fi (Broadband)** | **Home Wi-Fi (Different ISP)** | HTTPS + WSS + WebRTC | Direct UDP via STUN |
| **Cellular 5G (Jio/Airtel)** | **Home Wi-Fi** | HTTPS + WSS + WebRTC | STUN / TURN Relay Fallback |
| **Cellular 4G (Roaming)** | **Cellular 5G (Different Carrier)** | HTTPS + WSS + WebRTC | TURN over TLS (Port 443) |
| **Airport / Hotel Wi-Fi** | **Mobile Data (4G LTE)** | HTTPS + WSS + WebRTC | TURN TCP Fallback |
| **Office Restricted Network** | **Home Wi-Fi** | HTTPS + WSS + WebRTC | TURN over TLS (Port 443) bypassing firewalls |

---

## 2. Overcoming Carrier-Grade NAT (CGNAT) on Mobile 4G/5G

Cellular networks (such as Jio, Airtel, T-Mobile, AT&T) place mobile devices behind **Carrier-Grade NAT (CGNAT)** with symmetric port translation. In this environment:
1. Two mobile devices cannot open direct peer-to-peer UDP sockets to each other.
2. In-flight IP addresses can mutate during cellular cell tower handovers.

### Solution: LiveKit Managed SFU with Anycast TURN
OURSPACE avoids brittle peer-to-peer WebRTC connections. All media streams route through LiveKit's Selective Forwarding Unit (SFU) network:
- **STUN**: Discovers the public IP and NAT mapping.
- **TURN Relay (UDP 3478)**: Relays media packets if direct UDP is blocked.
- **TURN over TLS (TCP 443)**: Enforces TLS encapsulation disguised as regular HTTPS web traffic, guaranteeing that even the most restrictive hotel, enterprise, or cellular firewalls permit call connectivity.

---

## 3. Network Handover & Offline Resilience Protocol

### 3.1 Seamless Wi-Fi to Cellular Handover
When an operator leaves their home and their phone drops Wi-Fi and connects to 5G:
1. The browser / mobile OS fires the `navigator.connection` change event.
2. [apps/web/src/store/useNetworkStore.ts](file:///e:/private%20chat%20app/apps/web/src/store/useNetworkStore.ts) catches the change and toggles status to `reconnecting`.
3. Firestore's long-polling / gRPC connection automatically re-establishes a fresh stream without losing in-memory messages.
4. During calls, LiveKit's ICE connection renegotiates candidate pairs (`ICE Restart`) in under 400ms, preserving ongoing conversation without call termination.

### 3.2 Temporary Disconnection & Pending Sync Queue
If a partner enters an elevator or underground tunnel:
1. Status switches to `offline`.
2. Outgoing messages, reactions, and task completions are intercepted and stored in the local `pendingQueue`.
3. When the device regains internet connection, `flushPendingQueue()` automatically posts buffered actions in chronological order.
4. Partner receives the synchronized messages seamlessly with server timestamps.

---

## 4. Cross-Platform Push Delivery Architecture

To ensure remote messages and incoming calls alert users even when their app is closed in background:

```text
[Partner Sends Message]
         │
         ▼
[Cloud Functions Trigger: onNewMessageNotification]
         │
         ├── Checks Partner Device Tokens in users/{uid}/devices
         │
         ├── Dispatches via FCM Admin SDK
         │
         ├── Web Devices: Pushes payload to /firebase-messaging-sw.js
         ├── Android: Wakes up high-priority notification channel
         └── iOS: Routes through Apple Push Notification service (APNs)
```
