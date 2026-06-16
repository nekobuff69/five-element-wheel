# ADR-0007: requestAnimationFrame polling for audio-visual synchronization

## Status

Accepted (implemented).

## Context

During spring-back, audio notes (scheduled on the `AudioContext` hardware clock) were visually out of sync with stone highlights. The original implementation used `setTimeout` on the JS main thread to advance `springBackPlayingIndex`, causing two problems:

1. **Clock mismatch**: Audio uses `audioCtx.currentTime` (hardware clock, sub-millisecond precision). Visual uses `setTimeout` (main-thread clock, subject to GC pauses, tab throttling, and scheduler imprecision).
2. **Sorting vs. encounter order mismatch**: `playSequence()` sorted queued slots (ascending for CW, descending for CCW) while the visual highlight used the raw queue order. This caused stones to light up before their audio played.

The user reported: *"the highlight lags — stones light up before being played."*

## Decision

### 1. Single clock: rAF polls `audioCtx.currentTime`

Replace `setTimeout` with a `requestAnimationFrame` loop that reads `audioCtx.currentTime` each frame and computes the current beat:

```typescript
const elapsed = ctx.currentTime - t0;
const currentBeat = Math.floor(elapsed / beatInterval);
```

The rAF loop lives in `playback.ts` and runs at the compositor rate (~60fps), checking every frame whether the beat boundary has been crossed. When it has, it fires the `onBeat` callback which updates `springBackPlayingIndex` via `setSpringBackPlayingIndex`. This eliminates drift because visual and audio share the same clock.

### 2. Shared `t0` origin

`startPlayback()` in `playback.ts` computes `t0 = ctx.currentTime + 0.05` (50ms lookahead) internally. The `useEffect` in `useWheelPlayback.ts` calls `startPlayback(config, onBeat, onComplete)`. The rAF loop and audio scheduler share this `t0`. CSS transition starts in the same frame. All three consumers — audio scheduler, rAF visual loop, and CSS transition — share the same time origin.

### 3. Playback order = encounter order (no sorting)

Both the audio scheduler and the rAF loop (inside `startPlayback()`) use `state.queuedSlotIndices` directly, without sorting. Stones play in the exact order they crossed the head during winding. CW drag → stones queued CW → plays CW. CCW drag → stones queued CCW → plays CCW.

The previous ascending/descending sort was removed because it created a mismatch between what the user wound and what played back.

### 4. Empty slots = no highlight (but timing preserved)

When `currentBeat` maps to an empty slot, `springBackPlayingIndex` is set to `-1`, so no stone highlights. The beat grid is preserved — the next non-empty slot plays on its correct beat, not prematurely.

### 5. rAF lifecycle

- **Start**: When `state.mode` transitions to `'springBack'`, the effect calls `startPlayback(config, onBeat, onComplete)`, which creates an internal `PlaybackState` object and starts the rAF loop.
- **Self-terminate**: When `elapsed >= totalDuration + 0.5 × beatInterval`, the loop dispatches `COMPLETE` and stops requesting frames.
- **Cleanup**: The returned cancel function sets `PlaybackState.cancelled = true` and calls `cancelAnimationFrame` on unmount or mode change.
- **`transitionend` fallback**: Remains as a safety net — if rAF is throttled hard, CSS will still fire and dispatch `COMPLETE`.

### 6. `springBackPlayingIndex` interpretation

The index now means "position in the encounter-order array" (`state.queuedSlotIndices`). Both the audio scheduler and the visual highlight use this same interpretation.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Keep `setTimeout` with drift correction | Still fights the JS scheduler; adds complexity for marginal gain |
| `AudioWorklet` → main thread messaging | Overkill for 10 notes; requires separate JS file; adds thread communication complexity |
| Drive wheel rotation from rAF too | CSS transition on compositor thread is already reliable; visual drift between rotation and highlights is imperceptible |
| Keep sorting, fix visual to match | User wants encounter-order playback — no reordering |

## Consequences

- **Positive**: Audio and visual locked to the same hardware clock. No perceptible drift.
- **Positive**: Playback order matches winding order — no cognitive gap between what the user did and what plays back.
- **Positive**: `PlaybackState` holds all state in one place inside `playback.ts` — no stale closure risk.
- **Positive**: Self-termination + `cancelAnimationFrame` cleanup = no leaked rAF loops.
- **Negative**: rAF loop creates React state updates on every frame during playback (60fps × ~10 beats = ~10 actual updates, since `springBackPlayingIndex` only changes on beat boundaries). Negligible at 10 slots.
- **Negative**: If the tab is backgrounded during playback, rAF stops. Audio continues (scheduled on hardware clock), visual resumes when tab is foregrounded. User may see a visual jump to the current beat.

### 7. Loop iteration restart

When loop is enabled, `COMPLETE` returns `mode: 'springBack'` (same mode) with incremented `loopIteration`. The useEffect dependency array includes `state.loopIteration`, so it re-runs on each loop iteration, calling `startPlayback()` again with a fresh `slots` snapshot. This enables hot reload — each iteration reads current state, not a stale closure.
