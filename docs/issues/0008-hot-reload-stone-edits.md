> Historical ticket — records the requirements at the time it was written, not the current implementation. See `CONTEXT.md` and `docs/adr/0008-loop-playback-architecture.md`.

## Parent

docs/prd/0001-loop-stone-drag.md

## What to build

Enable hot reload of stone edits during loop playback. Extend startPlayback() return object with updateSlots(newSlots, currentBeat) method. Track per-beat oscillator refs in PlaybackState. When slots change mid-iteration, cancel future oscillators (beats >= currentBeat), re-schedule with new elements. Already-played beats unchanged. Visual onBeat callback continues working.

## Acceptance criteria

- [ ] startPlayback() returns object with updateSlots(newSlots, currentBeat) method
- [ ] PlaybackState tracks per-beat oscillator refs (array of {osc, gain, slotIndex})
- [ ] updateSlots cancels oscillators for beats >= currentBeat
- [ ] updateSlots re-schedules future beats with new slots
- [ ] Already-played beats (index < currentBeat) unchanged
- [ ] onBeat visual callback continues firing correctly
- [ ] Wheel component calls updateSlots when slots change during springBack mode
- [ ] Edge case: edit on last beat → no re-schedule needed
- [ ] Unit tests: updateSlots cancels future oscillators, re-schedules with new elements
- [ ] Manual test: add stone during loop, hear change on next beat

## Blocked by

docs/issues/0003-loop-auto-replay.md
docs/issues/0006-stone-drag-gesture.md
