# ADR-0001: useReducer for wheel state machine

## Status

Accepted (implemented).

## Context

The Five-Element Wheel has a rich interaction model with 3 modes, 11 action types, and state-dependent transitions (e.g., PLACE_STONE valid in READY and SPRING_BACK, RELEASE valid only in WINDING). We needed a state management approach that:

- Makes state transitions explicit and testable
- Prevents invalid transitions (e.g., placing stones during WINDING)
- Keeps the wheel's rotation, slot contents, BPM, and mode in a single source of truth
- Adds no external dependencies

## Decision

Use React's built-in `useReducer` with a single pure reducer function.

```typescript
// Current shapes (the decision itself — one pure reducer — is unchanged)
type WheelState = { mode, slots[10], selectedStone, rotation, direction, queuedSlotIndices, currentSlotAtHead, bpm, loop, key, octave };
type WheelAction = SELECT_STONE | PLACE_STONE | REMOVE_STONE | RESET | WIND | RELEASE | COMPLETE | SET_BPM | SET_LOOP | SET_KEY | SET_OCTAVE;
function wheelReducer(state: WheelState, action: WheelAction): WheelState;
```

The reducer is a pure function: `(state, action) → state`. Mode-guarded action handlers check `state.mode` and return the state unchanged for invalid transitions; parameter actions (`SET_BPM`, `SET_LOOP`, `SET_KEY`, `SET_OCTAVE`) and `RESET` are mode-independent. This eliminates an entire class of bugs (actions firing in wrong states) at the architectural level.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| useState with multiple independent values | No guard against invalid combinations; slot contents, rotation, and mode must stay consistent |
| Zustand / Redux | External dependency with no benefit for a single-screen app with one state object |
| XState / state machine library | Overkill; 3 modes × 11 actions is small enough for explicit switch/case |
| useReducer per domain (slots, rotation, audio) | Would require cross-reducer coordination for transitions; single reducer is simpler |

## Consequences

- **Positive**: 84 reducer tests (120 tests total across 6 files) cover every state transition, every action in every valid state, edge cases (all empty, all filled, early release, CW vs CCW), and the full READY→SPRING_BACK→READY cycle. Tests are fast and run on every change.
- **Positive**: Components never need to check "can I dispatch this?" — they dispatch and the reducer no-ops if invalid.
- **Negative**: The WIND action handler is the most complex — rotation capping, direction detection, and slot queuing coordination. The crossing-detection algorithm is extracted into a pure `collectCrossings` helper for clarity.
- **Neutral**: With helpers and initial state the module is ~213 lines. Well within maintainable range for a single-concern module.

> Historical note: this ADR originally recorded 5 states / 8 actions / 55 tests from the first implementation. The numbers above describe the current code; the architectural decision is unchanged.
