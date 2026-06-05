# Static wheel + slot + head layout

**Type:** AFK
**Label:** ready-for-agent

## What to build

Render the visual wheel structure: a circular wheel with 10 equally-spaced slots and the fixed head marker at 6 o'clock overlapping the wheel edge. Empty slots appear as faint rings. The head is a rounded-rectangle surface that shows nothing when no slot is at the head position. A placeholder stone palette bar renders above the wheel (visual only, no interaction yet). The layout is responsive and fits a mobile viewport (~375px width) with the wheel centered and large enough to touch-drag. State is read from the wheel state machine but the wheel is static (no rotation yet — that's issue #5).

## Acceptance criteria

- [ ] Wheel renders as a circle, centered horizontally, with 10 faint-ring slot placeholders
- [ ] Slots are distributed around the wheel's circumference, accounting for the head's angular width at 6 o'clock
- [ ] Head renders as a rounded rectangle at 6 o'clock, overlapping the wheel's bottom edge, with higher z-index
- [ ] Stone palette bar renders above the wheel with 5 placeholder stone circles + a Clear button (non-functional)
- [ ] Layout fits 375px viewport without horizontal scroll; wheel is at least 280px diameter
- [ ] Palette reads selected stone from reducer state (visual highlight only)

## Blocked by

- #1 (Project scaffold + PWA shell)
