> Historical ticket — records the requirements at the time it was written, not the current implementation. See `CONTEXT.md` and `docs/adr/0008-loop-playback-architecture.md`.

## Parent

docs/prd/0001-loop-stone-drag.md

## What to build

Add loop state management and UI toggle. Extend WheelState with `loop: boolean` field (default true). Add `SET_LOOP` action to reducer. Create new LoopToggle component with checkbox/toggle UI. Wire component to App.tsx next to BPMControl.

## Acceptance criteria

- [ ] WheelState includes `loop: boolean` field
- [ ] initialWheelState sets `loop: true`
- [ ] Reducer handles `SET_LOOP` action, toggles loop field
- [ ] LoopToggle.tsx component renders checkbox/toggle
- [ ] LoopToggle dispatches SET_LOOP on user interaction
- [ ] App.tsx renders LoopToggle next to BPMControl
- [ ] Unit tests: reducer SET_LOOP action, initial state loop=true

## Blocked by

None - can start immediately
