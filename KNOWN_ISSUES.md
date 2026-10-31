# OURSPACE — Known Issues & Mitigations

| Issue ID | Module | Description | Severity | Status | Mitigation / Workaround |
|---|---|---|---|---|---|
| KI-001 | Calling | LiveKit Cloud credentials required for external WebRTC media routing | Medium | Documented | Graceful fallback to built-in direct WebRTC / signaling mode and explicit configuration guidance in `.env.example`. |
| KI-002 | Media | GIPHY API requires `NEXT_PUBLIC_GIPHY_API_KEY` for live search | Low | Documented | Fallback to curated animated GIF catalog and clear key setup docs. |
| KI-003 | Audio | Browser autoplay policy blocks unprompted audio playback before user interaction | Low | Resolved | AudioContext is initialized on first user interaction or banner click. |
