# ADR-0012: Derived-event audiovisual feedback

## Status

Accepted (implemented). Part of spec #3, delivered after the ink-compass redesign.

## Context

The wheel had a complete minimal-ink visual and a stable state machine, but feedback was thin: winding (the core "record a beat" gesture) had almost no audible or tactile response, the five elements differed only in pitch while sharing one triangle wave and one envelope, and placement, removal, snapping, hot reload, loop boundaries and parameter-driven restarts had no distinct confirmation. Visual cues were static too: the Head's seal press faded in instead of stamping, the queued ring appeared instantly, and the phrase trace gave no "new line" signal after a loop.

The goal is to make every perceptible state change legible over sound, motion and touch, while keeping the ink aesthetic (carving, pressing, stamping, inking; short hard-attack quick-decay motion, shorter than the shortest beat, 300ms at BPM 200; no gradients, glows, shadows, particles or bounce), preserving the existing audio-visual sync and single-AudioContext structure, and adding no layout height (ADR-0011).

## Decision

### 1. One derived event stream

`deriveFeedbackEvents(prev, next, playback?)` is a pure function from two `WheelState` snapshots (plus a playback signal) to an ordered `FeedbackEvent[]`. It is the single highest seam and the only automated seam for this feature (`feedbackEvents.test.ts`). The reducer stays pure and is never an event source; events are derived from differences — queue growth, a 360-degree rotation crossing, slot edits, playback index changes, loop wrap, and parameter changes during spring-back — never dispatched from reducers or view handlers.

`useFeedback` is the single consumer: it holds the previous state and previous playing index, derives events on every change, and dispatches them to sound, haptics and the tack flash. The tack — formerly detected independently in two places (an audio rotation threshold and an arc-flash timer) — is now one event driving its sound, arc flash and haptic together. Event kinds: `slot-crossed`, `tack`, `stone-placed`, `stone-removed`, `snap-changed`, `beat-read`, `loop-iteration`, `hot-reload-pending`, `parameter-restart`.

### 2. Single AudioContext and one master gain

All audio lives behind `getAudioContext()` in `audio.ts`, which creates exactly one native `AudioContext` (ADR-0006) and one master `GainNode` (level 0.9) in front of the destination. Every one-shot (crossing tick, placement, tack) and every note connects to that master output, so the instrument has one consistent level. `tryGetAudioContext()` is crash-safe when Web Audio is absent, and `unlockAudio()` resumes the context inside the first pointer-down gesture. No audio library, no sample files, no reverb, no volume UI. One-shots use `AudioContext.currentTime`; already-scheduled notes keep `t0 + absoluteBeat * beatInterval` and never rebase `t0`.

### 3. Shared `createVoice` factory

`createVoice(ctx, element, freq, startTime, noteDuration)` is the single source of a sounded Stone. Both `scheduleNote()` (initial scheduling) and `updateSlots()` (hot reload) call it, so a Stone edited mid-loop keeps exactly the same timbre. Five material timbres (土 triangle with low-pass, 金 triangle plus a quiet second harmonic on the same oscillator, 木 saw with a downward filter sweep, 火 saw with low-pass, 水 sine with a long tail) share one peak gain (0.38) so changing a Stone never jumps in loudness. Each note creates exactly one oscillator; the 金 upper partial uses `setPeriodicWave` on that same oscillator. Optional Web Audio features are feature-detected so partial implementations (and the minimal test mock) degrade to a plain voice.

### 4. One-shots, haptics, and the snap-changed exception

A crossing tick is a 12–18ms filtered noise burst (brighter for a filled Slot); the tack is a deliberately heavier 30ms burst plus blip; placement and removal are short low-frequency transients. Rests and loop boundaries are silent. `haptic(kind)` guards `navigator.vibrate` and is a no-op where it is unavailable, so sound and visuals always carry the same information. Durations: cross 8ms, tack 20ms, snap 5ms, beat 4ms, place 8ms. A beat-read with `hasStone` fires the beat haptic (never on a rest); `stone-placed` fires the place haptic.

