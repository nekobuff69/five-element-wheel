# Playmode: Loop + Stone Drag UX

## Problem Statement

Current five-element-wheel instrument requires two-step stone placement (select palette stone, then click slot) and plays melodies once before stopping. Users want continuous loop playback for composition refinement and more intuitive drag-to-place interaction.

## Solution

Add automatic loop playback that repeats melodies continuously, with hot-reload support for stone edits during playback. Replace click-then-click stone placement with direct drag-from-palette-to-slot gesture with snap-to-slot assistance.

## User Stories

1. As a composer, I want melodies to loop automatically after first playback, so that I can hear patterns repeat without manual restart
2. As a composer, I want to toggle loop on/off, so that I can control whether playback repeats or stops after one cycle
3. As a composer, I want loop enabled by default, so that I get continuous playback without extra configuration
4. As a composer, I want to add stones during loop playback, so that I can refine my composition while hearing it repeat
5. As a composer, I want stone edits to take effect immediately on future beats, so that I hear changes on the next pass without waiting for current iteration to finish
6. As a composer, I want to change BPM during loop playback, so that I can adjust tempo and hear the effect on next iteration
7. As a composer, I want to toggle loop off mid-playback, so that current iteration finishes then playback stops cleanly
8. As a composer, I want to clear all stones during loop playback, so that I can reset composition without waiting for loop to finish
9. As a composer, I want to drag stones from palette directly to slots, so that placement feels more natural and direct
10. As a composer, I want stones to snap to slots when dragged nearby, so that I don't need pixel-accurate placement
11. As a composer, I want visual feedback when stone is near slot (snap preview), so that I know when placement will trigger
12. As a composer, I want to interrupt loop by dragging wheel, so that I can compose new patterns when inspiration strikes
13. As a composer, I want slot highlighting during loop playback, so that I can see which beat is currently playing
14. As a composer, I want loop to continue during stone drag (not wheel drag), so that playback continues while I edit

## Implementation Decisions

### Loop Mechanics

- **Pure audio replay**: After first spring-back completes, wheel remains static at 0° (no physical rotation). Audio replays using same `queuedSlotIndices` but fresh `slots` snapshot each iteration.
- **Iteration atomicity**: Each loop iteration is an atomic unit. Stone edits and BPM changes apply to future beats (option C) — already-scheduled audio plays to completion, unplayed beats re-schedule with new state.
- **Reducer state**: Add `loop: boolean` field to `WheelState`. `COMPLETE` action returns `mode: 'springBack'` if `loop === true` and `queuedSlotIndices.length > 0`, otherwise returns `mode: 'ready'` (current behavior).
- **Playback extension**: `startPlayback()` returns object with `updateSlots(newSlots, currentBeat)` method instead of just cancel function. Tracks per-beat oscillator refs, cancels future beats, re-schedules with new slots.
- **BPM change**: Mid-iteration BPM change applies on next iteration (consistent with stone edit pattern). No mid-flight tempo adjustment.
- **Loop toggle**: New `LoopToggle` component placed next to `BPMControl`. Checkbox/toggle UI. Default value `true`.
- **CLEAR_ALL behavior**: Allow `CLEAR_ALL` action in any mode (remove `mode !== 'ready'` guard). Full reset: empty slots, clear `queuedSlotIndices`, set `mode: 'ready'`, cancel playback via useEffect cleanup.
- **Wheel drag during loop**: Allow `WIND` action during loop (remove mode guard). Mode changes to `winding` → loop stops. User composes new pattern, releases → new spring-back plays, loop auto-restarts if still enabled.

### Stone Drag Gesture

- **Gesture flow**: Pointer down on palette stone → store `draggingElement` in local StonePalette state. Pointer move → show ghost stone following cursor. Pointer up on slot → dispatch `PLACE_STONE` with `element` and `slotIndex`. Pointer up elsewhere → cancel drag.
- **Action extension**: `PLACE_STONE` action gains optional `element?: ElementType` field. If provided, use it; else fallback to `state.selectedStone`. Backward compatible with existing click-to-place.
- **Snap detection**: Compute slot absolute positions from geometry constants (`SLOT_START_ANGLE`, `SLOT_ANGLE_SPAN`, `ORIGIN_DISTANCE`). On pointer move during drag, find nearest slot. If distance < 30px threshold → snap ghost to slot center, add `slot--glow` class to target slot.
- **Gesture zones**: Palette = stone source zone (drag start). Wheel = rotation zone (existing drag-to-wind). Slot = drop target. Clear separation prevents gesture conflicts.
- **Visual feedback**: Ghost stone follows cursor during drag. When snap threshold reached, ghost teleports to slot center. Target slot glows (reuse existing `slot--glow` CSS class).

