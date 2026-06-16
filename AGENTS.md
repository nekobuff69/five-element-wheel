## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The triage state machine uses the default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

- **`CONTEXT.md`** — ubiquitous language glossary: instrument anatomy (wheel, slot, head, stone, palette, ghost stone, snap target), elements and notes (Earth/C4, Metal/D4, Wood/E4, Fire/G4, Water/A4), wheel state machine (READY→WINDING→TACK→SPRING_BACK→COMPLETE), performance concepts (spring-back, loop, loop iteration, hot reload, queued slots, play order, beat grid, tack sound, early release, stone drag, snap).
- **`docs/adr/`** — architecture decision records:
  - `0001-use-reducer-state-machine.md` — useReducer with pure reducer, 100 tests
  - `0002-css-transform-rotation.md` — CSS transforms for winding + spring-back
  - `0003-tonejs-transport-audio.md` — tone.js PluckSynth + Transport scheduling (superseded)
  - `0004-angular-pointer-drag.md` — pointer events with angular delta
  - `0005-flat-file-structure-pwa.md` — flat src/ layout + Vite PWA
  - `0006-native-web-audio-playback.md` — native Web Audio replaces tone.js
  - `0007-raf-sync-audio-visual.md` — rAF + AudioContext clock for visual sync
  - `0008-loop-playback-architecture.md` — pure audio loop with hot reload
  - `0009-stone-drag-gesture.md` — document-level pointer events + snap-to-slot

### Tech stack

- **Framework**: Vite + React 18 + TypeScript (strict mode)
- **State**: Single `useReducer` (`src/wheelReducer.ts`), no external library
- **Audio**: Native Web Audio API (OscillatorNode triangle wave + GainNode pluck envelope), single AudioContext, mid-playback slot updates via `PlaybackControl.updateSlots()`
- **Styling**: Plain CSS with custom properties, BEM-ish class naming, `touch-action: none` for mobile support
- **Interaction**: Raw pointer events, angular-only drag for wheel, document-level listeners for stone drag
- **Rotation**: CSS `transform: rotate()` with inline transition override for spring-back
- **PWA**: `vite-plugin-pwa` with workbox `generateSW`, offline precache, iOS meta tags
- **Testing**: Vitest + jsdom, 100 tests (`src/wheelReducer.test.ts`, `src/playback.test.ts`)
- **Package manager**: bun 1.3+

### File structure (flat)

```
src/
  main.tsx, App.tsx            — entry + root component
  types.ts                     — ElementType, WheelState, WheelAction, geometry constants
  wheelReducer.ts              — pure reducer + initialWheelState + helpers
  wheelReducer.test.ts         — 77 unit tests (state machine + actions)
  playback.ts                  — AudioContext, tack sound, rAF-synced playback, updateSlots for hot reload
  playback.test.ts             — 23 unit tests (updateSlots behavior)
  useWheelGesture.ts           — pointer-drag gesture hook (angular delta + threshold)
  geometry.ts                  — getSlotPosition() for snap detection
  Wheel.tsx                    — orchestrator: gesture → dispatch → playback
  Slot.tsx                     — empty/filled/glow/dim/snap-target states
  Head.tsx                     — fixed marker at 6 o'clock
  StonePalette.tsx             — 5 stone circles + Clear + stone drag gesture + ghost stone
  LoopToggle.tsx               — checkbox toggle for loop enabled/disabled
  BPMControl.tsx               — range slider + "C Pentatonic"
  index.css                    — all styles
```

### Key invariants

- Slots are indexed 0–9 clockwise from 12 o'clock. Head at 6 o'clock (180°).
- Rotation capped at ±360°. CW wind → forward play order. CCW → reverse.
- Empty slots are rests — the 10-beat grid is always maintained.
- Spring-back duration = `queuedSlotCount × (60 / BPM)` seconds.
- CSS transition and audio scheduling fire in the same useEffect frame.
- AudioContext auto-resumes on first audio-producing action (tack sound or spring-back playback).
- Pointer events gated by mode: wheel drag accepts `ready`, `winding`, `springBack`. Stone placement accepts `ready`, `springBack`.
- `PLACE_STONE` uses `action.element` if provided (stone drag), else `state.selectedStone` (click-to-place).
- `CLEAR_ALL` valid in any mode — full reset including queued slots and mode.
- `WIND` during `springBack` interrupts loop, resets queued indices for fresh wind cycle.
- Stone drag uses document-level pointer events (not container-level) to avoid gesture blocking.
- `WIND` resets rotation baseline to 0 when transitioning from `springBack` (CSS already animated to 0°)
- `RELEASE` captures approaching slot if within 10° of head (matches visual glow expectation)
- Playback handles looping internally: pre-schedules 4 iterations, extends dynamically, no gaps between loops
- Snap detection computes slot positions from `getSlotPosition()` in `geometry.ts`, rotated by current wheel rotation.
- `PlaybackControl.updateSlots()` cancels future oscillators (beats ≥ currentBeat), re-schedules with new elements. Already-played beats unchanged.
- Ghost stone fades out over 200ms on pointer up via CSS transition + setTimeout cleanup.
