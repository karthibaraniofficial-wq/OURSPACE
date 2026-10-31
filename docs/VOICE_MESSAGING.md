# OURSPACE V2.3 — VOICE MESSAGING & SPEECH TYPING ARCHITECTURE

## 1. Overview
Voice communication in OURSPACE V2.3 introduces two distinct, high-fidelity capabilities:
1. **Voice Notes**: Recording and sending actual audio messages with waveform preview, seek controls, and variable playback speeds.
2. **Voice-to-Text Typing**: Real-time microphone speech recognition inside the text composer supporting English and Tamil.

---

## 2. Voice Notes Recording Architecture
### Recording Engine
- **Web API**: `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder`.
- **Audio Formats**:
  - Primary: `audio/webm;codecs=opus` (Chrome, Firefox, Edge, Android).
  - Secondary fallback: `audio/mp4` (Safari, iOS WebKit).
- **Audio Capture Flow**:
  1. Operator taps or holds the microphone button.
  2. Recording timer starts with real-time `mm:ss` counter.
  3. CSS-animated waveform visualizer pulses to indicate audio activity.
  4. Operator can Pause, Resume, or Discard (Trash icon).
  5. Operator can Preview the recording via local HTML5 audio playback before sending.
  6. On Send, audio is uploaded as a Base64 data URL attachment or private storage object.

### Playback Experience
- **Variable Speeds**:
  - `1x`: Normal natural cadence.
  - `1.5x`: Accelerated listening.
  - `2x`: High-speed playback.
- **Interactive Controls**:
  - Play/Pause toggle.
  - Precise seek scrubber slider.
  - Elapsed and total duration time indicators.
  - Download audio action.

---

## 3. Voice-to-Text Speech Recognition (English & Tamil)
- **Engine**: W3C Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- **Language Switcher**:
  - `EN`: `en-US` (English United States)
  - `TA`: `ta-IN` (Tamil India)
- **Operational Workflow**:
  1. User clicks the microphone icon beside the text composer.
  2. Spoken phrases are converted into interim transcripts.
  3. The transcribed text streams directly into the text box.
  4. The user can review, edit, append additional text, and hit Send.
  5. Audio is processed on-device when supported by the client browser engine.

---

## 4. Privacy & Consent
- Voice notes are restricted to the authorized couple space.
- Audio recordings are never automatically dispatched without operator review and send confirmation.
- No audio is transmitted to third-party advertising or analytics networks.
