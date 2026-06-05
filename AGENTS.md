## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The triage state machine uses the default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

- **`CONTEXT.md`** — ubiquitous language glossary: instrument anatomy (wheel, slot, head, stone, palette), elements and notes (Earth/C4, Metal/D4, Wood/E4, Fire/G4, Water/A5), wheel state machine (READY→WINDING→TACK→SPRING_BACK→COMPLETE), performance concepts (spring-back, queued slots, play order, beat grid, tack sound, early release).
- **`docs/adr/`** — architecture decision records:
  - `0001-use-reducer-state-machine.md` — useReducer with pure reducer, 59 tests
  - `0002-css-transform-rotation.md` — CSS transforms for winding + spring-back
  - `0003-tonejs-transport-audio.md` — tone.js PluckSynth + Transport scheduling
  - `0004-angular-pointer-drag.md` — pointer events with angular delta
  - `0005-flat-file-structure-pwa.md` — flat src/ layout + Vite PWA

### Tech stack

- **Framework**: Vite + React 18 + TypeScript (strict mode)
- **State**: Single `useReducer` (`src/wheelReducer.ts`), no external library
- **Audio**: tone.js 15 (`Tone.PluckSynth`, `Tone.Transport`), raw Web Audio for tack sound
- **Styling**: Plain CSS with custom properties, BEM-ish class naming
- **Interaction**: Raw pointer events, angular-only drag, `touch-action: none`
- **Rotation**: CSS `transform: rotate()` with inline transition override for spring-back
- **PWA**: `vite-plugin-pwa` with workbox `generateSW`, offline precache, iOS meta tags
- **Testing**: Vitest + jsdom, 59 reducer tests (`src/wheelReducer.test.ts`)
- **Package manager**: bun 1.3+

### File structure (flat)

```
src/
  main.tsx, App.tsx            — entry + root component
  types.ts                     — ElementType, WheelState, WheelAction, constants
  wheelReducer.ts              — pure reducer + initialWheelState
  wheelReducer.test.ts         — 59 unit tests
  Wheel.tsx                    — pointer events, spring-back, slot rendering
  Slot.tsx                     — empty/filled/glow/dim states
  Head.tsx                     — fixed marker at 6 o'clock
  StonePalette.tsx             — 5 stone circles + Clear
  BPMControl.tsx               — range slider + "C Pentatonic"
  audio.ts                     — tone.js wrapper + tack sound
  index.css                    — all styles
```

### Key invariants

- Slots are indexed 0–9 clockwise from 12 o'clock. Head at 6 o'clock (180°).
- Rotation capped at ±360°. CW wind → forward play order. CCW → reverse.
- Empty slots are rests — the 10-beat grid is always maintained.
- Spring-back duration = `queuedSlotCount × (60 / BPM)` seconds.
- CSS transition and Transport.start() fire in the same useEffect frame.
- AudioContext resumes on first palette tap (not on wheel touch).
- Pointer events gated by mode: only `ready` and `winding` accept input.
- `PLACE_STONE` only valid in `ready` — accidental clicks during drag are no-ops.