`snap-changed` is the one event not emitted by `deriveFeedbackEvents`: the snap target is transient pointer state, not part of `WheelState`. The two drag hooks (`useSlotDrag` and the palette's drag handler) own the snap-target refs and fire `haptic('snap')` directly, only when the resolved slot index actually changes — never on every pointer move — and add no sound. The `case 'snap-changed'` branch in `useFeedback` is intentionally a no-op in the derived stream.

### 5. View tokens and zero-height visual cues

`useFeedback` exposes four view tokens: `tackFlash`, `restartNote` (a Chinese label auto-cleared after 1.2s on a parameter restart), `pendingSlots` (accumulated hot-reload-edited slot indices, cleared on `loop-iteration`), and `washToken` (incremented on `loop-iteration`). `PhraseTraceView` re-keys only the marks group by `washToken`, so a ~180ms wash / re-ink replays once at each loop boundary while the grid, degree names and caption never re-mount or animate. A hot-reloaded future beat renders a half-filled cinnabar "wet ink" mark (solid ring plus half disc), distinct from the dashed pending hollow and the snap target's dashed ring; it clears once the beat is played. The restart inscription replaces the beat readout in the existing caption slot. Every new cue is an SVG-internal mark, a pseudo-element, an absolutely positioned layer, or caption text substitution — zero added DOM height, so `useFitWheel` still measures the same sibling heights (ADR-0011).

### 6. Accessibility

A visually hidden, zero-height `aria-live="polite"` region announces the beat caption at most once per beat (its text changes only on beat boundaries; React leaves the DOM text node untouched on other re-renders). States are distinguishable by line style (solid versus dashed) as well as colour. Every new displacement animation has a `prefers-reduced-motion` alternative that uses only colour or opacity (the wash drops its translate, the wet-ink mark keeps a gentle opacity fade). Colour is never the sole carrier of information.

## Compatibility with existing decisions

| ADR | Constraint | How this ADR stays inside it |
|-----|-----------|------------------------------|
| [0002 CSS-transform rotation](./0002-css-transform-rotation.md) | `.wheel` keeps its inline `transform` / `transition` and spring-back override | No change to `.wheel` or its inline style; the unified tack flash reuses the existing compass arc. |
| [0006 Native Web Audio](./0006-native-web-audio-playback.md) | Exactly one `AudioContext` on the page; no audio library or sample files | All notes and one-shots go through the same `getAudioContext()` and master gain; `audio.ts` adds no dependency. |
| [0007 rAF audio-visual sync](./0007-raf-sync-audio-visual.md) | `t0 = ctx.currentTime + 0.05`; rAF polls `ctx.currentTime`; every beat (including rests) is reported | Playback scheduling, the shared `t0`, rAF beat reporting and the COMPLETE dispatch are untouched. One-shots read `currentTime` and never rebase `t0`. The loop-iteration wash is keyed off a derived event, not a new clock. |
| [0010 15-degree commit threshold](./0010-springback-commit-threshold.md) | No "about to interrupt" cue before the drag commits | No interruption cue is added; feedback is emitted only from committed state differences. |
| [0011 Fit wheel to viewport](./0011-fit-wheel-to-viewport-height.md) | Any new DOM height shrinks the Wheel | All new cues are zero-height (SVG marks, pseudo-elements, absolutely positioned layers, caption text substitution); the live region is absolutely positioned and clipped. |

If a future change needs to touch `.wheel` rotation or the audio clock, the relevant ADR must be reopened rather than silently overridden.

## Consequences

- **Positive**: One event seam is unit-tested; CSS, SVG, timbre and haptics are verified manually per project convention. The tack's sound, light and touch share one moment. Timbre is identical before and after a mid-loop edit.
- **Positive**: A pure reducer and a single AudioContext remain intact; the offline PWA loads instantly with no new dependency.
- **Positive**: Feedback is legible with sound muted, motion reduced, or vibration unavailable, and accessible to screen readers once per beat.
- **Negative**: `snap-changed` is the one channel that bypasses the derived stream (it is pointer-local state); documented here so it is a deliberate exception, not drift.
- **Negative**: Gains, durations and filter frequencies are design starting points tuned by ear; final values need real-device listening on a phone speaker.
- **Negative**: Vibration support on iOS Safari and first-gesture audio unlock across mobile browsers are unverified from the codebase and remain device checks.
