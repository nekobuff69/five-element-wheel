## Parent

docs/prd/0001-loop-stone-drag.md

## What to build

Replace click-then-click stone placement with direct drag-from-palette-to-slot gesture. Extend PLACE_STONE action with optional `element?: ElementType` field. Add drag gesture to StonePalette: pointer down on stone → store draggingElement in local state → pointer move → render ghost stone following cursor → pointer up on slot → dispatch PLACE_STONE with element + slotIndex. Pointer up elsewhere cancels drag.

## Acceptance criteria

- [ ] PLACE_STONE action includes optional `element?: ElementType` field
- [ ] Reducer uses action.element if provided, else falls back to state.selectedStone
- [ ] Backward compatible: existing SELECT_STONE → PLACE_STONE flow still works
- [ ] StonePalette tracks draggingElement in local state
- [ ] StonePalette handles pointer down on palette stone
- [ ] StonePalette handles pointer move, renders ghost stone at cursor position
- [ ] StonePalette handles pointer up, detects slot under cursor
- [ ] StonePalette dispatches PLACE_STONE with element + slotIndex on successful drop
- [ ] StonePalette cancels drag on pointer up outside slot
- [ ] Ghost stone follows cursor during drag (CSS transform or absolute positioning)
- [ ] Manual test: drag stone from palette to slot, verify placement

## Blocked by

None - can start immediately
