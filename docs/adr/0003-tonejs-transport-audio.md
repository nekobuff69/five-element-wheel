# ADR-0003: tone.js Transport for audio scheduling

## Status

Superseded by [ADR-0006](./0006-native-web-audio-playback.md).

## Context

During spring-back, notes must play at evenly-spaced intervals synchronized with the visual wheel rotation. The beat spacing depends on BPM and the number of queued slots. Notes must overlap naturally (polyphonic). The audio must not drift from the visual timeline.

## Decision

Use `Tone.PluckSynth` for plucked-string voices and `Tone.Transport` for scheduling. The scheduling algorithm:

1. Compute total duration: `T = queuedSlotCount × (60 / BPM)` seconds
2. Sort queued slot indices by play order (ascending for CW wind, descending for CCW)
3. Schedule N notes on Transport at times `t = i × (T / N)` for `i = 0..N-1`
4. Schedule Transport stop at time T
5. Start Transport and CSS transition in the same frame (via `useEffect` on mode change to `springBack`)

The play order mapping:
- CW wind (direction=`'cw'`): ascending sort → forward melody
- CCW wind (direction=`'ccw'`): descending sort → reverse melody

Empty slots are rests — no `triggerAttackRelease` call, but the timing grid is preserved. The beat interval is constant regardless of fill.

Voice: `Tone.PluckSynth` with `attackNoise: 0.1, dampening: 4000, resonance: 0.7` → short plucked decay reminiscent of a guqin or koto. Polyphonic by default — each note is an independent voice that decays naturally.

Tack sound uses raw Web Audio API (not tone.js): 30ms noise burst with exponential decay + 800Hz sine blip. This avoids Transport scheduling overhead for a single 30ms sound.

AudioContext is resumed on the first palette tap (SELECT_STONE or CLEAR_ALL), satisfying browser autoplay policy before the user touches the wheel.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| `setTimeout` per note | Drifts from CSS transition; no sample-accurate scheduling |
| Web Audio API manual scheduling | More code for equivalent functionality; tone.js Transport handles timing edge cases |
| `Tone.Synth` (basic oscillator) | Too synthetic for a pentatonic instrument; PluckSynth sounds more organic |
| `Tone.Sampler` with real instrument samples | Requires audio files (loading, precaching, larger bundle); out of scope for MVP |
| Single monophonic voice | Adjacent stones would cut each other off; polyphonic overlap = natural reverb |
| Tack via tone.js | Overhead of Transport scheduling for a 30ms one-shot; raw Web Audio is lighter |

## Consequences

- **Positive**: Transport scheduling guarantees sample-accurate timing regardless of main thread load.
- **Positive**: CSS transition and Transport start in the same React effect, minimizing desync to sub-frame (<16ms).
- **Positive**: `stopAudio()` on COMPLETE or transition-end cancels all scheduled events and stops Transport cleanly.
- **Negative**: tone.js adds ~100KB gzipped to the bundle. Acceptable for MVP; could be replaced with raw Web Audio scheduling in a future optimization.
- **Negative**: `Tone.start()` must be called before Transport works; we call it lazily in `ensureToneStarted()` on first audio interaction.
