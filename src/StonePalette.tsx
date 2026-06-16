import { useState, useCallback, useRef } from 'react';
import type { ElementType, WheelMode } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS, SLOT_ORBIT_RADIUS } from './types';
import type { WheelAction } from './types';
import { getSlotPosition } from './geometry';

const ELEMENTS: ElementType[] = ['earth', 'metal', 'wood', 'fire', 'water'];
const SLOT_COUNT = 10;
const SNAP_THRESHOLD_PX = 30;

interface StonePaletteProps {
  selectedStone: ElementType | null;
  onSelectStone: (element: ElementType) => void;
  onClear: () => void;
  dispatch: React.Dispatch<WheelAction>;
  wheelRotation: number;
  wheelMode: WheelMode;
  onSnapTargetChange: (slotIndex: number | null) => void;
}

function StonePalette({ selectedStone, onSelectStone, onClear, dispatch, wheelRotation, wheelMode, onSnapTargetChange }: StonePaletteProps) {
  const [draggingElement, setDraggingElement] = useState<ElementType | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [snapTargetSlot, setSnapTargetSlot] = useState<number | null>(null);
  const snapTargetSlotRef = useRef<number | null>(null);

  const handlePointerDown = useCallback((el: ElementType) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingElement(el);
    setGhostPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingElement) return;

    const cursorX = e.clientX;
    const cursorY = e.clientY;

    // Find nearest slot center for snap detection
    const wheelEl = document.querySelector('.wheel-container');
    if (wheelEl) {
      const rect = wheelEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const Rrad = (wheelRotation * Math.PI) / 180;
      const cosR = Math.cos(Rrad);
      const sinR = Math.sin(Rrad);

      let nearestDist = Infinity;
      let nearestIdx: number | null = null;
      let nearestPos = { x: 0, y: 0 };

      for (let i = 0; i < SLOT_COUNT; i++) {
        // Get unrotated slot position relative to wheel center (screen coords)
        const base = getSlotPosition(i, 0, 0, SLOT_ORBIT_RADIUS);
        // Apply wheel rotation (CW) around center
        const dx = base.x * cosR - base.y * sinR;
        const dy = base.x * sinR + base.y * cosR;
        const slotX = cx + dx;
        const slotY = cy + dy;

        const dist = Math.hypot(slotX - cursorX, slotY - cursorY);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
          nearestPos = { x: slotX, y: slotY };
        }
      }

      if (nearestIdx !== null && nearestDist <= SNAP_THRESHOLD_PX) {
        setGhostPosition(nearestPos);
        setSnapTargetSlot(nearestIdx);
        snapTargetSlotRef.current = nearestIdx;
        onSnapTargetChange(nearestIdx);
        return;
      }
    }

    // No snap — follow cursor
    setGhostPosition({ x: cursorX, y: cursorY });
    setSnapTargetSlot(null);
    snapTargetSlotRef.current = null;
    onSnapTargetChange(null);
  }, [draggingElement, wheelRotation, onSnapTargetChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingElement) return;

    const targetSlot = snapTargetSlotRef.current;
    if (targetSlot !== null) {
      dispatch({ type: 'PLACE_STONE', slotIndex: targetSlot, element: draggingElement });
    } else {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slotEl = el?.closest('[data-slot-index]');
      if (slotEl) {
        const slotIndex = Number(slotEl.getAttribute('data-slot-index'));
        dispatch({ type: 'PLACE_STONE', slotIndex, element: draggingElement });
      }
    }
    setDraggingElement(null);
    setGhostPosition(null);
    setSnapTargetSlot(null);
    snapTargetSlotRef.current = null;
    onSnapTargetChange(null);
  }, [draggingElement, dispatch, onSnapTargetChange]);

  return (
    <div
      className="stone-palette"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {ELEMENTS.map((el) => (
        <div
          key={el}
          className={
            'stone-palette__stone' +
            (selectedStone === el ? ' stone-palette__stone--selected' : '')
          }
          style={{ backgroundColor: ELEMENT_COLORS[el] }}
          onClick={() => onSelectStone(el)}
          onPointerDown={handlePointerDown(el)}
        >
          {ELEMENT_SYMBOLS[el]}
        </div>
      ))}
      <button className="stone-palette__clear" onClick={onClear}>
        Clear
      </button>
      {draggingElement && ghostPosition && (
        <div
          className="stone-ghost"
          style={{
            left: ghostPosition.x,
            top: ghostPosition.y,
            backgroundColor: ELEMENT_COLORS[draggingElement],
          }}
        >
          {ELEMENT_SYMBOLS[draggingElement]}
        </div>
      )}
    </div>
  );
}

export default StonePalette;
