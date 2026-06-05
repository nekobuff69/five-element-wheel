# ADR-0005: Flat file structure + Vite PWA

## Status

Accepted (implemented).

## Context

The Five-Element Wheel is a single-screen mobile PWA with ~12 source files. We needed a project structure and build toolchain that:

- Supports React + TypeScript with strict mode
- Produces an installable PWA with offline support
- Has minimal configuration overhead
- Keeps the source tree navigable without nested feature folders

## Decision

**File structure**: All source code in `src/` — no feature folders, no `components/`, `hooks/`, `utils/` subdirectories. 11 TypeScript files + 1 CSS file:

```
src/
  main.tsx             — React entry point
  App.tsx              — Root component, useReducer host
  types.ts             — ElementType, WheelState, WheelAction, constants
  wheelReducer.ts      — Pure reducer + initial state
  wheelReducer.test.ts — 55 unit tests
  Wheel.tsx            — Pointer events, spring-back logic, slot rendering
  Slot.tsx             — Presentational: empty/filled/glow/dim
  Head.tsx             — Fixed marker at 6 o'clock
  StonePalette.tsx     — 5 stones + Clear button
  BPMControl.tsx       — Range slider + "C Pentatonic" label
  audio.ts             — native Web Audio API playback + tack
  index.css            — All styles with custom properties
```

**Build toolchain**: Vite with `@vitejs/plugin-react` and `vite-plugin-pwa`. Vitest for testing with jsdom environment. No CSS framework — plain CSS with custom properties.

**PWA**: `vite-plugin-pwa` with `generateSW` strategy. Manifest with standalone display, portrait orientation, theme color `#1a1a2e`. Icons at 192px and 512px generated programmatically. iOS meta tags (`apple-mobile-web-app-capable`, `apple-touch-icon`, `apple-mobile-web-app-status-bar-style`) in `index.html`.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Feature folders (`src/components/wheel/`, `src/state/`, etc.) | 12 files don't justify directory nesting; flat structure = single `ls` to see everything |
| CSS Modules / styled-components | Adds tooling complexity; custom properties + BEM-ish class naming is sufficient for single-screen app |
| Create React App | Vite is faster, smaller config, and PWA plugin is first-class |
| Manual service worker | `vite-plugin-pwa` with workbox generates optimal precaching with zero config |
| Next.js | SSR/SSG/routing are irrelevant for a single-screen instrument; Vite SPA is the right fit |

## Consequences

- **Positive**: A new developer can understand the entire codebase by reading 12 files in a flat directory.
- **Positive**: `bun run build` produces a 414KB PWA bundle that works fully offline after first visit.
- **Negative**: If the app grows beyond ~20 files, the flat structure will become unwieldy. At that point, extract `src/components/` and `src/state/`. The ADR should be revisited before the 20-file threshold.
- **Negative**: The 192px and 512px icons are programmatically generated placeholders (5-color wheel segments). They should be replaced with a proper designed icon before production release.
