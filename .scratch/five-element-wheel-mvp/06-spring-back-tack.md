# Spring-back + tack

**Type:** AFK
**Label:** ready-for-agent

## What to build

On `pointerup` (finger release) during winding, the wheel springs back to its rest position via a CSS transition at a steady speed. If the user has wound a full rotation, the wheel hits a mechanical stop (tack state) — a synthesized 30ms tack sound plays and the wheel briefly bounces ~2–3° before settling. The spring-back duration is computed from the number of slots that crossed the head and the BPM setting. During spring-back, all pointer events on the wheel are ignored (the wheel is "locked"). The COMPLETE action dispatches when the CSS transition ends. Early release is supported: releasing before the tack stop triggers spring-back from the current position, playing only the slots that already crossed the head.

## Acceptance criteria

- [ ] Releasing the wheel during winding triggers a smooth CSS-transition spring-back to rest
- [ ] Spring-back duration = queued slot count × (60 / BPM) seconds
- [ ] Winding a full rotation triggers TACK state; wheel cannot rotate further
- [ ] Tack state plays a synthesized 30ms noise burst sound + brief 2–3° visual bounce
- [ ] Early release plays only the slots that crossed the head, with correct reduced duration
- [ ] Pointer events are disabled on the wheel during SPRING_BACK and TACK states
- [ ] COMPLETE dispatches when the transition ends, returning state to READY

## Blocked by

- #5 (Wheel drag + rotation)
