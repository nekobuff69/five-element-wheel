# Five-Element Wheel · 五行輪

The Chinese five elements (五行 / wǔ xíng) mapped to a pentatonic scale. Place round mineral stones on a rotating wheel, drag to queue a sequence, release to play. Every combination of stones produces a consonant melody.

Built around the pentatonic scale (五音 / wǔ yīn): **Earth** (root), **Metal** (M2), **Wood** (M3), **Fire** (P5), **Water** (M6). The intervals form a pentatonic scale in any key. No wrong notes.

The interface is a minimal ink compass: lacquer-dark ground, paper-coloured serif type, hairline gold rules, one cinnabar seal at the reading point. The main screen fits exactly one mobile viewport and never scrolls. Short, carved feedback — sound, motion and touch — is derived from state changes (see `CONTEXT.md` and ADR-0012).

---

## Concept

五行 (Five Elements) is an ancient Chinese philosophy describing five phases of the natural world:

| Element | Character | Note (key=C) | Color |
|---------|-----------|--------------|-------|
| Earth (土) | Stability, soil — ochre | Root (宫 / Do) | `#8A6A3C` |
| Metal (金) | Structure, geometry — gold leaf | M2 (商 / Re) | `#B08D57` |
| Wood (木) | Growth, foliage — celadon | M3 (角 / Mi) | `#6E8B84` |
| Fire (火) | Energy, flame — cinnabar | P5 (徵 / Sol) | `#A8322A` |
| Water (水) | Flow, adaptability — ink blue | M6 (羽 / La) | `#4A6470` |

These five elements map to the five notes of the Chinese pentatonic scale (五音). The intervals are consonant in every key.

**Intentions:** The wheel is a physical metaphor for composing with gestures. Drag to queue, release to play, loop and re-shape in real time. Five notes, ten slots, one wheel.

---

## Features & User Experience

### Mobile-First, Gesture-Driven

The app is designed for touch. All interactions work with drag and tap, no keyboard shortcuts required. The screen is `100dvh` with scrolling disabled, so dragging the Wheel cannot shift the page.

#### 1. Place Stones

Two ways to place a stone in a slot:

- **Tap-to-place:** Tap a stone in the palette to select it (the stone brightens), then tap any empty slot.
- **Drag-to-place:** Drag a stone from the palette onto a slot. A ghost stone follows your finger and snaps to the nearest slot within 30px.

| Empty slot | Slot with stone |
|------------|----------------|
| Thin gold-rimmed nest, no index number | Round mineral seal with an engraved element character |

To **remove** a stone: tap a filled slot while the matching stone is selected, or drag the stone off the wheel (or to another slot, which moves it).

#### 2. Wind the Wheel

Drag the wheel clockwise or counter-clockwise. As each slot crosses the fixed **Head** at 6 o'clock, it becomes **queued** and is marked with a thin gold ring. The order of capture determines the play order.

| What you see | What it means |
|--------------|---------------|
| Thin gold ring on a slot | Slot is queued, will play |

Drag further to queue more slots. Turn back the other way and the last queued slot leaves the sequence as it crosses the Head again — undo is one slot at a time, from the tail only. A full rotation (360°) queues all 10. A **tack sound** (noise burst + sine blip) confirms you've reached the limit. The wheel is capped at ±360°. A small 順 / 逆 label shows the visual read order, which is the opposite of the finger's wind direction (see `CONTEXT.md`).

Each Slot crossing the Head also emits a light **crossing tick** — a filled Slot sounds brighter than an empty one, and fast winds are throttled so a quick drag does not become a burst of noise. Reaching the limit fires one deliberately heavier **tack** whose sound, compass-arc flash and haptic all come from a single event.

#### 3. Release to Play

Release the wheel. It **springs back** to its rest position while playing queued slots in encounter order:

- Each slot plays for one beat at the current BPM.
- Empty slots are rests. The beat grid is always maintained.
- Spring-back duration = `queuedSlots × (60 ÷ BPM)` seconds.

The **Head** is a cinnabar square seal showing the character of the stone currently being read; it is empty on a rest. Every slot — including an empty one — lights a cinnabar ring when its beat is read. Non-playing filled slots stay slightly dimmed; the stone itself never changes colour.

Each element has its own **material voice** (thick 土, clear 金, dry 木, bright 火, soft 水), all produced by one shared voice factory so a Stone edited mid-loop keeps exactly the same timbre. Peak loudness is normalised across all five, all sound passes through a single master gain with no reverb, and rests and loop boundaries stay silent.

#### 4. Loop Mode

