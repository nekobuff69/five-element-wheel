# Five-Element Wheel — MVP PRD

## Problem Statement

There is no digital musical instrument that combines Traditional Chinese music theory (五音 pentatonic scale mapped to the Five Elements 五行) with a tactile, clockwork-inspired physical interaction. Existing music apps rely on piano rolls, grids, or abstract sequencers — none capture the embodied feel of winding a mechanism, hearing a "tack" as it engages, and releasing to let the instrument play itself. A person curious about Chinese music theory, or seeking a meditative composition tool, has no accessible mobile instrument that makes pentatonic melody creation intuitive and satisfying through gesture alone.

## Solution

A mobile-first Progressive Web App — **Five-Element Wheel** — where the user composes melodies by arranging element stones on a rotatable wheel, then performs them with a drag-and-release gesture inspired by a vintage rotary telephone dial.

- Five element stones (Earth 土, Metal 金, Wood 木, Fire 火, Water 水), each representing a note in the C pentatonic scale (C, D, E, G, A)
- A 10-slot wheel. Users fill slots with stones in any sequence, with empty slots acting as rests
- A fixed "head" at the 6 o'clock position. Drag the wheel to wind it clockwise or counter-clockwise; release triggers a spring-back that plays each stone's note as it passes the head
- A mechanical "tack" sound when the wheel reaches its stop, and a visual bounce
- Polkysynth plucked-string voices, polyphonic, with a BPM slider (60–180, default 100)
- Works offline as a PWA, demoable on a mobile phone

## User Stories

1. As a first-time user, I want to see a wheel with 10 empty slots and a palette of 5 colored element stones above it, so that I understand the instrument's components at a glance.
2. As a composer, I want to tap a stone in the palette to select it, then tap empty slots to place that stone, so that I can build a sequence efficiently.
3. As a composer, I want the selected stone to remain selected after placing it, so that I can fill multiple slots with the same element without re-tapping the palette.
4. As a composer, I want to tap a filled slot with a different stone selected to replace it, so that I can edit my sequence without a separate clear step.
5. As a composer, I want a "Clear" button in the palette that empties all 10 slots at once, so that I can start over quickly.
6. As a user, I want empty slots to appear as faint rings, so that I can see where I can place stones.
7. As a performer, I want to drag the wheel with my finger to wind it, seeing the wheel rotate in the direction I drag, so that I feel direct physical control.
8. As a performer, I want filled slots to light up with a glow as they pass the head during winding, so that I can see which notes I am queuing.
9. As a performer, I want to hear a mechanical "tack" sound and feel a visual bounce when the wheel reaches its physical stop, so that I know the instrument is loaded and ready to play.
10. As a performer, I want to release my finger at any point during winding (not just at the tack stop) to trigger an early spring-back, so that I can play shorter phrases.
11. As a performer, I want the wheel to spring back automatically after I release, at a steady tempo, so that the melody plays with a consistent rhythm I don't have to control manually.
12. As a performer, I want each filled slot's stone icon to appear on the head surface as it passes and its note sounds, and then dim after the note plays, so that I can visually follow the melody.
13. As a performer, I want to hear notes overlap naturally (polyphonic), so that adjacent stones create a gentle reverb rather than cutting each other off.
14. As a performer, I want to choose the winding direction — clockwise or counter-clockwise — to hear two different melodic variations from the same stone arrangement, so that I can experiment with inversion.
15. As a performer, I want the wheel to ignore touches during spring-back, so that I don't accidentally interrupt playback.
16. As a musician, I want a BPM slider (60–180, default 100) that changes the spring-back speed, so that I can control the tempo of my melody.
17. As a musician, I want to see the root note displayed ("C Pentatonic") next to the BPM control, so that I know the tonal context of the instrument.
18. As a mobile user, I want the app to work as a PWA that I can install on my phone's home screen, so that I can demo it without an internet connection.
19. As a mobile user, I want the palette positioned above the wheel and the wheel centered on screen, so that I can reach all interactions with my thumbs.
20. As a user on any device, I want the wheel rotation to follow my finger's angular movement relative to the wheel center, not my finger's linear path, so that dragging feels natural regardless of where on screen I touch.

