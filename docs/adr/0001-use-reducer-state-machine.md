# ADR-0001: useReducer for wheel state machine

## Status

Accepted (implemented).

## Context

The Five-Element Wheel has a rich interaction model with 5 distinct states, 8 action types, and state-dependent transitions (e.g., PLACE_STONE only valid in READY, RELEASE only valid in WINDING or TACK). We needed a state management approach that:

- Makes state transitions explicit and testable
- Prevents invalid transitions (e.g., placing stones during playback)
- Keeps the wheel's rotation, slot contents, BPM, and mode in a single source of truth
- Adds no external dependencies

## Decision

Use React's built-in `useReducer` with a single pure reducer function.

```typescript
type WheelState = { mode, slots[10], selectedStone, rotation, direction, queuedSlotIndices, currentSlotAtHead, bpm };
type WheelAction = SELECT_STONE | PLACE_STONE | CLEAR_ALL | WIND | RELEASE | TACK | COMPLETE | SET_BPM;
function wheelReducer(state: WheelState, action: WheelAction): WheelState;
```

The reducer is a pure function: `(state, action) → state`. Every action handler checks `state.mode` and returns the state unchanged for invalid transitions. This eliminates an entire class of bugs (actions firing in wrong states) at the architectural level.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| useState with multiple independent values | No guard against invalid combinations; slot contents, rotation, and mode must stay consistent |
| Zustand / Redux | External dependency with no benefit for a single-screen app with one state object |
| XState / state machine library | Overkill; 5 states × 8 actions is small enough for explicit switch/case |
| useReducer per domain (slots, rotation, audio) | Would require cross-reducer coordination for transitions; single reducer is simpler |

## Consequences

- **Positive**: 55 unit tests cover every state transition, every action in every valid state, edge cases (all empty, all filled, early release, CW vs CCW), and the full READY→COMPLETE→READY cycle. Tests are fast (~8ms total) and run on every change.
- **Positive**: Components never need to check "can I dispatch this?" — they dispatch and the reducer no-ops if invalid.
- **Negative**: The WIND action handler is the most complex (~30 lines) because it manages rotation capping, direction detection, and slot queuing in one pass.
- **Neutral**: The reducer is ~100 lines. Well within maintainable range for a single-concern module.
