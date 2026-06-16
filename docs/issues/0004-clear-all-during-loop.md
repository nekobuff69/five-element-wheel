## Parent

docs/prd/0001-loop-stone-drag.md

## What to build

Allow CLEAR_ALL action during loop playback. Remove mode guard from reducer. Full reset: empty all slots, clear queuedSlotIndices, set mode=ready. Playback cancels via useEffect cleanup when mode changes.

## Acceptance criteria

- [ ] CLEAR_ALL action allowed in any mode (remove mode !== 'ready' guard)
- [ ] CLEAR_ALL resets slots to Array(10).fill(null)
- [ ] CLEAR_ALL clears queuedSlotIndices to []
- [ ] CLEAR_ALL sets mode to 'ready'
- [ ] Playback cancels when mode changes to ready (existing useEffect cleanup)
- [ ] Unit tests: CLEAR_ALL in springBack mode, CLEAR_ALL in winding mode

## Blocked by

docs/issues/0003-loop-auto-replay.md
