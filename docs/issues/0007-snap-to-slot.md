## Parent

docs/prd/0001-loop-stone-drag.md

## What to build

Add snap-to-slot feature for stone drag gesture. Compute slot absolute positions from geometry constants (SLOT_START_ANGLE, SLOT_ANGLE_SPAN, ORIGIN_DISTANCE). During drag, find nearest slot. If distance < 30px threshold, snap ghost stone to slot center and add slot--glow class to target slot for visual feedback.

## Acceptance criteria

- [ ] Helper function computes slot absolute position from slotIndex + wheel center
- [ ] During stone drag, detect nearest slot within 30px threshold
- [ ] Ghost stone teleports to slot center when snap threshold reached
- [ ] Target slot receives slot--glow CSS class when snap active
- [ ] Snap detection works regardless of wheel rotation (use counter-rotated positions)
- [ ] Manual test: drag stone near slot, verify snap + glow feedback
- [ ] Manual test: drag stone far from slot, verify no snap

## Blocked by

docs/issues/0006-stone-drag-gesture.md