### Module Responsibilities

- **wheelReducer**: Add `loop` field to state. Modify `COMPLETE` to auto-restart if loop enabled. Modify `CLEAR_ALL` to allow any mode. Extend `PLACE_STONE` with optional `element` field.
- **playback**: Extend `startPlayback()` return object with `updateSlots(newSlots, currentBeat)` method. Track per-beat oscillator refs in `PlaybackState`. Cancel future oscillators, re-schedule with new slots.
- **LoopToggle**: New component. Checkbox/toggle UI. Dispatch `SET_LOOP` action. Placed next to `BPMControl` in `App.tsx`.
- **StonePalette**: Extend with drag gesture. Local `draggingElement` state. Render ghost stone during drag. Dispatch `PLACE_STONE` with `element` on successful drop.
- **Slot**: Add snap detection helper (30px threshold). Compute slot positions from geometry. Add visual feedback (glow when snap active).
- **Wheel**: Handle loop restart in useEffect. When mode changes `springBack` → `springBack` (loop iteration), call `startPlayback()` again with fresh slots snapshot.

## Testing Decisions

### Test Philosophy

Test external behavior, not implementation details. Focus on state transitions and audio scheduling logic, not React component rendering or CSS animations.

### Test Coverage

- **wheelReducer**: Extend existing 55-test suite. New test cases:
  - `COMPLETE` with `loop: true` returns `mode: 'springBack'` preserving `queuedSlotIndices`
  - `COMPLETE` with `loop: false` returns `mode: 'ready'` (existing behavior)
  - `CLEAR_ALL` in `springBack` mode resets to `ready` with empty slots
  - `PLACE_STONE` with `element` field uses provided element, ignores `selectedStone`
  - `PLACE_STONE` without `element` field falls back to `selectedStone` (backward compatible)
  - `SET_LOOP` action toggles `loop` field
- **playback**: New test file `playback.test.ts`. Test `updateSlots()` method:
  - Cancel future oscillators when slots change
  - Re-schedule future beats with new elements
  - Already-played beats unchanged
  - Edge case: edit on last beat → no re-schedule needed
- **StonePalette drag gesture**: Skip. UI gesture tests flaky, low value. Manual testing sufficient.
- **Slot snap detection**: Skip. Pure geometry math, test via integration (drag stone near slot, verify placement).

### Prior Art

- `wheelReducer.test.ts`: 55 unit tests covering state machine transitions. Follow same pattern: dispatch action, assert new state.
- No existing playback tests. New file needed. Mock `AudioContext` and `requestAnimationFrame`.

## Out of Scope

- **Wheel rotation during loop**: Wheel remains static at 0° during loop iterations. No physical rotation animation.
- **Mid-flight BPM change**: BPM changes apply on next iteration, not current.
- **Multi-touch gestures**: Single pointer only. No pinch-to-zoom or multi-finger interactions.
- **Persistence**: Loop state not saved to localStorage. Resets on page reload.
- **Undo/redo**: No history stack. CLEAR_ALL is destructive.
- **Mobile-specific optimizations**: Touch events handled via pointer events abstraction. No device-specific code paths.

## Further Notes

### Geometry Helper

Snap detection needs slot position computation. Consider extracting to `geometry.ts` utility module:
- `getSlotPosition(slotIndex, wheelCenterX, wheelCenterY)` → `{x, y}`
- Reused by snap detection, ghost positioning, future features (slot labels, hit testing)

### Audio Context Lifecycle

Current `playback.ts` creates `AudioContext` on first use, reuses globally. Loop iterations reuse same context. No change needed.

### CSS Transition Sync

First spring-back: CSS transition duration = `queuedSlotCount × (60/BPM)` synced to audio. Loop iterations: wheel static at 0°, no transition. Visual feedback via `isCurrentlyPlaying` slot highlighting only.

### Backward Compatibility

- `PLACE_STONE` action: optional `element` field. Existing click-to-place flow (SELECT_STONE → PLACE_STONE) unchanged.
- Loop toggle: default `true`. Existing single-playback behavior preserved when `loop: false`.
- CLEAR_ALL: expanded to allow any mode. Existing behavior (ready-only) was restrictive, new behavior is superset.
