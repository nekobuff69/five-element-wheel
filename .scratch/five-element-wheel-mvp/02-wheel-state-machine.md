# Wheel state machine + tests

**Type:** AFK
**Label:** ready-for-agent

## What to build

Implement the core wheel state machine as a React `useReducer`. This pure function manages all state: wheel mode (ready | winding | tack | spring-back | complete), 10 slot contents (empty or element type), palette selection, rotation angle accumulators, drag direction (CW | CCW), BPM value, and the queue of slots that have crossed the head during winding. Dispatch actions: SELECT_STONE, PLACE_STONE, CLEAR_ALL, WIND, RELEASE, TACK, COMPLETE, SET_BPM. Write exhaustive unit tests covering every state transition, every action in every valid state, edge cases (all empty, all filled, early release, CW vs CCW path), and slot queuing computation.

## Acceptance criteria

- [ ] Reducer is a pure function `(state, action) => state` with full TypeScript types
- [ ] All 5 states and all transitions between them work correctly
- [ ] SELECT_STONE sets palette selection; PLACE_STONE fills a slot with the selected stone or replaces existing; CLEAR_ALL empties all 10 slots
- [ ] WIND accumulates angular delta, tracks which slots cross the head, sets direction
- [ ] RELEASE transitions WINDING → SPRING_BACK (or TACK → SPRING_BACK), preserves queued slot indices and direction
- [ ] COMPLETE resets to READY, clears queued slots
- [ ] SET_BPM updates BPM value
- [ ] Unit tests cover: all state transitions, action rejection in invalid states, empty-slot queuing, direction reversal, complete cycle from READY to COMPLETE and back

## Blocked by

None — can start immediately.
