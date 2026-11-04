# ADR-0009: Stone drag gesture with snap-to-slot

## Status

Accepted (implemented).

## Context

Stone placement required two steps: tap palette stone (SELECT_STONE), then tap slot (PLACE_STONE). Users wanted a more direct interaction — drag stone from palette to slot in one gesture.

Additionally, precise tap-to-place on small slot targets (36px circles on a rotating wheel) was frustrating on mobile. Users wanted the system to help with alignment.

## Decision

### 1. Stone drag gesture

Pointer down on palette stone → store `draggingElement` in local StonePalette state. Pointer move → ghost stone follows cursor. Pointer up on slot → dispatch `PLACE_STONE` with `element` and `slotIndex`. Pointer up elsewhere → cancel drag.

The gesture uses document-level pointer event listeners (not container-level) to avoid gesture blocking when the drag moves outside the palette bounds.

```typescript
// On pointer down:
document.addEventListener('pointermove', moveHandler);
document.addEventListener('pointerup', upHandler);

// On pointer up:
document.removeEventListener('pointermove', moveHandler);
document.removeEventListener('pointerup', upHandler);
```

Listeners are created once in a `useEffect` and stored in refs. The handlers read from refs (`draggingRef`, etc.) to avoid stale closures.

### 2. No `setPointerCapture`

Initial implementation used `setPointerCapture` on the palette stone element. This redirected all pointer events to that element, preventing document-level listeners from firing. Removed `setPointerCapture` — document listeners handle the full drag lifecycle.

### 3. Ghost stone with fade-out

Ghost stone is a `position: fixed` div following cursor coordinates. On pointer up, ghost fades out over 200ms via CSS transition (`opacity: 0`) + `setTimeout` cleanup.

```typescript
// On pointer up:
setIsFadingOut(true);
setTimeout(() => {
  setDraggingElement(null);
  setGhostPosition(null);
  setIsFadingOut(false);
}, 200);
```

CSS: `.stone-ghost { transition: opacity 0.2s ease-out; }` and `.stone-ghost--fading { opacity: 0; }`.

The Wheel also renders a ghost for dragging an already-placed Stone. It must be rendered **outside** `.wheel-container`: that element has a `transform: scale()` (ADR-0011), which would otherwise become the containing block for `position: fixed` and make the ghost jump away from the finger. This was a real touch bug, fixed by moving the ghost to the Wheel's top-level fragment.

### 4. Snap-to-slot detection

During pointer move, compute distance from cursor to each slot center. The snap detection is handled by `findSnapTargetFromDOM()` in `geometry.ts`, which reads the rendered slot positions via `getBoundingClientRect()` and returns the nearest slot within the threshold, along with its screen coordinates for ghost teleportation. The mathematical `findSnapTarget()` still exists but is unused; DOM positions stay correct during CSS transitions where `state.rotation` is stale.

```typescript
const snap = findSnapTargetFromDOM(cursorX, cursorY, SNAP_THRESHOLD_PX);
if (snap) {
  setGhostPosition({ x: snap.x, y: snap.y });
  setSnapTargetSlot(snap.slotIndex);
}
```

If nearest slot distance ≤ 30px threshold:
- Ghost teleports to slot center
- Target slot receives the `slot--glow` class — a dashed snap-target ring, distinct from the `slot--queued` gold ring used during winding
- `snapTargetSlot` state updated, propagated to Wheel → Slot via `isSnapTarget` prop

If no slot within threshold: ghost follows cursor normally, no ring.

### 5. `PLACE_STONE` action extension

`PLACE_STONE` action gains optional `element?: ElementType` field:

```typescript
| { type: 'PLACE_STONE'; slotIndex: number; element?: ElementType }
```

Reducer uses `action.element ?? state.selectedStone` to determine which stone to place. Backward compatible — existing click-to-place flow (SELECT_STONE → click slot) still works.

### 6. Mode guards

`PLACE_STONE` valid in `ready` and `springBack` modes. Blocked in `winding` (physical gesture in progress). There is no `tack` mode — tack is derived from rotation.

### 7. Mobile support

Added `touch-action: none` to `.stone-palette__stone`, `.stone-palette`, and `.stone-ghost` CSS rules. Prevents mobile browsers from scrolling/zooming during drag, allowing pointer events to fire normally on touch devices.

### 8. Slot hit testing

Slot components render `data-slot-index={index}` attribute. On pointer up (when no snap target), `document.elementFromPoint(x, y)` finds the element under cursor, then `.closest('[data-slot-index]')` finds the slot. This provides a fallback when snap threshold not reached but cursor is still over a slot.

### 9. Dragging an existing Stone (added later)

`useSlotDrag.ts` adds a second drag path: pointer down on a filled Slot → ghost follows finger → dropping on another Slot dispatches `REMOVE_STONE` + `PLACE_STONE` (move), dropping off the Wheel dispatches `REMOVE_STONE` (delete). It reuses the same document-level listener pattern and `findSnapTargetFromDOM()`.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Container-level pointer events on palette | Drag blocked when moving outside palette bounds toward wheel |
| `setPointerCapture` on palette stone | Redirects all events to stone element, preventing document listeners from firing |
| Instant ghost disappear on release | Jarring — no visual feedback that drag ended. Fade-out provides smooth transition. |
| Larger snap threshold (> 30px) | Too twitchy — slots are close together, easy to snap to wrong slot |
| Smaller snap threshold (< 30px) | Defeats purpose — user still needs precision |
| Inline snap geometry in StonePalette (v1) | Extracted to `findSnapTarget()` in geometry.ts on 2026-06-16 — the logic grew to ~30+ lines with rotation matrix + nearest-neighbor search, was untestable in React event handlers, and the cost of the module boundary was justified by independent testability. Later replaced in the running app by the DOM-based helper above. |

## Consequences

- **Positive**: Direct manipulation — drag stone from palette to slot in one gesture. More intuitive than two-step click.
- **Positive**: Snap-to-slot reduces precision needed for placement. Ghost teleports to slot center, slot gets a dashed ring for feedback.
- **Positive**: Document-level listeners work across entire screen — no gesture blocking.
- **Positive**: Fade-out animation provides smooth visual feedback that drag ended.
- **Positive**: Backward compatible — existing click-to-place flow still works.
- **Positive**: Mobile support via `touch-action: none` — no scroll/zoom interference during drag.
- **Negative**: StonePalette component is complex — tracks draggingElement, ghostPosition, isFadingOut, snapTargetSlot, plus refs for stable listeners. Acceptable for the feature value.
- **Negative**: Snap detection runs on every pointer move (60fps during drag). Computes 10 slot positions per frame. Negligible cost — `Math.hypot` is fast, 10 iterations is trivial.
- **Negative**: `data-slot-index` attribute on Slot components is a leaky abstraction — drag code reaches into DOM to find slots. Acceptable — it's a pragmatic solution for hit testing.

> Historical note: the original ADR described `findSnapTarget()` (rotation-matrix math), a `tack` mode, and palette-only dragging. The current implementation uses the DOM-based helper, has no tack mode, and adds slot-to-slot dragging.