With **循環** (Loop) enabled (default), the melody repeats seamlessly. Playback pre-schedules multiple cycles and extends dynamically. You can edit stones during playback — drag new ones into slots or remove existing ones. Changes apply to all future beats immediately (hot reload). The wheel stays at rest during loop.

#### 5. Interrupt the Loop

Drag the wheel during playback to interrupt the current sequence and queue a new one. The transition requires a deliberate 15° drag to prevent accidental interruption during stone editing.

#### 6. Phrase Trace & Guide

Below the Wheel, an ink chart draws the phrase you just wrote: ten beats on the horizontal axis, the five pentatonic degrees (宮商角徵羽) on the vertical. Sounded stones leave cinnabar marks joined by a hairline gold stroke; a rest breaks the stroke. Only the marks refresh at each loop iteration — the grid, degree names, and beat readout stay still.

At each loop iteration the written line **washes / re-inks** once (~180ms) while the grid, degree names and beat readout stay perfectly still. A future beat edited mid-loop shows a **wet-ink** half-filled cinnabar mark, distinct from an ordinary unplayed beat and from the snap target's dashed ring; it clears once that beat sounds. When a BPM, key, octave or loop change restarts the phrase from beat 1, a short **重起 · …** inscription replaces the beat readout for about 1.2s, then returns to the beat readout on its own — no new row, no added height. A polite, visually hidden live region announces the beat position once per beat.

A **玩法** button under the title rule opens a guide dialog with the rules of play. It does not take part in the main layout.

#### 7. Controls

| Control (UI label) | Range | Default | Description |
|---------|-------|---------|-------------|
| **調** (Key) | C, C#, D, …, B | F | Root note of the pentatonic scale |
| **八度** (Octave) | 3 – 8 | 5 | Transposition for all frequencies |
| **拍速** (BPM) | 120 – 200 | 180 | Tempo, controls playback speed |
| **循環** (Loop) | On / Off | On | Toggle melody repetition |
| **歸零** (RESET) | Button | — | Full reset to `initialWheelState` |

All controls work during playback. Changing BPM, key, octave, or loop cancels the current playback and restarts the phrase from beat 1; only stone edits are hot-reloaded into future beats.

#### 8. Feedback & Accessibility

Feedback is derived from state differences (see `CONTEXT.md` and ADR-0012) and delivered over three channels: sound, short hard-attack motion (always shorter than the shortest beat), and touch. Short **haptics** mark winding crossings, the tack, and snap-target changes (only when the target actually changes) at 8 / 20 / 5 ms; on platforms without vibration (for example iOS Safari), sound and visuals still carry the same information. With **reduced motion** enabled, every displacement animation falls back to a colour or opacity change, and states stay distinguishable by solid versus dashed line style as well as colour. No cue adds layout height, so the Wheel keeps its size on short viewports.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vite 6 + React 18 + TypeScript (strict mode) |
| State | Single `useReducer`, no external library |
| Audio | Single native AudioContext + master gain; five element voices via a shared createVoice factory; one-shot tick / tack / placement sounds; optional navigator.vibrate haptics |
| Styling | Plain CSS with custom properties, BEM-ish naming, no gradients or glows in the ink theme |
| Interaction | Raw pointer events, angular-only drag for wheel, document-level for stone drag |
| Rotation | CSS `transform: rotate()` with inline transition override for spring-back (ADR-0002) |
| Layout | Runtime viewport fitting of the fixed 360px Wheel coordinate system (ADR-0011) |
| PWA | `vite-plugin-pwa` with workbox `generateSW`, offline precache |
| Testing | Vitest 2 + jsdom, 157 tests across 7 files |

### Architecture (flat `src/`)

