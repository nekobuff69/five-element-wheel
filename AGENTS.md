## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The triage state machine uses the default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

- **`CONTEXT.md`** — ubiquitous language glossary: instrument anatomy (wheel, slot, head, stone, palette, ghost stone, snap target), elements and notes (Earth/root, Metal/M2, Wood/M3, Fire/P5, Water/M6), wheel state machine (READY→WINDING→SPRING_BACK), visual feedback (phrase trace, seal press, guide dialog), direction labels (順/逆), performance concepts (spring-back, loop, loop iteration, hot reload, key, octave, frequency computation, queued slots, play order, beat grid, tack sound, early release, stone drag, snap).
- **`docs/adr/`** — architecture decision records:
  - `0001-use-reducer-state-machine.md` — useReducer with pure reducer (historical: recorded 111 tests; current suite is 120)
  - `0002-css-transform-rotation.md` — CSS transforms for winding + spring-back
  - `0003-tonejs-transport-audio.md` — tone.js PluckSynth + Transport scheduling (superseded by 0006)
  - `0004-angular-pointer-drag.md` — pointer events with angular delta
  - `0005-flat-file-structure-pwa.md` — flat src/ layout + Vite PWA (historical file counts)
  - `0006-native-web-audio-playback.md` — native Web Audio replaces tone.js
  - `0007-raf-sync-audio-visual.md` — rAF + AudioContext clock for visual sync
  - `0008-loop-playback-architecture.md` — pure audio loop with hot reload
  - `0009-stone-drag-gesture.md` — document-level pointer events + snap-to-slot
  - `0010-springback-commit-threshold.md` — 15° commit threshold for springBack drag to prevent accidental loop interruption
  - `0011-fit-wheel-to-viewport-height.md` — fit the 360px wheel into one non-scrolling mobile viewport

### Tech stack

- **Framework**: Vite 6 + React 18 + TypeScript (strict mode)
- **State**: Single `useReducer` (`src/wheelReducer.ts`), no external library
- **Audio**: Native Web Audio API (OscillatorNode triangle wave + GainNode pluck envelope), single AudioContext, mid-playback slot updates via `PlaybackControl.updateSlots()`
- **Styling**: Plain CSS with custom properties, BEM-ish class naming, `touch-action: none` for mobile support; minimal ink theme (no gradients or glows)
- **Interaction**: Raw pointer events, angular-only drag for wheel, document-level listeners for stone drag
- **Rotation**: CSS `transform: rotate()` with inline transition override for spring-back
- **Layout**: `100dvh` no-scroll main view; `useFitWheel` scales the fixed 360px Wheel frame into remaining height (ADR-0011)
- **PWA**: `vite-plugin-pwa` with workbox `generateSW`, offline precache, iOS meta tags
- **Testing**: Vitest 2 + jsdom, 120 tests across 6 files (`wheelReducer.test.ts` 84, `playback.test.ts` 6, `phraseTrace.test.ts` 13, `detection.test.ts` 10, `direction-bias.test.ts` 3, `visual-feedback.test.ts` 4)
- **Package manager**: bun 1.3+ (`bun.lock`); npm/node can run the same `package.json` scripts
- **Deployment**: Cloudflare Pages (Git integration, classic Pages project) — push to `main` builds with `npm install -g bun && bun install --frozen-lockfile && bun run build`, output `dist`, live at https://five-element-wheel.pages.dev/; other branches get preview deployments. Vite `base` must stay `/` (serves at domain root). GitHub Pages workflow removed in the cutover.

### File structure (flat)

```
src/
  main.tsx, App.tsx            — entry + root component, 玩法 guide dialog, viewport ref
  vite-env.d.ts                — Vite type declarations
  types.ts                     — ElementType, WheelState, WheelAction, element data, KEY_NAMES
  frequencies.ts               — getElementFrequencies() pure music theory (key + octave → Hz)
  wheelReducer.ts              — pure reducer + initialWheelState + helpers
  wheelReducer.test.ts         — 84 unit tests (state machine + actions + key/octave)
  playback.ts                  — AudioContext singleton, tack sound, rAF-scheduled engine with hot reload
  playback.test.ts             — 6 updateSlots tests
  detection.test.ts            — 10 slot-crossing detection tests
  direction-bias.test.ts       — 3 wind-direction tests
  visual-feedback.test.ts      — 4 visual-state tests
  phraseTrace.ts               — buildPhraseTrace() pure computation, the single ink-theme test seam
  phraseTrace.test.ts          — 13 phrase-trace tests
  useWheelGesture.ts           — pointer-drag gesture hook (angular delta + threshold + springBack commit threshold)
  useWheelPlayback.ts          — hook: tack detection/sound, spring-back lifecycle, hot-reload sync
  useSlotDrag.ts               — hook: drag an existing Stone between Slots or off the Wheel
  useFitWheel.ts               — hook: fit the 360px Wheel into the remaining viewport height
  geometry.ts                  — getSlotPosition(), findSnapTarget(), findSnapTargetFromDOM(), geometry constants
  Wheel.tsx                    — compass arc, Slots, Head, needle, ghost stone, phrase trace
  Slot.tsx                     — empty/filled/queued/playing/dimmed/snap-target states
  Head.tsx                     — cinnabar square seal at 6 o'clock
  PhraseTraceView.tsx          — ink chart: 10 beats x 5 degrees, static grid, clearing marks
  StonePalette.tsx             — 5 mineral Stones + 歸零 + palette drag via findSnapTargetFromDOM()
  LoopToggle.tsx               — 循環 checkbox
  BPMControl.tsx               — 調 / 八度 / 拍速 controls
  index.css                    — all styles
```