## Implementation Decisions

### Tech stack
- **Framework**: Vite + React + TypeScript. Single-page app, no router.
- **Audio**: tone.js. `Tone.PluckSynth` for plucked-string voices. `Tone.Transport` for scheduling note sequences at precise intervals during spring-back.
- **PWA**: `vite-plugin-pwa` for service worker generation, manifest, and icon precaching. 192px and 512px app icons required.
- **State**: React `useReducer` — single reducer for all wheel state. No external state library (no Zustand, no Redux).
- **Rendering**: CSS transforms for wheel rotation. `touch-action: none` on wheel element. Slots positioned via `transform: rotate()`. Spring-back animation via CSS transition.
- **Styling**: Plain CSS with custom properties. No CSS framework.
- **File structure**: Flat — components, reducer, audio module all at `src/` level. No nested feature folders.
- **No external gesture library**: Pointer events handled directly in the Wheel component, computing angular delta from wheel center to finger position.

### Architecture decisions
- **AudioContext resume on first palette tap**. The browser requires a user gesture to start the AudioContext. Resuming on the first stone tap ensures audio is hot before the user touches the wheel.
- **CSS animation + pre-scheduled audio for spring-back**. Before spring-back starts, compute the total transition duration from BPM and slot count. Schedule all note triggers on Tone.Transport at equally-spaced intervals within that duration. Start both simultaneously. This avoids clock drift between visual and audio.
- **Angular-only drag**. Wheel rotation angle is the delta between successive pointer positions relative to wheel center. Linear finger movement translates cleanly to rotation regardless of finger path.
- **Monophonic wind, polyphonic spring-back**. No sound during winding. Notes overlap naturally during spring-back so adjacent stones create gentle reverb.
- **Slot arrangement**: 10 slots distributed around the wheel's remaining circumference after accounting for the head's angular width at 6 o'clock. Exact angular gaps refined during UI implementation.
- **Head overlaps the wheel visually** (higher z-index). Slots orbit inside the wheel boundary, never overlapping the head surface.
- **Slot numbering**: Slot 1 at 12 o'clock, numbered clockwise. Implementation detail — not user-facing.

### Module design
- **Wheel state machine** (useReducer) — the core deep module. Pure function managing: wheel state (ready | winding | tack | spring-back | complete), 10 slot contents (empty or element type), palette selection, rotation angle, drag direction (CW | CCW), BPM. Dispatch actions: `SELECT_STONE`, `PLACE_STONE`, `CLEAR_ALL`, `WIND`, `RELEASE`, `TACK`, `COMPLETE`, `SET_BPM`.
- **Audio engine** — thin wrapper over tone.js. Interface: `init()`, `playSequence(slots, bpm, direction)`, `playTack()`. Handles Transport scheduling, voice management, cleanup. Returns the count of slots that will trigger (for visual scheduling).
- **Wheel component** — pointer event handler + CSS-transformed container. Renders slot ring + head. Computes angular delta from pointer position. Animates stone glow/dim by toggling CSS classes based on which slot is at the head during wind/spring-back.
- **Slot component** — purely presentational. Props: element type (or null), visual state (empty | filled | triggered | dimmed).
- **Stone palette component** — 5 element icons + clear button. Manages selection state.
- **BPM control component** — range slider (60–180, default 100, step 1) + root note label.
- **Head component** — fixed at 6 o'clock. Shows triggered stone icon when a filled slot is at head position, empty otherwise.
- **PWA shell** — `vite.config.ts` with `VitePWA` plugin. `manifest.json` with name, icons, theme color, display mode.

### Wheel state machine (detailed)

States and transitions:

```
READY ──(pointer drag start)──→ WINDING
WINDING ──(pointer up before tack)──→ SPRING_BACK (early release)
WINDING ──(rotation reaches full circle)──→ TACK
TACK ──(pointer up)──→ SPRING_BACK
SPRING_BACK ──(transition end, all notes played)──→ COMPLETE
COMPLETE ──(any interaction)──→ READY
```

