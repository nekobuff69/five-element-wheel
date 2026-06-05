# ADR-0004: Angular-only pointer events for wheel drag

## Status

Accepted (implemented).

## Context

The wheel must rotate in response to finger drag. The user may touch anywhere on the wheel surface — the rotation should feel natural regardless of touch position. Browser scrolling, zooming, and text selection must not interfere.

## Decision

Use raw pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`) on the wheel container. Rotation is computed as the angular delta between successive pointer positions relative to the wheel center:

```typescript
delta = atan2(y2 - cy, x2 - cx) - atan2(y1 - cy, x1 - cx)  // in degrees, normalized to [-180, 180]
```

This is "angular-only" — linear finger movement translates to rotation proportional to the angular change, not the pixel distance. Dragging along the wheel edge produces the same rotation as dragging through the center.

Key implementation details:
- `touch-action: none` on `.wheel-container` prevents browser gestures
- `setPointerCapture(pointerId)` on pointerdown keeps tracking even if the finger leaves the element
- `releasePointerCapture(pointerId)` on pointerup
- Delta is normalized to [-180, 180] to handle the ±180° wrap
- Direction is locked on the first non-zero delta: positive → CW, negative → CCW

Pointer events are gated by mode: only `ready` and `winding` accept pointer input. During `springBack`, `tack`, and `complete`, `handlePointerDown` returns early.

The pointer-drag logic was later extracted into a dedicated `useWheelGesture` custom hook (`src/useWheelGesture.ts`). The hook uses native `addEventListener` (not React synthetic events) with ref-stored callbacks to avoid stale closures. The component calls `useWheelGesture(wheelRef, mode, onWind, onRelease)` and receives clean delta/release notifications — all pointer capture, angle math, and threshold gating are encapsulated.


Slot click vs drag disambiguation: slot `onClick` dispatches PLACE_STONE, which only succeeds in `ready` mode. During a drag, the first WIND transitions to `winding`, so any accidental slot click is a no-op. No explicit click-vs-drag threshold needed.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Gesture library (e.g., `@use-gesture`) | External dependency; angular-only drag is ~20 lines |
| `onTouchStart/Move/End` | Pointer events unify mouse and touch; no need for two event systems |
| Canvas-based hit testing | Overkill for 10 circular slots; CSS transform + absolute positioning is simpler |
| Linear distance tracking (pixels dragged → rotation) | Feels unnatural — dragging through the wheel center would produce no rotation |
| Separate click handler with drag threshold | Reducer already guards: PLACE_STONE only works in `ready`, which drag immediately exits |

## Consequences

- **Positive**: No external gesture dependencies. The `useWheelGesture` hook encapsulates all pointer handling in ~100 lines; callers get a 1-line API.
- **Positive**: Pointer capture ensures smooth tracking even if the finger moves quickly off the wheel.
- **Positive**: Angular-only computation means the entire wheel surface is a valid drag target with consistent feel.
- **Negative**: The `atan2` computation runs on every pointermove (~60Hz on mobile). Negligible for a single calculation, but worth noting if future features add expensive per-frame work.
- **Negative**: No inertia or momentum during winding — the wheel stops instantly when the finger lifts. This is intentional (the spring-back IS the momentum), but differs from a free-spinning wheel UX.
