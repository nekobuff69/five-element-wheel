# Project scaffold + PWA shell

**Type:** AFK
**Label:** ready-for-agent

## What to build

Bootstrap the Five-Element Wheel app with Vite + React + TypeScript + tone.js. Configure `vite-plugin-pwa` with a web app manifest and service worker for offline installability. Placeholder 192px and 512px app icons. The app renders an empty screen on mobile and triggers the browser install prompt.

## Acceptance criteria

- [ ] `vite` dev server starts, renders a blank React page
- [ ] TypeScript compiles with strict mode
- [ ] tone.js is a dependency and imports without errors
- [ ] `vite-plugin-pwa` generates a service worker on production build
- [ ] `manifest.json` includes `name`, `short_name`, `icons` (192px, 512px placeholders), `display: standalone`, `theme_color`
- [ ] App is installable on a mobile browser (Chrome Android / Safari iOS)

## Blocked by

None — can start immediately.
