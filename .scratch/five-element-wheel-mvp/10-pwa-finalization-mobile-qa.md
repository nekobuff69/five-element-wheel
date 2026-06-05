# PWA finalization + mobile QA

**Type:** AFK
**Label:** ready-for-agent

## What to build

Finalize the PWA for mobile demo readiness. Replace placeholder icons with the actual Five-Element Wheel app icon at 192px and 512px (can be a simple colored wheel icon for MVP). Verify the install prompt appears on Chrome Android and Safari iOS. Confirm all assets (JS, CSS, HTML, service worker) are precached for offline use. Run through the complete user flow on an actual phone: install → open → arrange stones → wind wheel → release → hear melody with correct timing. Fix any mobile-specific issues (viewport sizing, touch event responsiveness, audio autoplay handling, iOS PWA quirks).

## Acceptance criteria

- [ ] App icon (192px, 512px) set in manifest
- [ ] Install prompt fires on Chrome Android
- [ ] App opens standalone (no browser chrome) on iOS when added to home screen
- [ ] Full offline: app loads and plays sound with no network connection
- [ ] Complete user flow works on a phone: install, place stones, wind, release, hear melody
- [ ] Audio plays on both iOS Safari and Chrome Android without requiring additional gestures beyond the stone palette tap
- [ ] Viewport fits without clipping; no horizontal scroll on 375px+ screens

## Blocked by

- #1–9 (all prior issues)
