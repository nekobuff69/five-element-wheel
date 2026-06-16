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

### 2. `loopIteration` counter forces useEffect re-run

The `COMPLETE` action returns `mode: 'springBack'` (same mode) when loop is enabled. React's useEffect dependency check sees no mode change, so we add `loopIteration: number` to state. Each loop iteration increments the counter, triggering the useEffect that calls `startPlayback()`.

```typescript
case 'COMPLETE': {
  if (state.loop && state.queuedSlotIndices.length > 0) {
    return { ...state, mode: 'springBack', loopIteration: state.loopIteration + 1 };
  }
  return { ...initialWheelState, slots: state.slots, selectedStone: state.selectedStone, bpm: state.bpm, loop: state.loop };
}
```

### 3. `PlaybackControl.updateSlots()` for hot reload

`startPlayback()` returns a `PlaybackControl` object with `cancel()` and `updateSlots(newSlots, currentBeat)` methods. The playback state tracks per-beat oscillator refs in `oscillators: (OscillatorInfo | null)[]`.

When `updateSlots()` is called:
- For each beat index ≥ `currentBeat`:
  - Cancel existing oscillator (stop + disconnect)
  - Re-schedule with new element from `newSlots` (if element changed)
  - Clamp `startTime` to `Math.max(baseTime, ctx.currentTime + 0.01)` to handle mid-beat edits
- Already-played beats (index < `currentBeat`) unchanged

The `Wheel.tsx` component watches `state.slots` changes during `springBack` mode and calls `updateSlots()` with the current beat computed from `AudioContext.currentTime`.

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

- **Positive**: Loop is transparent — first spring-back uses CSS transition synced to audio; loop iterations are pure audio with visual slot highlighting via `onBeat` callback.
- **Positive**: Hot reload works naturally — `updateSlots()` cancels future oscillators, re-schedules with new elements. Already-played beats unchanged.
- **Positive**: `loopIteration` counter is a clean mechanism to force useEffect re-run without synthetic actions.
- **Positive**: Loop interruption is natural — user can drag wheel or clear all stones anytime.
- **Negative**: `loopIteration` counter grows unbounded. Not a practical concern — JavaScript handles large integers fine, and counter resets on page reload.
- **Negative**: Hot reload requires per-beat oscillator tracking, adding complexity to `playback.ts`. Acceptable for the feature value.
- **Negative**: Mid-beat edits clamp `startTime` to `ctx.currentTime + 0.01`, causing slight timing imprecision. Imperceptible in practice.
