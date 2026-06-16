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

Listeners are created once in a `useEffect` and stored in refs. The handlers read from refs (`draggingRef`, `wheelRotationRef`, etc.) to avoid stale closures.

### 2. No `setPointerCapture`

Initial implementation used `setPointerCapture` on the palette stone element. This redirected all pointer events to that element, preventing document-level listeners from firing. Removed `setPointerCapture` — document listeners handle the full drag lifecycle.

### 3. Ghost stone with fade-out

Ghost stone is a `position: fixed` div rendered in StonePalette, following cursor coordinates. On pointer up, ghost fades out over 200ms via CSS transition (`opacity: 0`) + `setTimeout` cleanup.

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

### 4. Snap-to-slot detection

During pointer move, compute distance from cursor to each slot center. Slot positions computed via `getSlotPosition()` in `geometry.ts`, rotated by current wheel rotation.

```typescript
for (let i = 0; i < SLOT_COUNT; i++) {
  const base = getSlotPosition(i, 0, 0, SLOT_ORBIT_RADIUS);
  const dx = base.x * cosR - base.y * sinR;
  const dy = base.x * sinR + base.y * cosR;
  const slotX = cx + dx;
  const slotY = cy + dy;
  const dist = Math.hypot(slotX - cursorX, slotY - cursorY);
  // ...
}
```

If nearest slot distance ≤ 30px threshold:
- Ghost teleports to slot center
- Target slot receives `slot--glow` CSS class (reused from winding glow)
- `snapTargetSlot` state updated, propagated to Wheel → Slot via `isSnapTarget` prop

If no slot within threshold: ghost follows cursor normally, no glow.

### 5. `PLACE_STONE` action extension

`PLACE_STONE` action gains optional `element?: ElementType` field:

```typescript
| { type: 'PLACE_STONE'; slotIndex: number; element?: ElementType }
```

Reducer uses `action.element ?? state.selectedStone` to determine which stone to place. Backward compatible — existing click-to-place flow (SELECT_STONE → click slot) still works.

### 6. Mode guards

`PLACE_STONE` valid in `ready` and `springBack` modes. Blocked in `winding` and `tack` (physical gesture in progress).

### 7. Mobile support

Added `touch-action: none` to `.stone-palette__stone`, `.stone-palette`, and `.stone-ghost` CSS rules. Prevents mobile browsers from scrolling/zooming during drag, allowing pointer events to fire normally on touch devices.

### 8. Slot hit testing

Slot components render `data-slot-index={index}` attribute. On pointer up (when no snap target), `document.elementFromPoint(x, y)` finds the element under cursor, then `.closest('[data-slot-index]')` finds the slot. This provides a fallback when snap threshold not reached but cursor is still over a slot.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Container-level pointer events on palette | Drag blocked when moving outside palette bounds toward wheel |
| `setPointerCapture` on palette stone | Redirects all events to stone element, preventing document listeners from firing |
| Instant ghost disappear on release | Jarring — no visual feedback that drag ended. Fade-out provides smooth transition. |
| Larger snap threshold (> 30px) | Too twitchy — slots are close together, easy to snap to wrong slot |
| Smaller snap threshold (< 30px) | Defeats purpose — user still needs precision |
| Separate snap detection module | Over-engineering — logic is 20 lines, lives in StonePalette where it's used |

## Consequences

- **Positive**: Direct manipulation — drag stone from palette to slot in one gesture. More intuitive than two-step click.
- **Positive**: Snap-to-slot reduces precision needed for placement. Ghost teleports to slot center, slot glows for feedback.
- **Positive**: Document-level listeners work across entire screen — no gesture blocking.
- **Positive**: Fade-out animation provides smooth visual feedback that drag ended.
- **Positive**: Backward compatible — existing click-to-place flow still works.
- **Positive**: Mobile support via `touch-action: none` — no scroll/zoom interference during drag.
- **Negative**: StonePalette component is more complex — tracks draggingElement, ghostPosition, isFadingOut, snapTargetSlot, plus refs for stable listeners. Acceptable for the feature value.
- **Negative**: Snap detection runs on every pointer move (60fps during drag). Computes 10 slot positions per frame. Negligible cost — `Math.hypot` is fast, 10 iterations is trivial.
- **Negative**: `data-slot-index` attribute on Slot components is a leaky abstraction — StonePalette reaches into DOM to find slots. Acceptable — it's a pragmatic solution for hit testing.
