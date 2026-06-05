# Five-Element Wheel — Ubiquitous Language

## Instrument anatomy

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Wheel** | The circular surface with 10 slots that rotates via drag and springs back on release | Dial, disc, rotor |
| **Slot** | One of 10 positions on the wheel where a stone can be placed; empty slots are rests | Position, cell, hole |
| **Head** | The fixed blue rounded rectangle at 6 o'clock that slots pass under; displays the currently-playing stone icon during spring-back | Marker, trigger, pickup, playhead |
| **Stone** | A colored sphere representing one of the five elements; placed in slots to compose a melody | Gem, element-icon, bead |
| **Palette** | The horizontal bar of 5 stones + Clear button above the wheel; the composition surface | Tray, selector bar, toolbar |

## Elements and notes

| Term | Definition | Note | Color |
|------|-----------|------|-------|
| **Earth** (土) | Brown stone, represents stability and soil | C4 (Gōng / Do) | `#8B6914` |
| **Metal** (金) | Gold stone, represents structure and geometry | D4 (Shāng / Re) | `#DAA520` |
| **Wood** (木) | Green stone, represents growth and foliage | E4 (Jué / Mi) | `#4CAF50` |
| **Fire** (火) | Red stone, represents energy and flame | G4 (Zhǐ / Sol) | `#E53935` |
| **Water** (水) | Blue stone, represents flow and adaptability | A4 (Yǔ / La) | `#1E88E5` |

The five elements map to the C pentatonic scale (五音 / wǔ yīn). Together they form a complete pentatonic set — any arrangement sounds consonant.

## Wheel state machine

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **READY** | The idle state; stones can be placed, selected, or cleared. Drag starts winding. | Idle, default, editing |
| **WINDING** | The user is dragging the wheel; rotation follows the finger. Slots cross the head and are queued. | Dragging, turning, spinning |
| **TACK** | The wheel has reached its mechanical stop at one full rotation (360°). A 30ms noise burst plays. | Stop, limit, catch |
| **SPRING_BACK** | The wheel returns to rest via CSS transition; notes play at evenly-spaced intervals. Pointer events disabled. | Playback, unwinding, auto-return |
| **COMPLETE** | Spring-back finished; resets to READY preserving slots, selection, and BPM. | Done, finished, reset |

## Actions (dispatched to the reducer)

| Term | Definition |
|------|-----------|
| **SELECT_STONE** | Tap a stone in the palette to make it the active selection for placement |
| **PLACE_STONE** | Tap a slot to place the selected stone there; replaces any existing stone |
| **CLEAR_ALL** | Empty all 10 slots at once via the Clear button |
| **WIND** | Pointer-move delta applied to wheel rotation; queues slots as they cross the head |
| **RELEASE** | Pointer up; transitions WINDING or TACK → SPRING_BACK |
| **TACK** | Dispatched automatically when rotation reaches ±360° during WINDING |
| **COMPLETE** | Dispatched when CSS transition ends; returns to READY |
| **SET_BPM** | Slider change; updates BPM between 60–180 |

## Performance concepts

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Spring-back** | The automatic return of the wheel to its rest position (0°) after release; duration = `queuedSlotCount × (60 / BPM)` seconds | Unwinding, playback, return |
| **Queued slots** | Slots that crossed the head during winding, stored in crossing order; determines which notes play and in what sequence | Triggered slots, crossing set |
| **Play order** | The sorted order of queued slots during spring-back: ascending (CW wind = forward) or descending (CCW wind = reverse) | Melody order, sequence |
| **Beat grid** | The 10-beat timing framework: one beat per slot regardless of fill. Empty slots are rests — no note, but the beat position is preserved. | Timing grid, pulse |
| **Tack sound** | A synthesized 30ms noise burst + 800Hz sine blip played when the wheel reaches ±360° | Click, stop sound, mechanical catch |
| **Early release** | Releasing before reaching tack; plays only the slots that already crossed the head with a proportionally shorter spring-back | Partial wind, short phrase |

## Relationships

- A **Wheel** contains exactly 10 **Slots** (indices 0–9, numbered clockwise from 12 o'clock)
- A **Slot** holds zero or one **Stone** (null = empty/rest, ElementType = filled)
- The **Head** is fixed at 6 o'clock (180°); the **Wheel** rotates behind it
- **WINDING** queues **Slots** into `queuedSlotIndices` as they cross the **Head**
- **SPRING_BACK** plays the **queued slots** in **play order** determined by wind direction
- CW wind (positive rotation) → CCW spring-back → forward play order (ascending indices)
- CCW wind (negative rotation) → CW spring-back → reverse play order (descending indices)
- **BPM** controls the spring-back CSS transition duration and the interval between scheduled audio notes
- Rotation is capped at ±360° (one full rotation); exceeding it triggers **TACK**

## Example dialogue

> **Dev:** "If the user places stones in slots 0, 4, and 7 and winds CW, what plays?"
>
> **Domain expert:** "During winding, slots cross the head in order: 5, 4, 3, 2, 1, 0, 9, 8, 7, 6. If they wind a full rotation, `queuedSlotIndices` is `[5,4,3,2,1,0,9,8,7,6]`. During spring-back, the play order is ascending (CW wind = forward): `[0,1,2,3,4,5,6,7,8,9]`. Slots 0, 4, and 7 play their notes — the rest are rests."
>
> **Dev:** "So the queued slot indices aren't the same as the play order?"
>
> **Domain expert:** "Correct. `queuedSlotIndices` records crossing order during winding. `playSequence` re-sorts them based on direction: ascending for CW wind, descending for CCW. This way CW wind always gives a forward melody regardless of which slots are filled."
>
> **Dev:** "What if they release early — only wound 108°?"
>
> **Domain expert:** "Only 3 slots crossed the head: queued = `[5,4,3]`. Spring-back plays those 3 in ascending order: `[3,4,5]`. Duration is 3 beats × (60/BPM) seconds. The last ~7 beats of the grid are skipped entirely."
