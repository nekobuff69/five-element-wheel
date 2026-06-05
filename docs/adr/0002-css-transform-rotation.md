# ADR-0002: CSS transforms for wheel rotation

## Status

Accepted (implemented).

## Context

The wheel rotates in two distinct modes:

1. **Winding**: 1:1 finger tracking — the wheel must follow the finger with low latency
2. **Spring-back**: The wheel returns to rest at a steady speed over a computed duration, synchronized with audio playback

We needed a rotation approach that handles both modes without dropping frames or drifting from the audio clock.

## Decision

Use CSS `transform: rotate()` for all wheel rotation, with two different transition strategies:

**Winding**: Short `transition: transform 0.1s ease-out` on the `.wheel` class for visual smoothing of rapid pointer moves. The transform value is set from `state.rotation` via inline style.

**Spring-back**: Inline style overrides the CSS transition: `transition: transform {T}s linear; transform: rotate(0deg)` where `T = queuedSlotCount × (60 / BPM)`. The linear easing matches the even spacing of audio notes. The inline `transition` property takes precedence over the class-level `0.1s` transition.

Slots are positioned on the wheel using `transform: translateX(-50%) rotate({i × 36}deg)` with `transform-origin: center {radius}px`. Slot content counter-rotates by `-(rotation + slotAngle)` to stay upright. During spring-back, the effective rotation is treated as 0 for counter-rotation since the CSS transition handles the visual rotation — this prevents double-rotation artifacts.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Canvas / WebGL | Overkill for 10 elements on a circle; loses CSS class-based animations for glow/dim |
| JavaScript requestAnimationFrame loop | Would need manual interpolation, drift risk vs audio, violates the "CSS-only animations" constraint |
| CSS animation (keyframes) for spring-back | Cannot dynamically compute duration from BPM and slot count; would need JS to inject keyframes |
| No transition on wind (instant rotation) | Feels janky on rapid pointer moves; 0.1s smoothing is imperceptible latency but visible smoothness |

## Consequences

- **Positive**: Spring-back duration is a single inline style change — no JS animation loop, no RAF overhead.
- **Positive**: `onTransitionEnd` fires precisely when spring-back completes, triggering COMPLETE dispatch and audio cleanup.
- **Positive**: Counter-rotation keeps stone icons upright in all modes, including during CSS-transition interpolation.
- **Negative**: The `.wheel` class has a permanent `transition: transform 0.1s`; it must be overridden by inline style during spring-back. This coupling is documented but fragile — if someone changes the class-level transition without understanding the override, spring-back timing breaks.
- **Negative**: CSS transitions cannot be interrupted mid-flight. If the user somehow triggers a new wind during spring-back (prevented by pointer lock, but hypothetically), the transition would jump.
