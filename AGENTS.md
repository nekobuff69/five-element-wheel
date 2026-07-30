## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The triage state machine uses the default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

- **`CONTEXT.md`** — ubiquitous language glossary: instrument anatomy (wheel, slot, head, stone, palette, ghost stone, snap target), elements and notes (Earth/root, Metal/M2, Wood/M3, Fire/P5, Water/M6), wheel state machine (READY→WINDING→SPRING_BACK→COMPLETE), performance concepts (spring-back, loop, loop iteration, hot reload, key, octave, frequency computation, queued slots, play order, beat grid, tack sound, early release, stone drag, snap).
- **`docs/adr/`** — architecture decision records:
  - `0001-use-reducer-state-machine.md` — useReducer with pure reducer, 111 tests
  - `0002-css-transform-rotation.md` — CSS transforms for winding + spring-back
  - `0003-tonejs-transport-audio.md` — tone.js PluckSynth + Transport scheduling (superseded)
  - `0004-angular-pointer-drag.md` — pointer events with angular delta
  - `0005-flat-file-structure-pwa.md` — flat src/ layout + Vite PWA
  - `0006-native-web-audio-playback.md` — native Web Audio replaces tone.js
  - `0007-raf-sync-audio-visual.md` — rAF + AudioContext clock for visual sync
  - `0008-loop-playback-architecture.md` — pure audio loop with hot reload
  - `0009-stone-drag-gesture.md` — document-level pointer events + snap-to-slot
  - `0010-springback-commit-threshold.md` — 15° commit threshold for springBack drag to prevent accidental loop interruption

### Tech stack

- **Framework**: Vite + React 18 + TypeScript (strict mode)
- **State**: Single `useReducer` (`src/wheelReducer.ts`), no external library
- **Audio**: Native Web Audio API (OscillatorNode triangle wave + GainNode pluck envelope), single AudioContext, mid-playback slot updates via `PlaybackControl.updateSlots()`
- **Styling**: Plain CSS with custom properties, BEM-ish class naming, `touch-action: none` for mobile support
- **Interaction**: Raw pointer events, angular-only drag for wheel, document-level listeners for stone drag
- **Rotation**: CSS `transform: rotate()` with inline transition override for spring-back
- **PWA**: `vite-plugin-pwa` with workbox `generateSW`, offline precache, iOS meta tags
- **Testing**: Vitest + jsdom, 111 tests (`src/wheelReducer.test.ts`, `src/playback.test.ts`)
- **Package manager**: bun 1.3+

### File structure (flat)

```
src/
  main.tsx, App.tsx            — entry + root component
  types.ts                     — ElementType, WheelState, WheelAction, element data (colors, symbols, intervals), KEY_NAMES
  frequencies.ts               — getElementFrequencies() pure music theory (key + octave → Hz)
  wheelReducer.ts              — pure reducer + initialWheelState + helpers (handles SET_KEY, SET_OCTAVE)
  wheelReducer.test.ts         — 102 unit tests (state machine + actions + key/octave)
  playback.ts                  — AudioContext singleton, tack sound, rAF-synced scheduling engine with hot reload
  playback.test.ts             — 23 unit tests (updateSlots behavior + frequencies)
  useWheelGesture.ts           — pointer-drag gesture hook (angular delta + threshold + springBack commit threshold)
  useWheelPlayback.ts          — hook: tack detection/sound, spring-back playback lifecycle, hot-reload sync
  geometry.ts                  — getSlotPosition(), findSnapTarget(), geometry constants (slot angles, orbit radius)
  Wheel.tsx                    — render component: gesture hook + playback hook → dispatch + visual layout
  Slot.tsx                     — empty/filled/glow/dim/snap-target states
  Head.tsx                     — fixed marker at 6 o'clock
  StonePalette.tsx             — 5 stone circles + Reset + stone drag gesture via geometry.findSnapTarget()
  LoopToggle.tsx               — checkbox toggle for loop enabled/disabled
  BPMControl.tsx               — Key selector (12 notes) + Octave selector (-2..+2) + BPM slider (60-180)
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
- Wheel drag during springBack requires 15° commit threshold to prevent accidental loop interruption
- Tack sound plays when rotation crosses 360° during winding (derived value, not a mode transition)
- `PLACE_STONE` uses `action.element` if provided (stone drag), else `state.selectedStone` (click-to-place).
- `RESET` valid in any mode — full reset to initialWheelState (slots, rotation, direction, bpm, loop, key, octave, selectedStone)
- `WIND` during `springBack` interrupts loop, resets queued indices for fresh wind cycle.
- Stone drag uses document-level pointer events (not container-level) to avoid gesture blocking.
- `WIND` resets rotation baseline to 0 when transitioning from `springBack` (CSS already animated to 0°)
- Only queued slots glow during winding (`slot--queued` class); approaching slot has no special styling
- Playback handles looping internally: pre-schedules 4 iterations, extends dynamically, no gaps between loops
- Snap detection uses `findSnapTarget()` in `geometry.ts`, which computes rotated slot positions via `getSlotPosition()` and finds the nearest within threshold.
- `PlaybackControl.updateSlots()` cancels future oscillators (beats ≥ currentBeat), re-schedules with new elements. Already-played beats unchanged.
- Ghost stone fades out over 200ms on pointer up via CSS transition + setTimeout cleanup.
- Key is stored as a 12-tone chromatic name (`C`, `C#`, …, `B`) in `state.key`. Pentatonic intervals preserved across all keys.
- Octave is stored as an integer 3..8 in `state.octave`. All frequencies multiplied by 2^octave.
- Default BPM is 180, default key is 'F', default octave is 5.
- `COMPLETE` preserves `state.key` and `state.octave` along with slots, selectedStone, BPM.
- First-use hint shown when all slots empty and mode is ready; dismissed on first WIND action
- Stone removal: click a filled slot with matching selectedStone to remove, or drag stone off wheel to remove (useSlotDrag hook)
