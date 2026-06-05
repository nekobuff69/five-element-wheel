# Wheel drag + rotation

**Type:** AFK
**Label:** ready-for-agent

## What to build

Add pointer event handling to the wheel so the user can drag to rotate it. The rotation angle is derived from the angular delta between successive pointer positions relative to the wheel center — the finger's linear path is irrelevant, only its angle matters. The wheel rotates via CSS `transform: rotate()`, tracking the finger exactly (1:1 movement). Each `pointermove` dispatches WIND to the reducer, which accumulates rotation, determines direction (CW / CCW), and tracks which slots have crossed the head position. The wheel element has `touch-action: none` to prevent browser scroll interference. The head remains fixed at 6 o'clock while the wheel rotates behind it.

## Acceptance criteria

- [ ] Touching and dragging on the wheel rotates it in real time, following the finger
- [ ] Rotation is angular-only: linear finger movement anywhere on the wheel maps to correct rotation angle
- [ ] WIND actions are dispatched with each `pointermove`, updating reducer rotation state
- [ ] Reducer correctly determines wind direction (CW vs CCW) and queues slots as they cross the head
- [ ] The head remains visually fixed (does not rotate); the wheel slots rotate behind/under it
- [ ] No browser scroll, zoom, or text selection during wheel interaction (`touch-action: none`)

## Blocked by

- #2 (Wheel state machine)
- #3 (Static wheel layout)