- During WINDING: `pointermove` events dispatch `WIND` with angle delta. The reducer computes new rotation, tracks which slots crossed the head, and marks them as queued.
- On RELEASE: the reducer returns the queued slot indices and direction. The audio module schedules notes. CSS transition starts.
- During SPRING_BACK: the reducer tracks which slot is currently at the head (computed from transition progress). Components read this to render glow/dim.
- Pointer events are ignored during SPRING_BACK state.

### Audio scheduling

When the user releases (or reaches tack + releases):

1. Determine the list of slots that crossed the head during winding, in order of crossing.
2. Compute duration `T = slotCount * (60 / BPM)` seconds.
3. Schedule `N` notes on `Tone.Transport` at times `t = i * (T / N)` for `i = 0..N-1`, using `Tone.PluckSynth.triggerAttackRelease(note, "8n", time)`.
4. Set a CSS transition on the wheel from current angle to rest angle, duration = `T`.
5. Start both simultaneously: `Transport.start()` and apply the CSS transition in the same frame.
6. When the last note fires, dispatch `COMPLETE`.

The "tack" sound: a synthesized 30ms noise burst with sharp decay, layered with a brief sine blip at ~800Hz. Triggered immediately on TACK state entry.

### Empty slot behavior

Empty slots are rests. The head passes over them during spring-back at the same tempo — no note plays, but the timing grid is preserved. The phrase length is always `(slots that crossed head) * (60 / BPM)` seconds, regardless of how many are filled.

## Testing Decisions

### What makes a good test
- Test external behavior and state transitions, not implementation details.
- For the reducer: given a state and an action, assert the new state. Test every state transition, every action type, edge cases (all empty, all filled, early release, direction change).
- For the audio engine: verify the Transport scheduling logic (which notes are scheduled at which times) without actually playing audio. Mock tone.js.
- Do not test CSS animations, pointer event handling, or visual rendering — these require a browser and are better suited for manual QA or E2E in a later phase.

### Modules to test
- **Wheel state machine (reducer)** — exhaustive state transition tests. Cover every action in every state. Test slot queuing during winding (CW and CCW), early release, complete cycle.
- **Audio engine** — unit tests for `playSequence` scheduling logic with mocked tone.js. Verify correct notes, correct timing intervals, correct voice count.

### Prior art
- The reducer is a pure function: `(state, action) → state`. This is the same pattern as Redux reducers. Tests follow standard reducer testing conventions: arrange initial state, dispatch action, assert result.
- The audio engine wraps a third-party library (tone.js). Tests follow the adapter pattern: verify the wrapper's logic without exercising the library itself.

## Out of Scope

- Multiple wheels (layering, multi-track)
- Partial rotation (wind less than full circle without early release)
- N-rotation phrases (wind through 2+ full rotations)
- Looping / repeat playback
- Sampled instruments (guqin, pipa, flute)
- Drag-speed-mapped tempo
- Save/load stone arrangements
- Recording or audio export
- Visual theme selector
- Onboarding tutorial
- Title screen or app intro
- Adjustable root note / key transposition (fixed at C pentatonic)
- Haptic feedback beyond the synthesized tack sound
- Accessibility beyond basic PWA requirements
- Backend, user accounts, or cloud storage

## Further Notes

- The interaction model is intentionally constrained: the user composes by arranging stones (the composition surface) and performs by winding and releasing (the performance surface). This separation is the core creative concept.
- The spring-back speed is the tempo. The instrument plays *itself* once released — the user does not manually scroll to tempo.
- Two melodic variations from one arrangement: clockwise wind + CCW spring-back gives forward order. CCW wind + CW spring-back gives reverse order.
- Stone icons follow a Pokémon-type-badge style: glossy 3D spheres with black centered symbols. Colors: Earth = brown (soil symbol), Metal = gold/yellow (geometric symbol), Wood = green (leaf symbol), Fire = red (flame symbol), Water = blue (water drop symbol). Icons will be provided as SVG or JPEG and swapped into slot/palette components.
