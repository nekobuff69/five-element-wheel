# ADR 0010: SpringBack Commit Threshold

## Status
Accepted

## Context
During loop playback (springBack mode), users can drag stones to edit the loop on the fly (hot reload). However, the wheel also accepts drag gestures during springBack to interrupt the loop and queue new slots.

This creates a gesture conflict: accidental wheel drags during playback can interrupt the loop unintentionally. Users editing stones near the wheel rim might trigger small wheel movements that kill their groove.

## Decision
Implement a 15° commit threshold for wheel drag during springBack mode:

- The wheel can visually respond to drag (rotates slightly)
- But the mode doesn't transition from springBack to winding until cumulative drag exceeds 15°
- Once threshold is crossed, WIND is dispatched and playback is interrupted
- If user releases before threshold, no interrupt occurs (playback continues)

The threshold only applies during springBack mode. During ready/winding modes, the existing 5° DRAG_THRESHOLD applies.

## Implementation
- Added `SPRINGBACK_COMMIT_THRESHOLD = 15` constant in `useWheelGesture.ts`
- Track `springBackAccumulatedRef` to accumulate drag distance during springBack
- In handlePointerMove: when mode is springBack, accumulate Math.abs(delta) and only dispatch WIND if accumulated >= 15°
- In handlePointerUp: when mode is springBack, only dispatch RELEASE if accumulated >= 15°

## Consequences

### Positive
- Prevents accidental loop interruption during stone editing
- Preserves full expressiveness: users can still intentionally interrupt by dragging past 15°
- No new modes or state transitions required
- Threshold is large enough to be deliberate but small enough to feel responsive

### Negative
- Users must drag slightly further to interrupt (15° vs immediate response)
- Visual feedback during the threshold zone could be confusing (wheel moves but no interrupt)

### Neutral
- Commit threshold is a gesture-level concern, not a state machine concern
- Does not affect ready/winding mode behavior
