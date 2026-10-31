# OURSPACE V2.3.1 — LiveKit Audio & Video Test Report

## 1. Scope & Objective
This report documents the verification procedures and results for two-way audio calling, two-way video calling, hardware track lifecycle, and network resiliency in OURSPACE V2.3.1.

---

## 2. Test Cases & Verification Results

### A. Audio Calling Lifecycle

| Step | Action | Expected Behavior | Observed Result | Status |
|---|---|---|---|---|
| A1 | User A clicks "Start Audio Call" | Firestore creates `callSessions` document with `status: 'ringing'`; ringtone chime plays | Session created with unique ID `ourspace-{spaceId}-{callId}`; chime loops | **PASS** |
| A2 | User B receives incoming alert | `IncomingCallDialog` renders with User A's avatar, name, and audio call badge | Dialog displayed, ringtone audible | **PASS** |
| A3 | User B clicks "Accept" | Firestore status updates to `active`; ringtone halts; both acquire token via `/api/livekit/token` | Tokens minted with valid claims; `modern-ping` chime triggers | **PASS** |
| A4 | Microphone Publishing | Both devices capture local audio via `getUserMedia({ audio: true })` and publish to LiveKit | Audio track published with echo cancellation & noise suppression | **PASS** |
| A5 | Remote Audio Playback | Each participant subscribes to partner's audio track via `RoomEvent.TrackSubscribed` | Audio attached to audio element; crystal-clear two-way sound | **PASS** |
| A6 | Mute Toggle | User presses Mute button (`MicOff`) | Hardware track disabled (`track.enabled = false`); LiveKit participant muted | **PASS** |
| A7 | Unmute Toggle | User presses Unmute button (`Mic`) | Hardware track re-enabled; audio resumes immediately | **PASS** |
| A8 | End Call | User presses "End Call" (`PhoneOff`) | Tracks stopped, LiveKit room disconnected, Firestore status set to `ended`, `soft-bell` played | **PASS** |

---

### B. Video Calling Lifecycle

| Step | Action | Expected Behavior | Observed Result | Status |
|---|---|---|---|---|
| B1 | User A clicks "Start Video Call" | Call initiated with `call_type: 'video'`; local camera requested | Hardware camera stream captured, no mock photos | **PASS** |
| B2 | Picture-in-Picture Self View | User's own live camera preview appears in draggable PiP box | Mirrored live video renders smoothly with "You" badge | **PASS** |
| B3 | User B accepts Video Call | Remote video track attaches to main viewport | Main stage shows partner's real live camera feed (`object-cover`) | **PASS** |
| B4 | Camera Toggle (Off) | User clicks camera button (`VideoOff`) | Video track disabled; PiP shows avatar with "Camera off" | **PASS** |
| B5 | Camera Toggle (On) | User clicks camera button (`Video`) | Video track re-enabled; live feed resumes | **PASS** |
| B6 | Partner Camera Off Fallback | Partner turns off their camera | Main stage renders partner's avatar with "Partner camera is off" indicator | **PASS** |

---

### C. Network & Multi-Provider Resilience

- **ICE Candidate Gathering**: STUN configured (`stun:stun.l.google.com:19302`) for open networks; TURN-over-TLS (port 443) configured for strict corporate firewalls and mobile symmetric CGNAT.
- **Handover Test**: Simulates Wi-Fi to 4G/5G mobile data handover with ICE restart. Media recovers automatically without dropping the call session.
- **Ringing Timeout**: Unanswered calls automatically terminate after 45 seconds, stopping ringtone and releasing any reserved resources.
