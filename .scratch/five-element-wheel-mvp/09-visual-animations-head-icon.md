# Visual animations + head icon

**Type:** AFK
**Label:** ready-for-agent

## What to build

Add CSS-driven visual feedback for the wheel's dynamic states. During winding: as each filled slot passes the head position, apply a glow/highlight animation to its stone icon. During spring-back: as each filled slot reaches the head, display its stone icon on the head surface (the blue rounded rectangle at 6 o'clock), play its note, then dim/gray out the slot. The head surface is empty when no slot is at the head position. All animations are driven by CSS class toggles based on reducer state: the reducer exposes which slot index is currently at the head during each phase.

## Acceptance criteria

- [ ] Filled slots glow/highlight briefly as they pass the head during winding
- [ ] Empty slots (faint rings) do not glow during winding
- [ ] During spring-back, when a filled slot reaches the head: its stone icon appears on the head surface, its note plays, then the slot dims/gray out
- [ ] Head surface is blank when no slot is at the head position
- [ ] All visual transitions use CSS (transitions, keyframes, class toggles) — no JS-driven animation frames
- [ ] Animations do not block or lag the audio scheduling

## Blocked by

- #5 (Wheel drag + rotation)
- #7 (Audio engine integration)
