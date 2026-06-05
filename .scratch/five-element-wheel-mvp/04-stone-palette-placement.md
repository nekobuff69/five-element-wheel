# Stone palette + placement

**Type:** AFK
**Label:** ready-for-agent

## What to build

Wire the stone palette bar to the wheel state machine. Five stone icons (colored circles as placeholders for the Pokémon-style spheres: Earth=brown, Metal=gold, Wood=green, Fire=red, Water=blue) in a horizontal bar above the wheel. Tap a stone to select it — selection persists across multiple slot taps. Tap an empty slot to place the selected stone, filling the faint ring with the stone icon. Tap a filled slot with a different stone selected to replace it. Tap a filled slot with the same stone selected — no change (clearing is done via the Clear button). The Clear button (at the end of the palette) dispatches CLEAR_ALL, emptying all 10 slots. Empty slots remain as faint rings. All interactions dispatch to the reducer.

## Acceptance criteria

- [ ] Five stone icons in a horizontal palette bar above the wheel
- [ ] Tapping a stone highlights it (selected state); tapping another stone switches selection
- [ ] Tapping an empty slot places the selected stone's icon in that slot
- [ ] Tapping a filled slot with a different stone selected replaces the stone
- [ ] Tapping a filled slot with the same stone selected changes nothing
- [ ] Clear button empties all 10 slots, leaving faint rings
- [ ] Palette and slot state persist across re-renders (driven by reducer)

## Blocked by

- #2 (Wheel state machine)
- #3 (Static wheel layout)
