# Five-Element Wheel — Ubiquitous Language

## Instrument anatomy

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Wheel** | The circular surface with 10 slots that rotates via drag and springs back on release | Dial, disc, rotor |
| **Slot** | One of 10 positions on the wheel where a stone can be placed; empty slots are rests | Position, cell, hole |
| **Head** | The fixed blue rounded rectangle at 6 o'clock that slots pass under; displays the currently-playing stone icon during spring-back | Marker, trigger, pickup, playhead |
| **Stone** | A colored sphere representing one of the five elements; placed in slots to compose a melody | Gem, element-icon, bead |
| **Palette** | The horizontal bar of 5 stones + Clear button above the wheel; the composition surface | Tray, selector bar, toolbar |
| **Ghost stone** | Semi-transparent stone that follows the cursor during a stone drag gesture; fades out on release | Drag preview, floating stone |
| **Snap target** | The slot nearest the ghost stone within 30px threshold; glows to indicate drop will land there | Hover target, drop zone |

## Elements and notes

| Term | Definition | Note (key=C) | Color |
|------|-----------|-------------|-------|
| **Earth** (土) | Brown stone, represents stability and soil | Root (Gōng / Do) | `#8B6914` |
| **Metal** (金) | Silver-grey stone, represents structure and geometry | M2 (Shāng / Re) | `#A8B8C0` |
| **Wood** (木) | Green stone, represents growth and foliage | M3 (Jué / Mi) | `#4CAF50` |
| **Fire** (火) | Red stone, represents energy and flame | P5 (Zhǐ / Sol) | `#E53935` |
| **Water** (水) | Blue stone, represents flow and adaptability | M6 (Yǔ / La) | `#1E88E5` |

The five elements map to the pentatonic scale (五音 / wǔ yīn). The **key** can be changed via the Key selector — intervals (root, M2, M3, P5, M6) are preserved. The **octave** can be shifted ±2. Any arrangement sounds consonant.

## Wheel state machine

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **READY** | The idle state; stones can be placed, selected, or cleared. Drag starts winding. | Idle, default, editing |
| **WINDING** | The user is dragging the wheel; rotation follows the finger. Slots cross the head and are queued. | Dragging, turning, spinning |
| **TACK** | The wheel has reached its mechanical stop at one full rotation (360°). A 30ms noise burst plays. | Stop, limit, catch |
| **SPRING_BACK** | The wheel returns to rest position (0°) while notes play at evenly-spaced intervals. Playback handles looping internally — wheel stays at rest. Also accepts stone placement and wheel drag interruption. | Playback, unwinding, auto-return |
| **COMPLETE** | Spring-back finished; resets to READY preserving slots, selection, BPM, key, and octave. Playback handles looping internally. | Done, finished, reset |

## Actions (dispatched to the reducer)

