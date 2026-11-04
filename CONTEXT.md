# Five-Element Wheel — Ubiquitous Language

## Instrument anatomy

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Wheel** | The circular surface with 10 slots that rotates via drag and springs back on release | Dial, disc, rotor |
| **Slot** | One of 10 positions on the wheel where a stone can be placed; empty slots are rests | Position, cell, hole |
| **Head** | The fixed cinnabar square seal at 6 o'clock that slots pass under; shows the character of the Stone currently being read and presses down on each beat during spring-back | Marker, trigger, pickup, playhead |
| **Stone** | A round mineral seal with an engraved element character, representing one of the five elements; placed in slots to compose a melody | Gem, element-icon, bead |
| **Palette** | The horizontal bar of 5 stones + the 歸零 (RESET) button above the wheel; the composition surface | Tray, selector bar, toolbar |
| **Ghost stone** | Semi-transparent stone that follows the cursor during a stone drag gesture; fades out over 200ms on release | Drag preview, floating stone |
| **Snap target** | The slot nearest the ghost stone within 30px threshold; marked with a dashed ring to indicate where the drop will land | Hover target, drop zone |

## Elements and notes

| Term | Definition | Note (key=C) | Color |
|------|-----------|-------------|-------|
| **Earth** (土) | Ochre stone, represents stability and soil | Root (Gōng / Do) | `#8A6A3C` |
| **Metal** (金) | Gold-leaf stone, represents structure and geometry | M2 (Shāng / Re) | `#B08D57` |
| **Wood** (木) | Celadon stone, represents growth and foliage | M3 (Jué / Mi) | `#6E8B84` |
| **Fire** (火) | Cinnabar stone, represents energy and flame | P5 (Zhǐ / Sol) | `#A8322A` |
| **Water** (水) | Ink-blue stone, represents flow and adaptability | M6 (Yǔ / La) | `#4A6470` |

The five elements map to the pentatonic scale (五音 / wǔ yīn). The **key** can be changed via the 調 selector — intervals (root, M2, M3, P5, M6) are preserved. The **octave** range is 3 to 8. Any arrangement sounds consonant because the pentatonic scale has no semitones.

## Visual feedback

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Phrase trace** | The ink chart below the Wheel: ten beats on the horizontal axis, the five pentatonic degrees (宮商角徵羽) on the vertical. Sounded Stones leave cinnabar marks joined by a hairline gold stroke; a rest breaks the stroke. Only the marks are recomputed at a loop iteration boundary — the grid, degree names, and beat readout stay still. | Waveform, piano roll, sequencer |
| **Seal press** | The short hard-attack animation at the Head on each beat; the only per-beat event. Stones stay still. | Note pop, particle effect |
| **Guide dialog** | The 玩法 card opened by the button under the title rule; contains the rules of play. It is a fixed overlay, not part of the main layout. | Help modal, tooltip, first-use hint |

## Wheel state machine

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **READY** | The idle state; stones can be placed, selected, or cleared. Drag starts winding. | Idle, default, editing |
| **WINDING** | The user is dragging the wheel; rotation follows the finger. Slots cross the head and are queued. | Dragging, turning, spinning |
| **SPRING_BACK** | The wheel returns to rest position (0°) while notes play at evenly-spaced intervals. Playback handles looping internally — wheel stays at rest. Also accepts stone placement and wheel drag interruption. | Playback, unwinding, auto-return |

`COMPLETE` is an **action**, not a mode: it returns the Wheel to READY while preserving slots, selection, BPM, key, and octave. It is dispatched by the playback `onComplete` callback (or immediately when the queued-slot count is zero); the CSS `transitionend` handler is suppressed while playback is active.

## Actions (dispatched to the reducer)

