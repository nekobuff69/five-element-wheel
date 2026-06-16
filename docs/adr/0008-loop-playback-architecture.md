# ADR-0008: Pure audio loop with hot reload

## Status

Accepted (implemented).

## Context

The wheel played melodies once and stopped. Users wanted continuous loop playback to hear patterns repeat while composing. Additionally, users wanted to edit stones during playback and hear changes immediately — not wait for the next manual restart.

The existing architecture had tight coupling between physical wind and playback:
- `queuedSlotIndices` populated during physical drag (encounter order)
- `COMPLETE` action reset to `ready` mode, clearing queued indices
- `startPlayback()` scheduled all audio upfront from a snapshot of `slots`

Loop needed to replay audio without re-winding the wheel. Hot reload needed mid-flight audio mutation.

## Decision

### 1. Pure audio replay (no physical rotation)

After first spring-back completes, the wheel stays at rest position (0°). Loop iterations are pure audio replays using the same `queuedSlotIndices` but a fresh `slots` snapshot each iteration. No CSS transition, no physical wheel motion.

Rationale: The physical wind is the performance — the user's gesture. Loop is about the composition repeating. Auto-spinning the wheel would add motor simulation the instrument metaphor doesn't need.

### 2. Seamless looping via pre-scheduling

The `startPlayback()` function pre-schedules 4 iterations upfront and extends dynamically as playback approaches the end. This eliminates gaps between loops that would occur if each iteration required a round-trip through React state.

```typescript
// Schedule initial iterations (4 loops worth)
const INITIAL_ITERATIONS = 4;
for (let iter = 0; iter < INITIAL_ITERATIONS; iter++) {
  scheduleIteration(iter * N);
}

// Extend scheduling if approaching the end
if (pb.loop && currentBeat >= pb.totalScheduledBeats - pb.count) {
  scheduleIteration(pb.totalScheduledBeats);
  pb.totalScheduledBeats += pb.count;
}
```

Rationale: The previous architecture used a `loopIteration` counter to force useEffect re-run, causing audible gaps as each iteration required dispatch → re-render → new `startPlayback()` call. Pre-scheduling keeps the audio graph continuous.

### 3. `PlaybackControl.updateSlots()` for hot reload

`startPlayback()` returns a `PlaybackControl` object with `cancel()` and `updateSlots(newSlots, currentBeat)` methods. The playback state tracks per-beat oscillator refs in `oscillators: (OscillatorInfo | null)[]`.

When `updateSlots()` is called:
- For each absolute beat index ≥ `currentBeat` across all scheduled iterations:
  - Compute position within iteration: `absBeat % count`
  - Cancel existing oscillator (stop + disconnect)
  - Re-schedule with new element from `newSlots` (if element changed)
  - Clamp `startTime` to `Math.max(baseTime, ctx.currentTime + 0.01)` to handle mid-beat edits
- Already-played beats (absBeat < `currentBeat`) unchanged

The `useWheelPlayback` hook watches `state.slots` changes during `springBack` mode and calls `updateSlots()` with the current beat computed from `AudioContext.currentTime`.

### 4. Iteration atomicity

Each loop iteration is an atomic unit:
- Stone edits apply to future beats (option C) — already-scheduled audio plays to completion
- BPM changes apply on next iteration — no mid-flight tempo adjustment
- Toggle loop off → current iteration finishes, then stops

### 5. `CLEAR_ALL` and `WIND` work during loop

- `CLEAR_ALL` allowed in any mode — full reset including queued indices, sets mode to `ready`, cancels playback via useEffect cleanup
- `WIND` during `springBack` interrupts loop, transitions to `winding`, resets queued indices for fresh wind cycle. After release, loop auto-restarts if still enabled.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Auto-spin wheel during loop | Adds motor simulation the metaphor doesn't need; complex CSS transition choreography for invisible user |
| Immediate stone edit (cancel + re-schedule from current beat) | Jarring audio glitch; requires tearing down and rebuilding audio graph mid-playback |
| BPM change mid-iteration | Complex — would need to rescale all future beat times; inconsistent with stone edit pattern |
| Synthetic `RESTART` action (COMPLETE → READY → dispatch RESTART → SPRING_BACK) | Unnecessary indirection; reducer can decide next state directly based on loop flag |

## Consequences

- **Positive**: Loop is seamless — pre-scheduling eliminates gaps between iterations. First spring-back uses CSS transition synced to audio; loop iterations are pure audio with visual slot highlighting via `onBeat` callback.
- **Positive**: Hot reload works naturally — `updateSlots()` cancels future oscillators across all scheduled iterations, re-schedules with new elements. Already-played beats unchanged.
- **Positive**: Loop interruption is natural — user can drag wheel or clear all stones anytime.
- **Negative**: Pre-scheduling multiple iterations increases memory usage (oscillator array grows with each iteration). Mitigated by dynamic extension — only 4 iterations scheduled initially, more added as needed.
- **Negative**: Hot reload requires per-beat oscillator tracking, adding complexity to `playback.ts`. Acceptable for the feature value.
- **Negative**: Mid-beat edits clamp `startTime` to `ctx.currentTime + 0.01`, causing slight timing imprecision. Imperceptible in practice.