| Term | Definition |
|------|-----------|
| **SELECT_STONE** | Tap a stone in the palette to make it the active selection for placement |
| **PLACE_STONE** | Place a stone in a slot; uses `action.element` if provided (stone drag), else falls back to `state.selectedStone` (click-to-place). Valid in `ready` and `springBack` modes. |
| **CLEAR_ALL** | Empty all 10 slots at once via the Clear button. Valid in any mode — full reset including queued slots and mode. |
| **WIND** | Pointer-move delta applied to wheel rotation; queues slots as they cross the head. Valid in `ready`, `winding`, and `springBack` (interrupts loop). |
| **RELEASE** | Pointer up; transitions WINDING or TACK → SPRING_BACK |
| **TACK** | Dispatched automatically when rotation reaches ±360° during WINDING |
| **COMPLETE** | Dispatched when CSS transition ends (first playback) or when rAF loop completes (loop iterations). Returns to READY preserving slots, stones, BPM, key, and octave. |
| **SET_BPM** | Slider change; updates BPM between 60–180 |
| **SET_LOOP** | Toggle change; sets `loop` boolean on state |
| **SET_KEY** | Key selector change; sets `key` to a chromatic note name (C, C#, D, …, B). Invalid keys are rejected. |
| **SET_OCTAVE** | Octave selector change; sets `octave` within -2..+2. Frequencies are shifted by `2^octave`. |

## Performance concepts

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Spring-back** | The automatic return of the wheel to its rest position (0°) after release; duration = `queuedSlotCount × (60 / BPM)` seconds. First spring-back uses CSS transition synced to audio. | Unwinding, playback, return |
| **Loop** | Automatic replay of the melody without gaps. Playback pre-schedules multiple iterations and extends dynamically. Wheel stays at rest position during loop. Stone edits apply to all future beats across iterations. | Auto-repeat, cycle |
| **Loop iteration** | One complete playback cycle during loop. All iterations are scheduled continuously — no gaps between them. Stone edits apply immediately to all future beats. | Pass, cycle, repetition |
| **Hot reload** | Mid-playback stone edits take effect on future beats. `PlaybackControl.updateSlots()` cancels oscillators for beats ≥ current, re-schedules with new elements. Already-played beats unchanged. | Live edit, real-time update |
| **Key** | The root note of the pentatonic scale. Selectable from 12 chromatic notes via dropdown. Pentatonic intervals (root→M2→M3→P5→M6) are preserved regardless of key. | Root, tonic, fundamental |
| **Octave** | Transposition offset applied to all element frequencies. Range -2 to +2. Each step doubles/halves all frequencies. | Transposition, register |
| **Frequency computation** | `frequency = 261.63 × 2^((semitoneFromC + interval) / 12 + octave)` where `semitoneFromC` is the key's chromatic index and `interval` is the pentatonic offset from `ELEMENT_INTERVALS`. | |
| **Queued slots** | Slots that crossed the head during winding, stored in crossing order; determines which notes play and in what sequence | Triggered slots, crossing set |
| **Play order** | Encounter order: queued slots play in the exact order they crossed the head during winding | Melody order, sequence |
| **Beat grid** | The 10-beat timing framework: one beat per slot regardless of fill. Empty slots are rests — no note, but the beat position is preserved. | Timing grid, pulse |
| **Tack sound** | A synthesized 30ms noise burst + 800Hz sine blip played when the wheel reaches ±360° | Click, stop sound, mechanical catch |
| **Early release** | Releasing before reaching tack; plays only the slots that already crossed the head with a proportionally shorter spring-back | Partial wind, short phrase |
| **Stone drag** | Pointer down on palette stone → move → up on slot. Ghost stone follows cursor. Replaces two-step click-to-place flow. | Drag-and-drop, pick-and-place |
| **Snap** | When ghost stone is within 30px of a slot center, it teleports to the slot and the slot glows. Reduces precision needed for placement. | Magnetic snap, auto-align |

## Relationships

- A **Wheel** contains exactly 10 **Slots** (indices 0–9, numbered clockwise from 12 o'clock)
- A **Slot** holds zero or one **Stone** (null = empty/rest, ElementType = filled)
- The **Head** is fixed at 6 o'clock (180°); the **Wheel** rotates behind it
- **WINDING** queues **Slots** into `queuedSlotIndices` as they cross the **Head**
- **SPRING_BACK** plays the **queued slots** in **play order** determined by wind direction
- **BPM** controls the spring-back CSS transition duration and the interval between scheduled audio notes. Default is 180.
- **Key** and **octave** control element frequencies via `getElementFrequencies()` (in `frequencies.ts`). Pentatonic intervals are preserved across all keys.
- Rotation is capped at ±360° (one full rotation); exceeding it triggers **TACK**
- **Stone drag** dispatches **PLACE_STONE** with explicit `element` field; click-to-place uses `selectedStone` fallback
- **Snap target** is computed by `findSnapTarget()` in `geometry.ts`, which rotates slot positions via `getSlotPosition()` and returns the nearest within threshold.
- **COMPLETE** preserves key and octave along with slots, selectedStone, and BPM

## Example dialogue

> **Dev:** "If the user places stones in slots 0, 4, and 7 and winds CW, what plays?"
>
> **Domain expert:** "During winding, slots cross the head in order: 5, 4, 3, 2, 1, 0, 9, 8, 7, 6. If they wind a full rotation, `queuedSlotIndices` is `[5,4,3,2,1,0,9,8,7,6]`. During spring-back, stones play in this exact encounter order — no sorting. Slots 0, 4, and 7 play their notes when their position in the queue is reached — the rest are rests."

> **Dev:** "So the queued slot indices are the same as the play order?"
>
> **Domain expert:** "Correct. Playback follows encounter order exactly. No sorting, no reordering. The first stone that crossed the head plays first, and so on."

> **Dev:** "What if they release early — only wound 108°?"
>
> **Domain expert:** "Only 3 slots crossed the head: queued = `[5,4,3]`. Spring-back plays those 3 in the same order: `[5,4,3]`. Duration is 3 beats × (60/BPM) seconds."

> **Dev:** "What happens on the second loop iteration if the user added a stone to slot 2 during playback?"
>
> **Domain expert:** "The current iteration's already-scheduled audio plays to completion with the old slots. The `updateSlots()` method re-schedules future beats (≥ currentBeat) with the new slots array. On the next loop iteration, `startPlayback()` receives the updated slots snapshot from state — all 10 beats use the current slots. The user hears the new stone on the next pass."

> **Dev:** "Can the user interrupt the loop?"
>
> **Domain expert:** "Two ways: (1) Drag the wheel — WIND action transitions springBack → winding, playback cancels via useEffect cleanup. After release, a new spring-back plays with the new queued slots, and loop auto-restarts if still enabled. (2) CLEAR_ALL — resets to ready mode, cancels playback, empties slots and queued indices."

> **Dev:** "What if I change the key from C to G during playback?"
>
> **Domain expert:** "The key change takes effect on the next `startPlayback()` call (after COMPLETE or wheel interrupt → release). All pentatonic intervals shift: Earth becomes G (root), Metal becomes A (M2), Wood becomes B (M3), Fire becomes D (P5), Water becomes E (M6). The same slots play a different set of frequencies."

> **Dev:** "What about octave changes?"
>
> **Domain expert:** "Similar to key — takes effect on next playback start. Each step doubles or halves all frequencies. Octave +1 plays everything one octave higher; -1 plays one octave lower."
