# ADR-0006: Native Web Audio API for spring-back playback

## Status

Accepted (implemented). Supersedes [ADR-0003](./0003-tonejs-transport-audio.md).

## Context

ADR-0003 used `Tone.PluckSynth` + `Tone.Transport` for spring-back note scheduling. This worked on desktop but was **silent on mobile Chrome**. Root cause: Tone.js creates its own `AudioContext` via the `standardized-audio-context` shim, separate from the manually-created `AudioContext` used by the tack sound. On mobile Chrome, a second `AudioContext` created outside a user gesture is permanently suspended — even if a prior user gesture blessed a different `AudioContext` on the same page.

Since `playTackSound()` already used raw Web Audio API (native `AudioContext`) and worked on mobile, the most reliable fix was to unify everything under the same native `AudioContext` and remove the Tone.js dependency entirely.

## Decision

Replace Tone.js with native Web Audio API for all spring-back playback:

1. **Instrument voice**: `OscillatorNode` (triangle wave) + `GainNode` with a pluck envelope — fast attack (5ms linear ramp to 0.4) and exponential decay to silence by note end. This approximates the plucked-string character of `PluckSynth` without the external dependency.

2. **Scheduling**: `startPlayback()` replaces the public `playSequence()`. It handles scheduling entirely internally: computes `t0` (`AudioContext.currentTime + 0.05` lookahead) and queues notes at `t0 + i × beatInterval`. Each note gets `oscillator.start(startTime)` and `oscillator.stop(endTime)`. No transport, no worker timer — the browser's audio clock provides sample-accurate scheduling.

3. **Polyphony**: Each note creates its own oscillator + gain pair. Nodes self-clean via `oscillator.onended`. No voice pool needed — the browser handles concurrent oscillators efficiently.

4. **Tack sound**: Unchanged — already used native Web Audio API.

5. **State management**: `PlaybackState` replaces the React `playbackRef` for tracking playback lifetime. Native nodes self-clean via `onended`. `PlaybackControl` interface exposes `cancel()`, `updateSlots()`, `t0`, and `beatInterval` for external coordination (loop restart, hot reload).

6. **Frequency map**: `ELEMENT_TO_FREQ` (in `playback.ts`) records Hz values directly (C4=261.63, D4=293.66, E4=329.63, G4=392.00, A4=440.00), replacing the note-name-based `ELEMENT_TO_NOTE` from `types.ts`.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Keep Tone.js, share AudioContext via `Tone.setContext()` | Still adds ~100KB gzipped; `standardized-audio-context` shim had unknown mobile edge cases |
| Keep Tone.js, force user-gesture resume in every callback | Brittle — any missed gesture = silent transport; complex to maintain |
| Use `setTimeout` per note | Drifts from audio clock; no sample-accurate scheduling |
| Use `AudioBufferSourceNode` with pre-rendered samples | Adds sample files, loading complexity, larger bundle |

## Consequences

- **Positive**: No external audio dependency. Bundle shrinks by ~100KB gzipped (tone.js + standardized-audio-context removed).
- **Positive**: Single `AudioContext` on the page. No mobile Chrome dual-context suspension issues.
- **Positive**: Simpler mental model — all audio uses the same native API with the same `AudioContext`.
- **Negative**: Triangle-wave oscillators sound simpler than Karplus-Strong PluckSynth. Acceptable for MVP; richer timbres can be added later via `PeriodicWave` or `AudioBufferSourceNode` samples without reintroducing a framework.
- **Positive**: Unified audio-visual clock — `playback.ts` also owns the rAF-based visual sync loop (see ADR-0007), making it the single source of truth for all playback timing.
- **Negative**: No Transport abstraction for complex sequencing. For the current use case (N evenly-spaced notes), `currentTime + offset` is sufficient. If sequencing needs grow (swing, tempo curves, looping), a scheduler abstraction should be revisited.
- **Positive**: `PlaybackControl.updateSlots()` enables hot reload of stone edits during loop playback — cancels future oscillators, re-schedules with new elements (see ADR-0008).