```
src/
  main.tsx, App.tsx            — entry + root component, guide dialog, viewport fitting
  vite-env.d.ts                — Vite type declarations
  types.ts                     — ElementType, WheelState, WheelAction, element data, KEY_NAMES
  frequencies.ts               — getElementFrequencies() pure music theory
  wheelReducer.ts              — pure reducer + initialWheelState (handles all actions)
  wheelReducer.test.ts         — 84 unit tests (state machine + actions + key/octave)
  audio.ts                     — single AudioContext + master gain, element voices, one-shots, haptics
  feedbackEvents.ts            — deriveFeedbackEvents() pure state-diff to feedback events
  feedbackEvents.test.ts       — 26 tests for the single derived-event seam
  useFeedback.ts               — consumer: sound, haptics, tack flash, view tokens
  playback.ts                  — rAF-scheduled engine; re-exports getAudioContext / playTackSound, imports createVoice
  playback.test.ts             — 11 playback lifecycle / node-cleanup tests
  detection.test.ts            — 10 slot-crossing detection tests
  direction-bias.test.ts       — 3 wind-direction tests
  visual-feedback.test.ts      — 4 visual-state tests
  phraseTrace.ts               — buildPhraseTrace() pure computation
  phraseTrace.test.ts          — 13 phrase-trace tests
  useWheelGesture.ts           — pointer-drag gesture hook (angular delta + commit threshold)
  useWheelPlayback.ts          — hook: spring-back lifecycle, hot-reload sync
  useSlotDrag.ts               — hook: drag an existing Stone between Slots or off the Wheel
  useFitWheel.ts               — hook: fit the 360px Wheel into the remaining viewport height
  geometry.ts                  — getSlotPosition(), findSnapTarget(), findSnapTargetFromDOM(), angle constants
  Wheel.tsx                    — compass arc, Slots, Head, needle, ghost stone, phrase trace
  Slot.tsx                     — empty/filled/queued/playing/dimmed/snap-target states
  Head.tsx                     — cinnabar square seal at 6 o'clock
  PhraseTraceView.tsx          — ink chart: 10 beats x 5 degrees, static grid, washing marks
  StonePalette.tsx             — 5 mineral Stones + 歸零 + palette drag gesture
  LoopToggle.tsx               — 循環 checkbox
  BPMControl.tsx               — 調 / 八度 / 拍速 controls
  index.css                    — all styles
```

### Key Architecture Decisions

The state machine has 3 modes: `ready` → `winding` → `springBack`. Tack is derived from rotation (≥ 360°), not stored as a mode. All state transitions go through a pure reducer: deterministic, testable, no side effects. Feedback events are derived from state differences by `deriveFeedbackEvents()` and consumed by `useFeedback()`; the reducer is never an event source (ADR-0012).

Audio timing comes from `AudioContext.currentTime`, synced to the visual frame loop via `requestAnimationFrame`. During loop playback, `PlaybackControl.updateSlots()` cancels every node of a future Voice (including 木 pre-scheduled noise transient) and re-schedules with new elements. Already-played beats are left alone.

The beat callback reports the queue index on every beat, including rests, so an empty Slot can show that it is being read.

A 15° commit threshold on wheel drag prevents accidental loop interruption during stone editing. You have to drag deliberately past that angle before the interrupt fires.

---

## Dev Guide

### Prerequisites

- [bun](https://bun.sh) 1.3+ (the lockfile is `bun.lock`). With npm/node instead, run the same `package.json` scripts with `npm run …`.

### Clone and Run

```bash
git clone https://github.com/nekobuff69/five-element-wheel
cd five-element-wheel
bun install
bun run dev
```

Opens at `http://localhost:5173/` (or next available port).

### Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with hot reload |
| `bun run build` | Type-check and build to `dist/` |
| `bun run preview` | Preview production build locally |
| `bun run test` | Run full test suite (157 tests) |
| `bunx tsc --noEmit` | Type check without emitting |

### Project Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vite-plugin-pwa": "^0.21.1",
    "vitest": "^2.1.8"
  }
}
```

### Building

```bash
bun run build
```

Output goes to `dist/`. The build produces a fully offline-capable PWA with service worker and asset precaching.

### Testing Philosophy

The suite has 157 tests in seven files: reducer purity and action guards (`wheelReducer.test.ts`, 88), the derived feedback-event seam (`feedbackEvents.test.ts`, 28), playback `updateSlots` (`playback.test.ts`, 11), slot-crossing detection (`detection.test.ts`, 10), wind-direction bias (`direction-bias.test.ts`, 3), Head candidate selection (`visual-feedback.test.ts`, 4), and the pure phrase-trace computation (`phraseTrace.test.ts`, 13). `deriveFeedbackEvents` is the single automated seam for the audiovisual-feedback feature; CSS, SVG rendering, timbre and haptics are verified visually and by ear, not asserted in tests, per project convention.

```bash
bun run test
```

---

## Project Status

A hobby project. A musical gadget that makes nice sounds when you drag stones around a wheel. Not a proper instrument with expectations. Just something to play with, zero pressure.

If you want to build on it, go ahead.

---

## Further Reading

- Architecture decisions: [`docs/adr/`](docs/adr/)
- Domain glossary: [`CONTEXT.md`](CONTEXT.md)
- Agent documentation: [`AGENTS.md`](AGENTS.md)

`docs/issues/` and `docs/prd/` are historical tickets from the loop/stone-drag work. They describe the requirements at the time, not the current implementation; use `CONTEXT.md` and the ADRs as the source of truth.
