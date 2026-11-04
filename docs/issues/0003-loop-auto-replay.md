> Historical ticket — records the requirements at the time it was written, not the current implementation. See `CONTEXT.md` and `docs/adr/0008-loop-playback-architecture.md`.

## Parent

docs/prd/0001-loop-stone-drag.md

## What to build

Implement automatic loop replay after first spring-back completes. When loop is enabled and playback finishes, reducer returns mode=springBack instead of mode=ready, preserving queuedSlotIndices. Wheel useEffect detects springBack→springBack transition and re-triggers startPlayback with fresh slots snapshot.

## Acceptance criteria

- [ ] COMPLETE action returns mode=springBack if loop=true AND queuedSlotIndices.length > 0
- [ ] COMPLETE action returns mode=ready if loop=false (existing behavior)
- [ ] COMPLETE preserves queuedSlotIndices when loop=true
- [ ] Wheel useEffect handles springBack→springBack transition
- [ ] startPlayback called again with current slots snapshot on loop iteration
- [ ] Visual slot highlighting (isCurrentlyPlaying) works during loop iterations
- [ ] Unit tests: COMPLETE with loop=true, COMPLETE with loop=false

## Blocked by

docs/issues/0002-loop-state-toggle-ui.md