### Key invariants

- Slots are indexed 0–9 and placed clockwise along a 300° arc starting at 210° (7 o'clock), leaving a 60° reading gap at the Head (6 o'clock / 180°). `SLOT_START_ANGLE = 210`, `SLOT_ANGLE_SPAN = 300/9`.
- Rotation capped at ±360°. CW wind → forward play order, CCW → reverse. The UI label 順/逆 shows the *visual read order*, which is the opposite of the finger's wind direction (CW is labelled 逆).
- Empty slots are rests — the 10-beat grid is always maintained. The beat callback reports the queue index on every beat, including rests.
- Spring-back duration = `queuedSlotCount × (60 / BPM)` seconds.
- CSS transition and audio scheduling fire in the same useEffect frame.
- AudioContext auto-resumes on first audio-producing action (tack sound or spring-back playback).
- Pointer events gated by mode: wheel drag accepts `ready`, `winding`, `springBack`. Stone placement accepts `ready`, `springBack`.
- Wheel drag during springBack requires a 15° commit threshold to prevent accidental loop interruption.
- Tack sound plays when rotation crosses 360° during winding (derived value, not a mode transition).
- `PLACE_STONE` uses `action.element` if provided (stone drag), else `state.selectedStone` (click-to-place).
- `RESET` valid in any mode — full reset to initialWheelState (slots, rotation, direction, bpm, loop, key, octave, selectedStone).
- `WIND` during `springBack` interrupts loop, resets queued indices for fresh wind cycle.
- Stone drag uses document-level pointer events (not container-level) to avoid gesture blocking.
- `WIND` resets rotation baseline to 0 when transitioning from `springBack` (CSS already animated to 0°).
- Queued Slots get a thin gold ring (`slot--queued`); an approaching Slot has no special styling. The playing Slot gets a cinnabar ring, including when it is empty; the Stone itself never changes colour.
- Playback handles looping internally: pre-schedules 4 iterations, extends dynamically, no gaps between loops.
- Snap detection uses `findSnapTargetFromDOM()` (rendered `getBoundingClientRect()` positions), not the mathematical `findSnapTarget()`.
- `PlaybackControl.updateSlots()` cancels future oscillators (beats ≥ currentBeat), re-schedules with new elements. Already-played beats unchanged.
- Ghost stone fades out over 200ms on pointer up via CSS transition + setTimeout cleanup. Drag ghosts render outside the scaled Wheel container so `position: fixed` tracks the finger.
- Key is stored as a 12-tone chromatic name (`C`, `C#`, …, `B`) in `state.key`. Pentatonic intervals preserved across all keys.
- Octave is stored as an integer 3..8 in `state.octave`. `rootFreq = 261.63 × 2^(semitoneFromC/12 + (octave - 4))`; element frequencies add `2^(interval/12)`.
- Default BPM is 180 (range 120–200), default key is 'F', default octave is 5.
- `COMPLETE` preserves `state.key` and `state.octave` along with slots, selectedStone, BPM.
- Changing BPM, key, octave, or loop during spring-back cancels playback and restarts the phrase from beat 1 (those fields are effect dependencies). Only stone edits are hot-reloaded.
- Phrase trace: `buildPhraseTrace()` maps the five element intervals to 宮商角徵羽, joins consecutive sounded beats, breaks the stroke at rests, and clears marks at a loop iteration boundary. Base grid elements never change opacity.
- Main view is `100dvh` with `overflow: hidden`; `useFitWheel` measures the non-wheel chrome and scales `--wheel-scale` so nothing scrolls (ADR-0011).
- The 玩法 guide dialog is a fixed overlay opened by the button under the title rule. There is no first-use hint. Guide copy is Traditional Chinese with unnumbered bullets.
- Stone removal: click a filled slot with matching selectedStone to remove, or drag stone off wheel to remove (useSlotDrag hook).
