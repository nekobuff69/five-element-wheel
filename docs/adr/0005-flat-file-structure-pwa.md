# ADR-0005: Flat file structure + Vite PWA

## Status

Accepted (implemented).

## Context

The Five-Element Wheel is a single-screen mobile PWA. We needed a project structure and build toolchain that:

- Supports React + TypeScript with strict mode
- Produces an installable PWA with offline support
- Has minimal configuration overhead
- Keeps the source tree navigable without nested feature folders

## Decision

**File structure**: All source code in `src/` — no feature folders, no `components/`, `hooks/`, `utils/` subdirectories. The tree currently holds 26 TypeScript files + 1 CSS file:

```
src/
  main.tsx, App.tsx            — entry + root component, 玩法 guide dialog
  vite-env.d.ts                — Vite type declarations
  types.ts                     — ElementType, WheelState, WheelAction, element data, KEY_NAMES
  frequencies.ts               — getElementFrequencies() pure music theory
  wheelReducer.ts              — pure reducer + initial state
  wheelReducer.test.ts         — 84 unit tests
  playback.ts                  — native Web Audio scheduling engine: AudioContext singleton, tack sound, rAF-synced playback, loop with hot reload
  playback.test.ts             — 6 updateSlots tests
  detection.test.ts            — 10 slot-crossing detection tests
  direction-bias.test.ts       — 3 wind-direction tests
  visual-feedback.test.ts      — 4 visual-state tests
  phraseTrace.ts               — buildPhraseTrace() pure computation
  phraseTrace.test.ts          — 13 phrase-trace tests
  useWheelGesture.ts           — pointer-drag gesture hook
  useWheelPlayback.ts          — hook: tack detection/sound, spring-back lifecycle, hot-reload sync
  useSlotDrag.ts               — hook: drag an existing Stone between Slots or off the Wheel
  useFitWheel.ts               — hook: fit the 360px Wheel into the remaining viewport height
  geometry.ts                  — getSlotPosition(), findSnapTarget(), findSnapTargetFromDOM(), geometry constants
  Wheel.tsx                    — compass arc, Slots, Head, needle, ghost stone, phrase trace
  Slot.tsx                     — presentational: empty/filled/queued/playing/dimmed/snap-target
  Head.tsx                     — cinnabar square seal at 6 o'clock
  PhraseTraceView.tsx          — ink chart: 10 beats x 5 degrees, static grid, clearing marks
  StonePalette.tsx             — 5 mineral Stones + 歸零 + palette drag via findSnapTargetFromDOM()
  LoopToggle.tsx               — 循環 checkbox
  BPMControl.tsx               — 調 (12 notes) + 八度 (3..8) + 拍速 (120-200)
  index.css                    — all styles with custom properties
```

**Build toolchain**: Vite with `@vitejs/plugin-react` and `vite-plugin-pwa`. Vitest for testing with jsdom environment. No CSS framework — plain CSS with custom properties.

**PWA**: `vite-plugin-pwa` with `generateSW` strategy. Manifest with standalone display, portrait orientation, theme color `#12100e` (matching the ink theme). Icons at 192px and 512px. iOS meta tags (`apple-mobile-web-app-capable`, `apple-touch-icon`, `apple-mobile-web-app-status-bar-style`) in `index.html`.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Feature folders (`src/components/wheel/`, `src/state/`, etc.) | At the time, the file count did not justify directory nesting; flat structure = one listing to see everything |
| CSS Modules / styled-components | Adds tooling complexity; custom properties + BEM-ish class naming is sufficient for single-screen app |
| Create React App | Vite is faster, smaller config, and PWA plugin is first-class |
| Manual service worker | `vite-plugin-pwa` with workbox generates optimal precaching with zero config |
| Next.js | SSR/SSG/routing are irrelevant for a single-screen instrument; Vite SPA is the right fit |

## Consequences

- **Positive**: A new developer can understand the entire codebase by reading the flat `src/` tree.
- **Positive**: `bun run build` produces a fully offline PWA; the current build precaches 9 entries (~206 KiB).
- **Negative**: The tree now exceeds the original ~20-file threshold, but the flat structure is still manageable because the modules are small and single-concern. Revisit only if a second screen or feature domain is added.
- **Negative**: The 192px and 512px icons are programmatically generated placeholders (5-color wheel segments). They should be replaced with a proper designed icon before production release.

> Historical note: this ADR originally listed 13–15 source files, a `#1a1a2e` theme color, a 60–180 BPM slider, and a -2..+2 octave selector. Those described the first implementation; the list and values above are the current code.
