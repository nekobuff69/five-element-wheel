## Parent

docs/prd/0001-loop-stone-drag.md

## What to build

Allow user to interrupt loop by dragging wheel. Modify useWheelGesture to accept pointer events during springBack mode. WIND action transitions mode to winding, stopping loop. User composes new pattern, releases → new spring-back plays, loop auto-restarts if still enabled.

## Acceptance criteria

- [ ] useWheelGesture accepts pointer events when mode=springBack
- [ ] WIND action transitions springBack → winding
- [ ] Playback cancels when mode changes to winding (existing useEffect cleanup)
- [ ] After new wind+release, loop auto-restarts if loop=true
- [ ] Manual test: drag wheel during loop, compose new pattern, release, loop continues

## Blocked by

docs/issues/0003-loop-auto-replay.md