| Term | Definition |
|------|-----------|
| **SELECT_STONE** | Tap a stone in the palette to make it the active selection for placement |
| **PLACE_STONE** | Place a stone in a slot; uses `action.element` if provided (stone drag), else falls back to `state.selectedStone` (click-to-place). Valid in `ready` and `springBack` modes. |
| **REMOVE_STONE** | Remove a stone from a slot. Triggered by clicking a filled slot with the same stone selected, or by dragging a stone off the wheel. Valid in `ready` and `springBack` modes. |
| **RESET** | Reset entire app to initial state via the 歸零 button. Returns full `initialWheelState` (including BPM, loop, key, and octave). Valid in any mode. |
| **WIND** | Pointer-move delta applied to wheel rotation; queues slots as they cross the head. Valid in `ready`, `winding`, and `springBack` (interrupts loop). |
| **RELEASE** | Pointer up; transitions WINDING → SPRING_BACK |
| **COMPLETE** | Dispatched by the playback `onComplete` callback. Returns to READY preserving slots, stones, BPM, key, and octave. |
| **SET_BPM** | Slider change; updates BPM between 120–200 |
| **SET_LOOP** | Toggle change; sets `loop` boolean on state |
| **SET_KEY** | Key selector change; sets `key` to a chromatic note name (C, C#, D, …, B). Invalid keys are rejected. |
| **SET_OCTAVE** | Octave selector change; clamps `octave` to 3..8. The base frequency is scaled by `2^(octave - 4)`. |

## Performance concepts

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Spring-back** | The automatic return of the wheel to its rest position (0°) after release; duration = `queuedSlotCount × (60 / BPM)` seconds. First spring-back uses CSS transition synced to audio. | Unwinding, playback, return |
| **Loop** | Automatic replay of the melody without gaps. One `startPlayback()` call pre-schedules multiple iterations and extends dynamically; the wheel stays at rest. Stone edits apply to all future beats across iterations. | Auto-repeat, cycle |
| **Loop iteration** | One complete playback cycle during loop. All iterations are scheduled continuously — no gaps between them. Stone edits apply immediately to all future beats. | Pass, cycle, repetition |
| **Hot reload** | Mid-playback stone edits take effect on future beats. `PlaybackControl.updateSlots()` cancels oscillators for beats ≥ current, re-schedules with new elements. Already-played beats unchanged. | Live edit, real-time update |
| **Key** | The root note of the pentatonic scale. Selectable from 12 chromatic notes via dropdown. Pentatonic intervals (root→M2→M3→P5→M6) are preserved regardless of key. | Root, tonic, fundamental |
| **Octave** | Transposition offset applied to all element frequencies. Range 3 to 8. Each step doubles/halves all frequencies. | Transposition, register |
| **Frequency computation** | `rootFreq = 261.63 × 2^(semitoneFromC/12 + (octave - 4))`, then `frequency = rootFreq × 2^(interval/12)`, where `semitoneFromC` is the key's chromatic index and `interval` is the pentatonic offset from `ELEMENT_INTERVALS`. | |
| **Queued slots** | Slots that crossed the head during winding, stored in crossing order; determines which notes play and in what sequence | Triggered slots, crossing set |
| **Play order** | Encounter order: queued slots play in the exact order they crossed the head during winding | Melody order, sequence |
| **Beat grid** | The 10-beat timing framework: one beat per slot regardless of fill. Empty slots are rests — no note, but the beat position is preserved. The beat callback reports the queue index on every beat, including rests. | Timing grid, pulse |
| **Tack sound** | A synthesized 30ms noise burst + 800Hz sine blip played when rotation crosses ±360° during winding. Derived from rotation value, not a mode transition. | Click, stop sound, mechanical catch |
| **Early release** | Releasing before reaching tack; plays only the slots that already crossed the head with a proportionally shorter spring-back | Partial wind, short phrase |
| **Stone drag** | Pointer down on a palette stone (or an already-placed stone) → move → up on a slot. A ghost stone follows the cursor. Coexists with two-step click-to-place; dragging an existing stone off the wheel removes it. | Drag-and-drop, pick-and-place |
| **Snap** | When ghost stone is within 30px of a slot center, it teleports to the slot and the slot gets a dashed snap-target ring. Reduces precision needed for placement. | Magnetic snap, auto-align |

## Direction labels

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **順 / 逆 (visual read order)** | UI label for the direction in which Stones appear to pass the fixed Head on screen. It is the **opposite** of the finger's wind direction: a CW wind makes Stones cross the Head in a counter-clockwise visual order, so a CW wind is labelled 逆 and a CCW wind is labelled 順. `direction` in state still records the finger's wind direction. | 順/逆 as "finger direction"; "forward/reverse" as a property of `queuedSlotIndices` |

## Relationships

- A **Wheel** contains exactly 10 **Slots** (indices 0–9). They are placed clockwise along a 300° arc starting at 210° (7 o'clock), leaving a 60° reading gap at the **Head** (6 o'clock / 180°).
- A **Slot** holds zero or one **Stone** (null = empty/rest, ElementType = filled)
- The **Head** is fixed at 6 o'clock (180°); the **Wheel** rotates behind it
- **WINDING** queues **Slots** into `queuedSlotIndices` as they cross the **Head**
- **SPRING_BACK** plays the **queued slots** in **play order** determined by wind direction
- **BPM** controls the spring-back CSS transition duration and the interval between scheduled audio notes. Default is 180.
- **Key** and **octave** control element frequencies via `getElementFrequencies()` (in `frequencies.ts`). Pentatonic intervals are preserved across all keys.
- Rotation is capped at ±360° (one full rotation); crossing it triggers tack sound (derived threshold, not a mode)
- **Stone drag** dispatches **PLACE_STONE** with explicit `element` field; click-to-place uses `selectedStone` fallback
- **Snap target** is computed by `findSnapTargetFromDOM()` in `geometry.ts`, which reads rendered slot positions via `getBoundingClientRect()` and returns the nearest within threshold. The mathematical `findSnapTarget()` still exists but is unused.
- **COMPLETE** preserves key and octave along with slots, selectedStone, and BPM
- Changing BPM, key, octave, or loop during SPRING_BACK cancels the current playback and restarts the phrase from beat 1 (the playback effect depends on those fields). Stone edits alone are hot-reloaded.
- The **Wheel** is drawn in a fixed 360px coordinate system; `useFitWheel` scales that frame into the height left by the rest of the screen so the main view fits one mobile viewport without scrolling (ADR-0011).

## Example dialogue

> **Dev:** "If the user places stones in slots 0, 4, and 7 and winds CW, what plays?"
>
> **Domain expert:** "With the 300° arc starting at 210°, a full CW wind crosses the head in slot order 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, so `queuedSlotIndices` is `[9,8,7,6,5,4,3,2,1,0]`. During spring-back, stones play in this exact encounter order — no sorting. Slots 0, 4, and 7 play their notes when their position in the queue is reached — the rest are rests."

> **Dev:** "So the queued slot indices are the same as the play order?"
>
> **Domain expert:** "Correct. Playback follows encounter order exactly. No sorting, no reordering. The first stone that crossed the head plays first, and so on."

> **Dev:** "What if they release early — only wound 108°?"
>
> **Domain expert:** "Slot spacing is 300/9 ≈ 33.33°, so 108° crosses three slots: queued = `[9,8,7]`. Spring-back plays those 3 in the same order. Duration is 3 beats × (60/BPM) seconds."

> **Dev:** "What happens if the user adds a stone to slot 2 during playback?"
>
> **Domain expert:** "The already-scheduled audio for the current beat plays to completion with the old slots. `updateSlots()` re-schedules every future beat (≥ currentBeat) across all pre-scheduled iterations with the new slots array. There is no per-iteration `startPlayback()` re-run — the loop is one continuous schedule. The user hears the new stone on a future beat of that same loop."

> **Dev:** "Can the user interrupt the loop?"
>
> **Domain expert:** "Two ways: (1) Drag the wheel — WIND action transitions springBack → winding, playback cancels via useEffect cleanup. After release, a new spring-back plays with the new queued slots, and loop auto-restarts if still enabled. (2) RESET — resets to ready mode, cancels playback, empties slots and queued indices, and restores BPM, loop, key, and octave to their defaults."

> **Dev:** "What if I change the key from C to G during playback?"
>
> **Domain expert:** "The playback effect depends on `state.key`, so the current playback is cancelled and a new one starts from beat 1 immediately with the new key. All pentatonic intervals shift: Earth becomes G (root), Metal becomes A (M2), Wood becomes B (M3), Fire becomes D (P5), Water becomes E (M6). The same slots play a different set of frequencies."

> **Dev:** "What about octave changes?"
>
> **Domain expert:** "The same — `state.octave` is also an effect dependency, so playback restarts from beat 1. Each step doubles or halves all frequencies. Octave 6 plays everything one octave higher than octave 5."
